/**
 * Epoch sync service.
 *
 * Keeps EpochCache in sync with on-chain state by:
 *   1. Reading current epoch on startup (catches up immediately)
 *   2. Watching EpochStarted and EpochResolved events for instant updates
 *   3. Polling every 60s as a backstop for totalCommitted drift
 *
 * Without this, GET /api/epochs/current always returns null.
 */

import { createPublicClient, http, parseAbi, parseAbiItem } from "viem";
import { sepolia, mainnet } from "viem/chains";
import { PrismaClient } from "@prisma/client";
import { config } from "../config.js";

const prisma = new PrismaClient();

const chain = config.CHAIN_ID === 1 ? mainnet : sepolia;
const client = createPublicClient({
  chain,
  transport: http(config.RPC_URL),
});

const ENGINE_ADDRESS = config.SUMMONING_ENGINE_ADDRESS as `0x${string}`;

const engineAbi = parseAbi([
  "function currentEpochId() view returns (uint256)",
  "function getEpoch(uint256 epochId) view returns (uint256 oldOneId, uint256 threshold, uint256 totalCommitted, uint256 gatheringStart, uint256 ritualStart, uint256 ritualEnd, bool successful, bool resolved, uint256 participantCount)",
]);

function derivePhase(
  ritualStart: bigint,
  ritualEnd: bigint,
  resolved: boolean
): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (resolved || now >= ritualEnd) return "Resolved";
  if (now >= ritualStart) return "Ritual";
  return "Gathering";
}

/**
 * Fetch the current epoch from the chain and upsert into EpochCache.
 * Safe to call repeatedly — idempotent.
 */
export async function syncCurrentEpoch(): Promise<void> {
  if (!ENGINE_ADDRESS) return;

  try {
    const currentEpochId = await client.readContract({
      address: ENGINE_ADDRESS,
      abi: engineAbi,
      functionName: "currentEpochId",
    });

    if (currentEpochId === 0n) {
      console.log("[EPOCH] No epoch started yet");
      return;
    }

    await syncEpoch(Number(currentEpochId));
  } catch (err) {
    console.error("[EPOCH] Sync error:", err);
  }
}

async function syncEpoch(epochId: number): Promise<void> {
  const epoch = await client.readContract({
    address: ENGINE_ADDRESS,
    abi: engineAbi,
    functionName: "getEpoch",
    args: [BigInt(epochId)],
  });

  const [
    oldOneId,
    threshold,
    totalCommitted,
    ,
    ritualStart,
    ritualEnd,
    successful,
    resolved,
    participantCount,
  ] = epoch;

  const phase = derivePhase(ritualStart, ritualEnd, resolved);

  await prisma.epochCache.upsert({
    where: { epochId },
    update: { totalCommitted: totalCommitted.toString(), phase, successful, participantCount: Number(participantCount) },
    create: {
      epochId,
      oldOneId: Number(oldOneId),
      threshold: threshold.toString(),
      totalCommitted: totalCommitted.toString(),
      phase,
      successful,
      participantCount: Number(participantCount),
    },
  });

  console.log(`[EPOCH] Synced epoch ${epochId}: phase=${phase} committed=${totalCommitted}`);
}

/**
 * Watch EpochStarted and EpochResolved events for immediate cache updates,
 * and poll every `intervalMs` as a backstop for totalCommitted drift.
 */
export function startEpochSync(intervalMs = 60_000): void {
  if (!ENGINE_ADDRESS) return;

  // Sync immediately on startup
  syncCurrentEpoch();

  // Watch EpochStarted
  client.watchEvent({
    address: ENGINE_ADDRESS,
    event: parseAbiItem(
      "event EpochStarted(uint256 indexed epochId, uint256 oldOneId, uint256 threshold, uint256 gatheringStart)"
    ),
    onLogs: async (logs) => {
      for (const log of logs) {
        const epochId = Number(log.args.epochId);
        console.log(`[EPOCH] EpochStarted event: epochId=${epochId}`);
        await syncEpoch(epochId);
      }
    },
    onError: (err) => console.error("[EPOCH] EpochStarted watch error:", err),
  });

  // Watch EpochResolved
  client.watchEvent({
    address: ENGINE_ADDRESS,
    event: parseAbiItem(
      "event EpochResolved(uint256 indexed epochId, bool successful, uint256 totalBurned)"
    ),
    onLogs: async (logs) => {
      for (const log of logs) {
        const epochId = Number(log.args.epochId);
        console.log(`[EPOCH] EpochResolved event: epochId=${epochId} success=${log.args.successful}`);
        await syncEpoch(epochId);
      }
    },
    onError: (err) => console.error("[EPOCH] EpochResolved watch error:", err),
  });

  // Poll as backstop (keeps totalCommitted fresh between RitualSacrifice events)
  setInterval(syncCurrentEpoch, intervalMs);
  console.log(`[EPOCH] Sync started (polling every ${intervalMs / 1000}s)`);
}
