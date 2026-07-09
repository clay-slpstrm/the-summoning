import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { config, validateConfig } from "./config.js";
import { wsManager } from "./services/wsManager.js";
import { startEventListener, startGlyphEventListener } from "./services/eventListener.js";
import { startEpochSync } from "./services/epochSync.js";
import { backfillGlyphEvents } from "./services/backfill.js";
import { startVrfMonitor } from "./services/vrfMonitor.js";
import { startEpochKeeper } from "./services/epochKeeper.js";
import { setupRoutes } from "./api/routes.js";

validateConfig();

const app = express();
app.use(cors());
app.use(express.json());

// Cheap liveness probe (always 200) — separate from /api/health which reports
// indexer lag + DB connectivity. Useful for the simplest possible uptime checker.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
setupRoutes(app);

// HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: "/ws" });
wsManager.attach(wss);

// Start
server.listen(config.PORT, () => {
  console.log(`[HTTP] Server listening on port ${config.PORT}`);
  console.log(`[WS]   WebSocket server on ws://localhost:${config.PORT}/ws`);

  if (config.SUMMONING_ENGINE_ADDRESS) {
    startEventListener();
    startEpochSync();
  } else {
    console.warn("[EVENTS] No SUMMONING_ENGINE_ADDRESS configured, engine listener disabled");
  }

  if (config.ELDRITCH_GLYPHS_ADDRESS) {
    // Backfill any GlyphMinted events missed during downtime, then start the live watcher.
    // Range + chunk size come from config (BACKFILL_BLOCK_RANGE / BACKFILL_CHUNK_SIZE) so
    // they can be tuned per RPC provider's eth_getLogs limits.
    backfillGlyphEvents()
      .catch((err) => console.error("[BACKFILL] Failed:", err))
      .finally(() => startGlyphEventListener());
  } else {
    console.warn("[EVENTS] No ELDRITCH_GLYPHS_ADDRESS configured, glyph listener disabled");
  }

  // Stuck-VRF + low-LINK watchdog (audit decision record, AUDIT.md C-01 postmortem).
  // Safe to start even without ELDRITCH_GLYPHS_ADDRESS — the checks will no-op until
  // the config is present.
  startVrfMonitor();

  // Self-hosted epoch resolver (replaces Chainlink Automation, sunset 2026-07-31).
  // No-ops with a warning unless KEEPER_PRIVATE_KEY is set.
  startEpochKeeper();
});
