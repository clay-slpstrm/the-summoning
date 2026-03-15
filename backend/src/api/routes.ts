import type { Express } from "express";
import { PrismaClient } from "@prisma/client";
import { CULT_RANKS } from "../utils/constants.js";

const prisma = new PrismaClient();

export function setupRoutes(app: Express): void {
  // ── Glyph Collection ──

  app.get("/api/glyphs/:wallet", async (req, res) => {
    const wallet = req.params.wallet.toLowerCase();
    const glyphs = await prisma.glyph.findMany({
      where: { walletAddr: wallet },
      orderBy: { createdAt: "desc" },
    });
    res.json({ glyphs });
  });

  app.get("/api/glyphs/:wallet/summary", async (req, res) => {
    const wallet = req.params.wallet.toLowerCase();
    const cultRank = await prisma.cultRank.findUnique({
      where: { walletAddr: wallet },
    });
    const tierCounts = await prisma.glyph.groupBy({
      by: ["tierName"],
      where: { walletAddr: wallet },
      _count: true,
    });
    res.json({
      rank: cultRank || { rankName: "Uninitiated", rankIndex: 0, glyphCount: 0 },
      tiers: tierCounts,
    });
  });

  // ── Epoch Status ──

  app.get("/api/epochs/current", async (req, res) => {
    const epoch = await prisma.epochCache.findFirst({
      orderBy: { epochId: "desc" },
    });
    res.json({ epoch: epoch || null });
  });

  app.get("/api/epochs/:epochId", async (req, res) => {
    const epochId = parseInt(req.params.epochId);
    const epoch = await prisma.epochCache.findUnique({
      where: { epochId },
    });
    res.json({ epoch: epoch || null });
  });

  // ── Leaderboard ──

  app.get("/api/leaderboard", async (req, res) => {
    const topCollectors = await prisma.cultRank.findMany({
      orderBy: { glyphCount: "desc" },
      take: 50,
    });
    res.json({ leaderboard: topCollectors });
  });

  // ── ERC-1155 Metadata ──

  app.get("/api/metadata/:tokenId", async (req, res) => {
    const tokenId = parseInt(req.params.tokenId);
    const epochId = Math.floor(tokenId / 1000);
    const tierId = tokenId % 1000;

    const tierNames: Record<number, string> = {
      0: "Shattered Ritual",
      1: "Harbinger",
      2: "Acolyte",
      3: "Cultist",
    };

    const tierName = tierNames[tierId] || "Unknown";

    // TODO: Map epochId to Old One name from epoch config
    const oldOneName = "Cthulhu";

    res.json({
      name: `Fragment of ${oldOneName} — ${tierName}`,
      description: `A shard of the ${oldOneName}, pulled from beyond the veil during Epoch ${epochId}.`,
      image: `https://api.thesummoning.xyz/images/${tokenId}.png`,
      attributes: [
        { trait_type: "Epoch", value: epochId },
        { trait_type: "Old One", value: oldOneName },
        { trait_type: "Tier", value: tierName },
        { trait_type: "Tier ID", value: tierId },
      ],
    });
  });
}
