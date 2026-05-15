/**
 * On-chain event listener.
 *
 * Watches for:
 *   - RitualSacrifice events on SummoningEngine (epoch progress broadcast)
 *   - GlyphsBatchRequested / GlyphMinted events on EldritchGlyphs
 *
 * Post-audit (C-01): glyphs are batched via claimGlyphs after epoch resolution,
 * not minted at sacrifice time. The backend listens for the batch-request event
 * (drives the channeling overlay during the VRF wait) and the per-glyph
 * GlyphMinted event (one fan-out per glyph in the batch, drives the
 * booster-pack reveal queue).
 */

import { createPublicClient, http, parseAbiItem } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { config } from "../config.js";
import { handleGlyphsBatchRequested, handleGlyphMinted } from "./glyphMintHandler.js";
import { wsManager } from "./wsManager.js";

const chain = config.CHAIN_ID === 1 ? mainnet : sepolia;

const client = createPublicClient({
  chain,
  transport: http(config.RPC_URL),
});

// ── Event signatures ────────────────────────────────────────────────────────

const ritualSacrificeEvent = parseAbiItem(
  "event RitualSacrifice(uint256 indexed epochId, address indexed wallet, uint256 amount, uint256 totalCommitted)"
);

const glyphsBatchRequestedEvent = parseAbiItem(
  "event GlyphsBatchRequested(uint256 indexed requestId, address indexed recipient, uint256 epochId, uint256 numGlyphs, uint256 cumulativeContribution)"
);

const glyphMintedEvent = parseAbiItem(
  "event GlyphMinted(uint256 indexed tokenId, address indexed recipient, uint8 tier, uint8 runeIndex, uint8 loreIndex, uint256 epochId)"
);

// ── SummoningEngine listener ────────────────────────────────────────────────

export function startEventListener(): void {
  const address = config.SUMMONING_ENGINE_ADDRESS as `0x${string}`;

  console.log(`[EVENTS] Listening for RitualSacrifice on ${address}`);

  client.watchEvent({
    address,
    event: ritualSacrificeEvent,
    pollingInterval: 4000,
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const args = log.args as {
            epochId?: bigint;
            wallet?: string;
            amount?: bigint;
            totalCommitted?: bigint;
          };

          if (!args.epochId || !args.wallet || !args.amount) {
            console.warn("[EVENTS] Missing RitualSacrifice args:", log);
            continue;
          }

          console.log(
            `[EVENTS] RitualSacrifice: epoch=${args.epochId} wallet=${args.wallet} amount=${args.amount}`
          );

          // Broadcast sacrifice to all connected clients for epoch progress
          wsManager.broadcast({
            type: "ritual_sacrifice",
            data: {
              epochId: Number(args.epochId),
              wallet: args.wallet,
              amount: args.amount.toString(),
              totalCommitted: args.totalCommitted?.toString() ?? "0",
            },
          });
        } catch (err) {
          console.error("[EVENTS] Error processing sacrifice event:", err);
        }
      }
    },
    onError: (error) => {
      // viem auto-recreates the filter on the next poll; do NOT call
      // startEventListener recursively (that spawns parallel watchers).
      console.error("[EVENTS] SummoningEngine watch error:", error.message ?? error);
    },
  });
}

// ── EldritchGlyphs listener ─────────────────────────────────────────────────

export function startGlyphEventListener(): void {
  const address = config.ELDRITCH_GLYPHS_ADDRESS as `0x${string}`;

  if (!address) {
    console.warn("[EVENTS] No ELDRITCH_GLYPHS_ADDRESS configured, glyph listener disabled");
    return;
  }

  console.log(`[EVENTS] Listening for GlyphsBatchRequested + GlyphMinted on ${address}`);

  // Watch GlyphsBatchRequested (claimGlyphs issued a batched VRF request)
  client.watchEvent({
    address,
    event: glyphsBatchRequestedEvent,
    pollingInterval: 4000,
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const args = log.args as {
            requestId?: bigint;
            recipient?: string;
            epochId?: bigint;
            numGlyphs?: bigint;
            cumulativeContribution?: bigint;
          };

          if (
            !args.requestId ||
            !args.recipient ||
            args.epochId === undefined ||
            args.numGlyphs === undefined ||
            args.cumulativeContribution === undefined
          ) {
            console.warn("[EVENTS] Missing GlyphsBatchRequested args:", log);
            continue;
          }

          await handleGlyphsBatchRequested({
            requestId: args.requestId,
            recipient: args.recipient,
            epochId: Number(args.epochId),
            numGlyphs: Number(args.numGlyphs),
            cumulativeContribution: args.cumulativeContribution,
          });
        } catch (err) {
          console.error("[EVENTS] Error processing GlyphsBatchRequested:", err);
        }
      }
    },
    onError: (error) => {
      console.error("[EVENTS] GlyphsBatchRequested watch error:", error.message ?? error);
    },
  });

  // Watch GlyphMinted (VRF callback completed, glyph minted)
  client.watchEvent({
    address,
    event: glyphMintedEvent,
    pollingInterval: 4000,
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const args = log.args as {
            tokenId?: bigint;
            recipient?: string;
            tier?: number;
            runeIndex?: number;
            loreIndex?: number;
            epochId?: bigint;
          };

          if (
            args.tokenId === undefined ||
            !args.recipient ||
            args.tier === undefined ||
            args.runeIndex === undefined ||
            args.loreIndex === undefined ||
            args.epochId === undefined
          ) {
            console.warn("[EVENTS] Missing GlyphMinted args:", log);
            continue;
          }

          await handleGlyphMinted({
            tokenId: Number(args.tokenId),
            recipient: args.recipient,
            tier: args.tier,
            runeIndex: args.runeIndex,
            loreIndex: args.loreIndex,
            epochId: Number(args.epochId),
            txHash: log.transactionHash!,
            blockNumber: Number(log.blockNumber),
          });
        } catch (err) {
          console.error("[EVENTS] Error processing GlyphMinted:", err);
        }
      }
    },
    onError: (error) => {
      console.error("[EVENTS] GlyphMinted watch error:", error.message ?? error);
    },
  });
}
