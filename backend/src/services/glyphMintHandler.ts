/**
 * On-chain glyph mint handler.
 *
 * Post-audit (C-01) event flow on EldritchGlyphs:
 *
 *   GlyphsBatchRequested → push "glyph_pending" to wallet (channeling UX
 *                           — covers the VRF wait between claimGlyphs tx
 *                           confirmation and the GlyphMinted fan-out)
 *   GlyphMinted (xN)     → persist each glyph, update rank, push "glyph_reveal"
 *                           per glyph. The frontend enqueues them and animates
 *                           a booster-pack reveal.
 *
 * The contract handles VRF + tier assignment; the backend is an event indexer
 * and real-time delivery layer.
 */

import { PrismaClient } from "@prisma/client";
import { wsManager } from "./wsManager.js";
import { updateCultRank } from "./leaderboard.js";
import { GLYPH_TIERS, RUNE_SHAPES, LORE_MESSAGES } from "../utils/constants.js";

const prisma = new PrismaClient();

// ── Types ────────────────────────────────────────────────────────────────────

export type GlyphsBatchRequestedEvent = {
  requestId: bigint;
  recipient: string;
  epochId: number;
  numGlyphs: number;
  cumulativeContribution: bigint;
};

export type GlyphMintedEvent = {
  tokenId: number;
  recipient: string;
  tier: number;
  runeIndex: number;
  loreIndex: number;
  epochId: number;
  txHash: string;
  blockNumber: number;
};

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * Handle GlyphsBatchRequested event — claimGlyphs has issued a batched VRF
 * request; up to numGlyphs glyphs are pending. Pushes channeling state to the
 * recipient's WebSocket so the UI can show the wait.
 */
export async function handleGlyphsBatchRequested(
  event: GlyphsBatchRequestedEvent
): Promise<void> {
  const wallet = event.recipient.toLowerCase();

  console.log(
    `[GLYPH] Batch requested: requestId=${event.requestId} wallet=${wallet} epoch=${event.epochId} numGlyphs=${event.numGlyphs} cumulative=${event.cumulativeContribution}`
  );

  wsManager.sendToWallet(wallet, {
    type: "glyph_pending",
    data: {
      requestId: event.requestId.toString(),
      epochId: event.epochId,
      numGlyphs: event.numGlyphs,
      cumulativeContribution: event.cumulativeContribution.toString(),
      timestamp: Date.now(),
    },
  });
}

/**
 * Handle GlyphMinted event — VRF callback completed, glyph minted on-chain.
 * Persists to database, updates cult rank, pushes reveal to WebSocket.
 */
export async function handleGlyphMinted(
  event: GlyphMintedEvent
): Promise<void> {
  const wallet = event.recipient.toLowerCase();

  // Idempotency check by tokenId
  const existing = await prisma.glyph.findFirst({
    where: { tokenId: event.tokenId },
  });
  if (existing) {
    console.log(`[GLYPH] Already indexed: tokenId=${event.tokenId}`);
    return;
  }

  // Resolve tier, rune, lore from indices
  const tier = GLYPH_TIERS[event.tier] ?? GLYPH_TIERS[0];
  const rune = RUNE_SHAPES[event.runeIndex] ?? RUNE_SHAPES[0];
  const lore = LORE_MESSAGES[event.loreIndex] ?? LORE_MESSAGES[0];

  // Persist to database
  await prisma.glyph.create({
    data: {
      walletAddr: wallet,
      epochId: event.epochId,
      txHash: event.txHash,
      tokenId: event.tokenId,
      status: "confirmed",
      tierName: tier.name,
      tierIndex: tier.index,
      runeIndex: event.runeIndex,
      loreIndex: event.loreIndex,
      rune,
      lore,
      amount: "0", // Amount is on the sacrifice tx, not the VRF callback
      blockNumber: event.blockNumber,
    },
  });

  console.log(
    `[GLYPH] Minted: tokenId=${event.tokenId} ${tier.name} (${rune}) → ${wallet}`
  );

  // Update cult rank
  await updateCultRank(wallet);

  // Push reveal to user
  wsManager.sendToWallet(wallet, {
    type: "glyph_reveal",
    data: {
      tokenId: event.tokenId,
      tierName: tier.name,
      tierIndex: tier.index,
      color: tier.color,
      rune,
      lore,
      txHash: event.txHash,
      amount: "0",
      epochId: event.epochId,
    },
  });

  // Broadcast epoch progress
  wsManager.broadcast({
    type: "epoch_update",
    data: {
      epochId: event.epochId,
      glyphMinted: event.tokenId,
    },
  });
}
