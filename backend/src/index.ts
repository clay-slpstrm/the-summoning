import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";
import { createServer } from "http";
import { config, validateConfig } from "./config.js";
import { wsManager } from "./services/wsManager.js";
import { startEventListener, startGlyphEventListener } from "./services/eventListener.js";
import { startEpochSync } from "./services/epochSync.js";
import { setupRoutes } from "./api/routes.js";

validateConfig();

const app = express();
app.use(cors());
app.use(express.json());

// Health check
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
    startGlyphEventListener();
  } else {
    console.warn("[EVENTS] No ELDRITCH_GLYPHS_ADDRESS configured, glyph listener disabled");
  }
});
