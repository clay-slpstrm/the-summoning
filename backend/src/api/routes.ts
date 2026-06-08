import type { Express } from "express";
import express from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { CULT_RANKS, GLYPH_TIERS, RUNE_SHAPES, LORE_MESSAGES, OLD_ONES } from "../utils/constants.js";
import { getHeartbeat } from "../lib/heartbeat.js";
import { config } from "../config.js";
import { renderGlyphSvg } from "../services/glyphSvg.js";

const prisma = new PrismaClient();

// Backend is always launched from its package root (npm run dev / npm start
// both cd into backend/), so cwd-relative paths to public/ are stable.
const PUBLIC_DIR = path.resolve(process.cwd(), "public");

// Indexer is considered unhealthy when no event has been processed in this window
// AND there's been on-chain activity to catch. Tunable via HEALTH_MAX_LAG_MS.
const HEALTH_MAX_LAG_MS = Number(process.env.HEALTH_MAX_LAG_MS || 30 * 60 * 1000);

export function setupRoutes(app: Express): void {
  // ── Images ──
  //
  // Artifact images are static: 20 files in public/artifacts/{oldOneId}/{tierId}.{png|jpg|jpeg|webp}.
  // The URL is extension-agnostic (/images/artifact/{oldOneId}/{tierId}) so artists
  // can drop in whichever format works best per image (PNG for transparency,
  // JPEG for compressed painterly fills, WebP for both). The handler probes the
  // supported extensions in order and serves the first match.
  // See public/artifacts/README.md for the layout.
  //
  // Glyph SVGs are dynamic: rendered per-tokenId from the on-chain (tier, rune,
  // lore) data stored in our Glyph table. The rendered SVG is cacheable
  // indefinitely because glyph data is immutable once minted.

  const ARTIFACT_EXTS = [
    { ext: "png",  mime: "image/png" },
    { ext: "jpg",  mime: "image/jpeg" },
    { ext: "jpeg", mime: "image/jpeg" },
    { ext: "webp", mime: "image/webp" },
  ] as const;

  app.get("/images/artifact/:oldOneId/:tierId", (req, res) => {
    const oldOneId = parseInt(req.params.oldOneId);
    const tierId = parseInt(req.params.tierId);
    if (!Number.isFinite(oldOneId) || !Number.isFinite(tierId) ||
        oldOneId < 1 || oldOneId > 99 || tierId < 0 || tierId > 9) {
      res.status(400).send("invalid path");
      return;
    }

    const dir = path.join(PUBLIC_DIR, "artifacts", String(oldOneId));
    for (const { ext, mime } of ARTIFACT_EXTS) {
      const filePath = path.join(dir, `${tierId}.${ext}`);
      if (existsSync(filePath)) {
        res.set("Content-Type", mime);
        // Edges revalidate daily so refreshed art propagates within a day.
        res.set("Cache-Control", "public, max-age=86400");
        res.sendFile(filePath);
        return;
      }
    }
    res.status(404).send("artifact image not found");
  });

  app.get("/images/glyph/:tokenId", async (req, res) => {
    const tokenId = parseInt(req.params.tokenId);
    if (!Number.isFinite(tokenId) || tokenId <= 0) {
      res.status(400).send("invalid tokenId");
      return;
    }

    const glyph = await prisma.glyph.findFirst({ where: { tokenId } });
    if (!glyph) {
      // Glyph hasn't been indexed yet (VRF in flight, or just not minted).
      // 404 so marketplaces retry rather than caching a placeholder forever.
      res.status(404).send("glyph not found");
      return;
    }

    const svg = renderGlyphSvg({
      tier: glyph.tierIndex,
      runeIndex: glyph.runeIndex,
      loreIndex: glyph.loreIndex,
      tokenId,
    });

    // Glyph data is immutable once minted, so we can cache aggressively.
    // immutable + 1y matches what Cloudflare/marketplaces will respect.
    res.set("Content-Type", "image/svg+xml; charset=utf-8");
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(svg);
  });

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
      image: `${config.PUBLIC_BASE_URL}/images/artifact/${epochRecord?.oldOneId ?? 1}/${tierId}`,
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
      image: `${config.PUBLIC_BASE_URL}/images/glyph/${tokenId}`,
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
      image: `${config.PUBLIC_BASE_URL}/images/artifact/${epochRecord?.oldOneId ?? 1}/${tierId}`,
      attributes: [
        { trait_type: "Epoch", value: epochId },
        { trait_type: "Old One", value: oldOne.name },
        { trait_type: "Tier", value: tierName },
        { trait_type: "Tier ID", value: tierId },
      ],
    });
  });
}
