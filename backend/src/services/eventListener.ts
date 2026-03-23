/**
 * On-chain event listener.
 *
 * Watches for:
 *   - RitualSacrifice events on SummoningEngine (epoch tracking)
 *   - GlyphRequested / GlyphMinted events on EldritchGlyphs (VRF glyph flow)
 *
 * The old glyphEngine pipeline is replaced by glyphMintHandler which
 * processes on-chain VRF events instead of deriving glyphs from txHash.
 */

import { createPublicClient, http, parseAbiItem } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { config } from "../config.js";
import { handleGlyphRequested, handleGlyphMinted } from "./glyphMintHandler.js";
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

const glyphRequestedEvent = parseAbiItem(
  "event GlyphRequested(uint256 indexed requestId, address indexed recipient, uint256 epochId)"
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
      console.error("[EVENTS] SummoningEngine watch error:", error);
      setTimeout(() => startEventListener(), 5000);
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

  console.log(`[EVENTS] Listening for GlyphRequested + GlyphMinted on ${address}`);

  // Watch GlyphRequested (VRF request sent, glyph pending)
  client.watchEvent({
    address,
    event: glyphRequestedEvent,
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const args = log.args as {
            requestId?: bigint;
            recipient?: string;
            epochId?: bigint;
          };

          if (!args.requestId || !args.recipient || args.epochId === undefined) {
            console.warn("[EVENTS] Missing GlyphRequested args:", log);
            continue;
          }

          await handleGlyphRequested({
            requestId: args.requestId,
            recipient: args.recipient,
            epochId: Number(args.epochId),
          });
        } catch (err) {
          console.error("[EVENTS] Error processing GlyphRequested:", err);
        }
      }
    },
    onError: (error) => {
      console.error("[EVENTS] GlyphRequested watch error:", error);
      setTimeout(() => startGlyphEventListener(), 5000);
    },
  });

  // Watch GlyphMinted (VRF callback completed, glyph minted)
  client.watchEvent({
    address,
    event: glyphMintedEvent,
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
      console.error("[EVENTS] GlyphMinted watch error:", error);
      setTimeout(() => startGlyphEventListener(), 5000);
    },
  });
}
