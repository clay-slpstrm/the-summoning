/**
 * Leaderboard & Cult Rank service.
 *
 * See ARCHITECTURE.md Section 4.6 and PRD.md Section 7 for specification.
 */

import { PrismaClient } from "@prisma/client";
import { CULT_RANKS } from "../utils/constants.js";

const prisma = new PrismaClient();

export type CultRankInfo = {
  name: string;
  index: number;
  minGlyphs: number;
};

export function calculateRank(glyphCount: number): CultRankInfo {
  let rank = CULT_RANKS[0];
  for (const r of CULT_RANKS) {
    if (glyphCount >= r.minGlyphs) rank = r;
  }
  return rank;
}

export async function updateCultRank(wallet: string): Promise<CultRankInfo> {
  const count = await prisma.glyph.count({
    where: { walletAddr: wallet },
  });

  const rank = calculateRank(count);

  await prisma.cultRank.upsert({
    where: { walletAddr: wallet },
    update: {
      glyphCount: count,
      rankName: rank.name,
      rankIndex: rank.index,
    },
    create: {
      walletAddr: wallet,
      glyphCount: count,
      rankName: rank.name,
      rankIndex: rank.index,
    },
  });

  return rank;
}
