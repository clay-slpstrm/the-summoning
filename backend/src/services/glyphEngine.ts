/**
 * Glyph Engine — core service for processing sacrifices into glyphs.
 *
 * Processes RitualSacrifice events: deterministic glyph assignment,
 * database persistence, rank update, and real-time WebSocket delivery.
 *
 * See ARCHITECTURE.md Section 4.2 for specification.
 */

import { PrismaClient } from "@prisma/client";
import { rollGlyphFromTxHash } from "../utils/glyphRoll.js";
import { wsManager } from "./wsManager.js";
import { updateCultRank } from "./leaderboard.js";

const prisma = new PrismaClient();

export type RitualSacrificeEvent = {
  epochId: number;
  wallet: string;
  amount: bigint;
  txHash: string;
  blockNumber: number;
};

export async function processRitualSacrifice(
  event: RitualSacrificeEvent
): Promise<void> {
  const wallet = event.wallet.toLowerCase();

  // 1. Idempotency check — txHash is unique in the database
  const existing = await prisma.glyph.findUnique({
    where: { txHash: event.txHash },
  });
  if (existing) {
    console.log(`[GLYPH] Already processed: ${event.txHash}`);
    return;
  }

  // 2. Deterministic glyph roll from transaction hash
  const roll = rollGlyphFromTxHash(event.txHash);

  // 3. Persist to database
  const glyph = await prisma.glyph.create({
    data: {
      walletAddr: wallet,
      epochId: event.epochId,
      txHash: event.txHash,
      tierName: roll.tierName,
      tierIndex: roll.tierIndex,
      rune: roll.rune,
      lore: roll.lore,
      amount: event.amount.toString(),
      blockNumber: event.blockNumber,
    },
  });

  console.log(
    `[GLYPH] Assigned: ${roll.tierName} glyph (${roll.rune}) to ${wallet}`
  );

  // 4. Update cult rank
  const rank = await updateCultRank(wallet);

  // 5. Push to user via WebSocket
  wsManager.sendToWallet(wallet, {
    type: "glyph_reveal",
    data: {
      tierName: roll.tierName,
      tierIndex: roll.tierIndex,
      color: roll.color,
      rune: roll.rune,
      lore: roll.lore,
      txHash: event.txHash,
      amount: event.amount.toString(),
      epochId: event.epochId,
    },
  });

  // 6. Broadcast epoch progress update to all connected clients
  wsManager.broadcast({
    type: "epoch_update",
    data: {
      epochId: event.epochId,
      latestSacrifice: event.amount.toString(),
    },
  });
}
