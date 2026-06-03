import type { Express } from "express";
import { PrismaClient } from "@prisma/client";
import { CULT_RANKS, GLYPH_TIERS, RUNE_SHAPES, LORE_MESSAGES, OLD_ONES } from "../utils/constants.js";
import { getHeartbeat } from "../lib/heartbeat.js";

const prisma = new PrismaClient();

// Indexer is considered unhealthy when no event has been processed in this window
// AND there's been on-chain activity to catch. Tunable via HEALTH_MAX_LAG_MS.
const HEALTH_MAX_LAG_MS = Number(process.env.HEALTH_MAX_LAG_MS || 30 * 60 * 1000);

export function setupRoutes(app: Express): void {
  // ── Health (external uptime monitor) ──

  app.get("/api/health", async (_req, res) => {
    const hb = getHeartbeat();
    let dbOk = true;
    try {
      // 1ms touch — verifies the Postgres connection is alive.
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbOk = false;
    }

    const lagOk = hb.ageMs < HEALTH_MAX_LAG_MS;
    const healthy = dbOk && lagOk;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      db: dbOk ? "ok" : "down",
      indexer: {
        lastEventLabel: hb.lastEventLabel,
        lastEventAt: new Date(hb.lastEventAt).toISOString(),
        ageMs: hb.ageMs,
        ageMinutes: Math.floor(hb.ageMs / 60_000),
        lagThresholdMs: HEALTH_MAX_LAG_MS,
        lagOk,
      },
      timestamp: new Date().toISOString(),
    });
  });

  // ── Glyph Collection ──

  app.get("/api/glyphs/:wallet", async (req, res) => {
    const wallet = req.params.wallet.toLowerCase();
    const glyphs = await prisma.glyph.findMany({
      where: { walletAddr: wallet, status: "confirmed" },
      orderBy: { createdAt: "desc" },
    });
    res.json({ glyphs });
  });

  // Pending VRF requests for a wallet
  app.get("/api/glyphs/:wallet/pending", async (req, res) => {
    const wallet = req.params.wallet.toLowerCase();
    const pending = await prisma.glyph.findMany({
      where: { walletAddr: wallet, status: "pending" },
      orderBy: { createdAt: "desc" },
    });
    res.json({ pending });
  });

  app.get("/api/glyphs/:wallet/summary", async (req, res) => {
    const wallet = req.params.wallet.toLowerCase();
    const cultRank = await prisma.cultRank.findUnique({
      where: { walletAddr: wallet },
    });
    const tierCounts = await prisma.glyph.groupBy({
      by: ["tierName"],
      where: { walletAddr: wallet, status: "confirmed" },
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
    const leaderboard = await prisma.cultRank.findMany({
      orderBy: { glyphCount: "desc" },
      take: 50,
    });
    res.json({ leaderboard });
  });

  app.get("/api/leaderboard/glyphs", async (req, res) => {
    const topWallets = await prisma.cultRank.findMany({
      orderBy: { glyphCount: "desc" },
      take: 50,
    });
    res.json({ leaderboard: topWallets });
  });

  // ── ERC-1155 Metadata: Elder Artifacts ──

  app.get("/api/metadata/artifact/:tokenId", async (req, res) => {
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

    const epochRecord = await prisma.epochCache.findUnique({ where: { epochId } });
    const oldOne = epochRecord ? (OLD_ONES[epochRecord.oldOneId] ?? OLD_ONES[1]) : OLD_ONES[1];

    res.json({
      name: `Fragment of ${oldOne.name} — ${tierName}`,
      description: `A shard of ${oldOne.description}, pulled from beyond the veil during Epoch ${epochId}.`,
      image: `https://api.thesummoning.xyz/images/artifact/${tokenId}.png`,
      attributes: [
        { trait_type: "Epoch", value: epochId },
        { trait_type: "Old One", value: oldOne.name },
        { trait_type: "Tier", value: tierName },
        { trait_type: "Tier ID", value: tierId },
      ],
    });
  });

  // ── ERC-1155 Metadata: Eldritch Glyphs (on-chain NFTs) ──

  app.get("/api/metadata/glyph/:tokenId", async (req, res) => {
    const tokenId = parseInt(req.params.tokenId);

    const glyph = await prisma.glyph.findFirst({
      where: { tokenId },
    });

    if (!glyph) {
      res.status(404).json({ error: "Glyph not found" });
      return;
    }

    const tier = GLYPH_TIERS[glyph.tierIndex] ?? GLYPH_TIERS[0];

    res.json({
      name: `Eldritch Glyph #${tokenId} — ${tier.name}`,
      description: `${glyph.lore} A ${tier.name}-tier glyph channeled during Epoch ${glyph.epochId}.`,
      image: `https://api.thesummoning.xyz/images/glyph/${tokenId}.png`,
      attributes: [
        { trait_type: "Tier", value: tier.name },
        { trait_type: "Tier Index", value: glyph.tierIndex },
        { trait_type: "Rune", value: glyph.rune },
        { trait_type: "Rune Index", value: glyph.runeIndex },
        { trait_type: "Lore", value: glyph.lore },
        { trait_type: "Epoch", value: glyph.epochId },
      ],
    });
  });

  // Keep old /api/metadata/:tokenId for backward compatibility with ElderArtifacts
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

    const epochRecord = await prisma.epochCache.findUnique({ where: { epochId } });
    const oldOne = epochRecord ? (OLD_ONES[epochRecord.oldOneId] ?? OLD_ONES[1]) : OLD_ONES[1];

    res.json({
      name: `Fragment of ${oldOne.name} — ${tierName}`,
      description: `A shard of ${oldOne.description}, pulled from beyond the veil during Epoch ${epochId}.`,
      image: `https://api.thesummoning.xyz/images/${tokenId}.png`,
      attributes: [
        { trait_type: "Epoch", value: epochId },
        { trait_type: "Old One", value: oldOne.name },
        { trait_type: "Tier", value: tierName },
        { trait_type: "Tier ID", value: tierId },
      ],
    });
  });
}
