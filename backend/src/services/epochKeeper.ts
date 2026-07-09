/**
 * Epoch keeper — self-hosted replacement for Chainlink Automation.
 *
 * Chainlink Automation v2.1 sunsets 2026-07-31 and closed new upkeep
 * registrations (its successor, CRE, is a full workflow platform — overkill
 * for this job). resolveEpoch() is intentionally permissionless, so the
 * backend can do the resolving itself:
 *
 *   Every KEEPER_INTERVAL_MS: read the current epoch. If ritualEnd has passed
 *   and the epoch is unresolved, send resolveEpoch() from KEEPER_PRIVATE_KEY.
 *
 * The keeper wallet needs ONLY gas ETH (~0.005). The function being
 * permissionless means the key carries zero protocol authority — worst case,
 * an attacker who steals it can pay our gas bill for us.
 *
 * Failure modes covered:
 *   - Keeper disabled/broken → epoch_resolution_overdue alert fires while the
 *     epoch sits unresolved, and anyone can resolve manually (see RUNBOOK.md).
 *   - Send races (another caller resolved first) → simulate before send; the
 *     next tick observes resolved=true and stands down.
 *   - Low gas → low_keeper_eth alert below MIN_KEEPER_ETH.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mainnet, sepolia } from "viem/chains";
import { config } from "../config.js";
import { sendAlert } from "../lib/alerts.js";

const chain = config.CHAIN_ID === 1 ? mainnet : sepolia;

const ENGINE_ABI = parseAbi([
  "function currentEpochId() view returns (uint256)",
  "function getEpoch(uint256 epochId) view returns (uint256 oldOneId, uint256 threshold, uint256 totalCommitted, uint256 gatheringStart, uint256 ritualStart, uint256 ritualEnd, bool successful, bool resolved, uint256 participantCount)",
  "function resolveEpoch()",
]);

// ── Tuning (env-overridable) ───────────────────────────────────────────────

const KEEPER_INTERVAL_MS = Number(process.env.KEEPER_INTERVAL_MS || 60 * 1000);

// If an epoch is still unresolved this long past ritualEnd, page ops — the
// keeper itself may be the thing that's broken.
const OVERDUE_THRESHOLD_MS = Number(process.env.KEEPER_OVERDUE_THRESHOLD_MS || 30 * 60 * 1000);

// Keeper wallet gas floor (ETH). One resolveEpoch is ~100k gas; at low-gwei
// mainnet 0.002 ETH covers dozens of resolutions.
const MIN_KEEPER_ETH = Number(process.env.MIN_KEEPER_ETH || 0.002);

const REALERT_WINDOW_MS = 60 * 60 * 1000; // suppress repeat pages inside 1h

// ── State ──────────────────────────────────────────────────────────────────

let inFlight = false;
let lastOverdueAlertAt = 0;
let lastErrorAlertAt = 0;
let lastLowEthAlertAt = 0;

/**
 * Pure decision: should the keeper attempt resolution now?
 * Exported for unit tests.
 */
export function shouldResolve(
  epoch: { resolved: boolean; ritualEnd: bigint },
  nowSec: bigint
): boolean {
  return !epoch.resolved && nowSec >= epoch.ritualEnd;
}

export function startEpochKeeper(): void {
  const rawKey = process.env.KEEPER_PRIVATE_KEY || "";
  if (!rawKey) {
    console.warn(
      "[KEEPER] KEEPER_PRIVATE_KEY not set — epoch auto-resolution disabled. " +
        "resolveEpoch() must be called manually after each ritualEnd (it is permissionless)."
    );
    return;
  }
  if (!config.SUMMONING_ENGINE_ADDRESS) {
    console.warn("[KEEPER] No SUMMONING_ENGINE_ADDRESS configured, keeper disabled");
    return;
  }

  const account = privateKeyToAccount(rawKey as `0x${string}`);
  const engine = config.SUMMONING_ENGINE_ADDRESS as `0x${string}`;
  const publicClient = createPublicClient({ chain, transport: http(config.RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(config.RPC_URL) });

  console.log(
    `[KEEPER] Epoch keeper started (wallet ${account.address}, every ${KEEPER_INTERVAL_MS / 1000}s)`
  );

  async function tick(): Promise<void> {
    if (inFlight) return;
    inFlight = true;
    try {
      const epochId = await publicClient.readContract({
        address: engine,
        abi: ENGINE_ABI,
        functionName: "currentEpochId",
      });
      if (epochId === 0n) return;

      const [, , , , , ritualEnd, , resolved] = await publicClient.readContract({
        address: engine,
        abi: ENGINE_ABI,
        functionName: "getEpoch",
        args: [epochId],
      });

      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      if (!shouldResolve({ resolved, ritualEnd }, nowSec)) return;

      // Simulate first: if someone else resolved in the same block window,
      // this reverts cheaply and we stand down until the next tick.
      const { request } = await publicClient.simulateContract({
        account,
        address: engine,
        abi: ENGINE_ABI,
        functionName: "resolveEpoch",
      });

      console.log(`[KEEPER] Resolving epoch ${epochId}...`);
      const hash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === "success") {
        console.log(`[KEEPER] Epoch ${epochId} resolved in tx ${hash}`);
        await sendAlert({
          type: "epoch_resolved",
          summary: `Epoch ${epochId} auto-resolved by keeper`,
          details: { epochId: epochId.toString(), tx: hash },
        });
      } else {
        throw new Error(`resolveEpoch tx reverted: ${hash}`);
      }
    } catch (err) {
      const message = (err as Error).message ?? String(err);
      console.error("[KEEPER] Tick error:", message);
      if (Date.now() - lastErrorAlertAt > REALERT_WINDOW_MS) {
        lastErrorAlertAt = Date.now();
        await sendAlert({
          type: "keeper_error",
          summary: "Epoch keeper failed to resolve",
          details: { error: message.slice(0, 300) },
        });
      }
    } finally {
      inFlight = false;
    }

    // Overdue watchdog: fires even when the send path errors, so a silently
    // broken keeper still pages ops while the epoch sits unresolved.
    try {
      const epochId = await publicClient.readContract({
        address: engine,
        abi: ENGINE_ABI,
        functionName: "currentEpochId",
      });
      if (epochId === 0n) return;
      const [, , , , , ritualEnd, , resolved] = await publicClient.readContract({
        address: engine,
        abi: ENGINE_ABI,
        functionName: "getEpoch",
        args: [epochId],
      });
      const overdueMs = Date.now() - Number(ritualEnd) * 1000;
      if (!resolved && overdueMs > OVERDUE_THRESHOLD_MS) {
        if (Date.now() - lastOverdueAlertAt > REALERT_WINDOW_MS) {
          lastOverdueAlertAt = Date.now();
          await sendAlert({
            type: "epoch_resolution_overdue",
            summary: `Epoch ${epochId} unresolved ${Math.round(overdueMs / 60000)}min past ritualEnd`,
            details: {
              epochId: epochId.toString(),
              manualFallback: "resolveEpoch() is permissionless — see RUNBOOK.md",
            },
          });
        }
      }
    } catch {
      // Overdue check is best-effort; the primary error path already alerted.
    }
  }

  async function checkGas(): Promise<void> {
    try {
      const balance = await publicClient.getBalance({ address: account.address });
      const eth = Number(formatEther(balance));
      if (eth < MIN_KEEPER_ETH && Date.now() - lastLowEthAlertAt > REALERT_WINDOW_MS) {
        lastLowEthAlertAt = Date.now();
        await sendAlert({
          type: "low_keeper_eth",
          summary: `Keeper wallet gas low: ${eth.toFixed(4)} ETH (floor ${MIN_KEEPER_ETH})`,
          details: { wallet: account.address },
        });
      }
    } catch (err) {
      console.error("[KEEPER] Gas check error:", (err as Error).message);
    }
  }

  tick();
  checkGas();
  setInterval(tick, KEEPER_INTERVAL_MS);
  setInterval(checkGas, 6 * 60 * 60 * 1000);
}
