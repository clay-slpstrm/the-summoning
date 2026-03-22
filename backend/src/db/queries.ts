/**
 * Centralised database query helpers.
 * Wraps common Prisma calls so routes and services share one implementation.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── Glyphs ───────────────────────────────────────────────────────────────────

export async function getGlyphsForWallet(wallet: string) {
  return prisma.glyph.findMany({
    where: { walletAddr: wallet.toLowerCase() },
    orderBy: { createdAt: "desc" },
  });
}

export async function getGlyphCount(wallet: string): Promise<number> {
  return prisma.glyph.count({ where: { walletAddr: wallet.toLowerCase() } });
}

export async function glyphExists(txHash: string): Promise<boolean> {
  const glyph = await prisma.glyph.findUnique({ where: { txHash } });
  return glyph !== null;
}

// ── Cult Rank ────────────────────────────────────────────────────────────────

export async function getCultRank(wallet: string) {
  return prisma.cultRank.findUnique({ where: { walletAddr: wallet.toLowerCase() } });
}

export async function getLeaderboard(limit = 50) {
  return prisma.cultRank.findMany({
    orderBy: { glyphCount: "desc" },
    take: limit,
  });
}

// ── Epoch Cache ──────────────────────────────────────────────────────────────

export async function getCurrentEpoch() {
  return prisma.epochCache.findFirst({ orderBy: { epochId: "desc" } });
}

export async function getEpochById(epochId: number) {
  return prisma.epochCache.findUnique({ where: { epochId } });
}
