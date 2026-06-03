/**
 * Stuck-VRF detector + low-LINK watchdog.
 *
 * Two periodic checks:
 *
 * 1. STUCK VRF — every VRF_MONITOR_INTERVAL_MS, walk VrfRequest rows that are
 *    > VRF_STUCK_THRESHOLD_MS old and still null-fulfilled. For each, read the
 *    on-chain pendingGlyphs(requestId).fulfilled flag. If true: mark fulfilled
 *    locally. If false: send one stuck_vrf alert and mark `alerted=true` so we
 *    don't re-page on every tick.
 *
 *    This is the audit decision record (AUDIT.md C-01 postmortem, 2026-06-02)
 *    operational requirement. There is no on-chain recovery for stuck claims;
 *    ops responds out-of-band.
 *
 * 2. LOW LINK — every LINK_MONITOR_INTERVAL_MS, read the VRF subscription
 *    balance. If below MIN_LINK_BALANCE, send a low_link alert. Suppressed
 *    inside a 1h re-alert window to avoid spam.
 */

import { createPublicClient, http, parseAbi } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { PrismaClient } from "@prisma/client";
import { config } from "../config.js";
import { sendAlert } from "../lib/alerts.js";

const prisma = new PrismaClient();
const chain = config.CHAIN_ID === 1 ? mainnet : sepolia;

// HTTP transport here — we're issuing one-shot reads, not subscribing to events.
const client = createPublicClient({ chain, transport: http(config.RPC_URL) });

// ── ABIs (minimal slices) ──────────────────────────────────────────────────

const ELDRITCH_GLYPHS_ABI = parseAbi([
  "function pendingGlyphs(uint256 requestId) view returns (address recipient, uint256 epochId, uint256 cumulativeContribution, uint256 numGlyphs, bool fulfilled)",
]);

const VRF_COORDINATOR_ABI = parseAbi([
  "function getSubscription(uint256 subId) view returns (uint96 balance, uint96 nativeBalance, uint64 reqCount, address subOwner, address[] consumers)",
]);

// ── Tuning (env-overridable) ───────────────────────────────────────────────

// How often the stuck-VRF check runs. Faster = quicker alerts; slower = less RPC load.
const VRF_MONITOR_INTERVAL_MS = Number(process.env.VRF_MONITOR_INTERVAL_MS || 5 * 60 * 1000);

// A request older than this with fulfilledAt=null is considered stuck enough to alert.
// 1h is conservative — Sepolia rehearsal #2 showed requests can hang 24h+ but most that
// fulfill at all fulfill within minutes. 1h catches genuine stuck cases without
// false-positiving on normal slow fulfillments.
const VRF_STUCK_THRESHOLD_MS = Number(process.env.VRF_STUCK_THRESHOLD_MS || 60 * 60 * 1000);

const LINK_MONITOR_INTERVAL_MS = Number(process.env.LINK_MONITOR_INTERVAL_MS || 30 * 60 * 1000);
const MIN_LINK_BALANCE = Number(process.env.MIN_LINK_BALANCE || 2); // LINK units

// Memoize last low-LINK alert time to suppress re-alerts inside a window.
let lastLinkAlertAt = 0;
const LINK_REALERT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ── Checks ────────────────────────────────────────────────────────────────

export async function checkStuckVrfRequests(): Promise<void> {
  const cutoff = new Date(Date.now() - VRF_STUCK_THRESHOLD_MS);

  // Candidate set: old + still null-fulfilled. `alerted=true` rows we skip
  // (already paged ops; one alert per request is enough).
  const candidates = await prisma.vrfRequest.findMany({
    where: {
      requestedAt: { lt: cutoff },
      fulfilledAt: null,
      alerted: false,
    },
    take: 50, // safety cap; if you have >50 stuck, something else is wrong
  });

  if (candidates.length === 0) return;

  const eldritchGlyphs = config.ELDRITCH_GLYPHS_ADDRESS as `0x${string}`;
  if (!eldritchGlyphs) {
    console.warn("[VRF MONITOR] ELDRITCH_GLYPHS_ADDRESS unset, skipping");
    return;
  }

  for (const req of candidates) {
    try {
      const pending = await client.readContract({
        address: eldritchGlyphs,
        abi: ELDRITCH_GLYPHS_ABI,
        functionName: "pendingGlyphs",
        args: [BigInt(req.requestId)],
      });
      const fulfilled = pending[4]; // fulfilled flag

      if (fulfilled) {
        await prisma.vrfRequest.update({
          where: { requestId: req.requestId },
          data: { fulfilledAt: new Date() },
        });
        console.log(`[VRF MONITOR] Late-detected fulfillment: requestId=${req.requestId}`);
        continue;
      }

      // Genuinely stuck. Page ops once, then suppress.
      const ageMinutes = Math.floor(
        (Date.now() - req.requestedAt.getTime()) / 60_000,
      );
      await sendAlert({
        type: "stuck_vrf",
        summary: `VRF request stuck ${ageMinutes}min: ${req.numGlyphs} glyphs for ${req.recipient}`,
        details: {
          requestId: req.requestId,
          recipient: req.recipient,
          epochId: req.epochId,
          numGlyphs: req.numGlyphs,
          requestedAt: req.requestedAt.toISOString(),
          ageMinutes,
          eldritchGlyphsAddress: eldritchGlyphs,
        },
      });

      await prisma.vrfRequest.update({
        where: { requestId: req.requestId },
        data: { alerted: true },
      });
    } catch (err) {
      console.error(
        `[VRF MONITOR] Error checking requestId=${req.requestId}:`,
        (err as Error).message,
      );
    }
  }
}

export async function checkLinkBalance(): Promise<void> {
  const coordinator = process.env.VRF_COORDINATOR as `0x${string}` | undefined;
  const subscriptionId = process.env.VRF_SUBSCRIPTION_ID;
  if (!coordinator || !subscriptionId) {
    console.warn("[VRF MONITOR] VRF_COORDINATOR or VRF_SUBSCRIPTION_ID unset, skipping LINK check");
    return;
  }

  try {
    const sub = await client.readContract({
      address: coordinator,
      abi: VRF_COORDINATOR_ABI,
      functionName: "getSubscription",
      args: [BigInt(subscriptionId)],
    });
    const balanceWei = sub[0]; // uint96 LINK balance (18 decimals)
    const balance = Number(balanceWei) / 1e18;

    if (balance >= MIN_LINK_BALANCE) return;
    if (Date.now() - lastLinkAlertAt < LINK_REALERT_WINDOW_MS) return; // suppressed

    await sendAlert({
      type: "low_link",
      summary: `VRF subscription balance ${balance.toFixed(2)} LINK (< ${MIN_LINK_BALANCE} LINK threshold)`,
      details: {
        subscriptionId,
        balance,
        threshold: MIN_LINK_BALANCE,
        coordinator,
      },
    });
    lastLinkAlertAt = Date.now();
  } catch (err) {
    console.error("[VRF MONITOR] LINK balance check failed:", (err as Error).message);
  }
}

export function startVrfMonitor(): void {
  console.log(
    `[VRF MONITOR] Started. stuck-check every ${VRF_MONITOR_INTERVAL_MS / 1000}s ` +
      `(threshold ${VRF_STUCK_THRESHOLD_MS / 60_000}min), link-check every ${LINK_MONITOR_INTERVAL_MS / 60_000}min`,
  );

  // Kick a check immediately on startup so a freshly-restarted backend reports
  // any pre-existing stuck requests right away instead of waiting an interval.
  checkStuckVrfRequests().catch((err) =>
    console.error("[VRF MONITOR] startup stuck check failed:", (err as Error).message),
  );
  checkLinkBalance().catch((err) =>
    console.error("[VRF MONITOR] startup link check failed:", (err as Error).message),
  );

  setInterval(() => {
    checkStuckVrfRequests().catch((err) =>
      console.error("[VRF MONITOR] stuck check failed:", (err as Error).message),
    );
  }, VRF_MONITOR_INTERVAL_MS);

  setInterval(() => {
    checkLinkBalance().catch((err) =>
      console.error("[VRF MONITOR] link check failed:", (err as Error).message),
    );
  }, LINK_MONITOR_INTERVAL_MS);
}
