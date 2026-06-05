import "dotenv/config";

export const config = {
  // Server
  PORT: parseInt(process.env.PORT || "3001"),
  WS_PORT: parseInt(process.env.WS_PORT || "3002"),

  // Chain
  CHAIN_ID: parseInt(process.env.CHAIN_ID || "11155111"),
  RPC_URL: process.env.RPC_URL || "http://127.0.0.1:8545",
  WS_RPC_URL: process.env.WS_RPC_URL || "ws://127.0.0.1:8545",

  // Backfill tuning. Free RPC tiers cap eth_getLogs ranges (Alchemy free = 10 blocks),
  // so the chunk size must stay within the provider's limit. On a paid tier raise both.
  BACKFILL_CHUNK_SIZE: BigInt(process.env.BACKFILL_CHUNK_SIZE || "10"),
  BACKFILL_BLOCK_RANGE: parseInt(process.env.BACKFILL_BLOCK_RANGE || "200"),

  // Contract addresses
  RITUAL_TOKEN_ADDRESS: process.env.RITUAL_TOKEN_ADDRESS || "",
  MINTING_CURVE_ADDRESS: process.env.MINTING_CURVE_ADDRESS || "",
  SUMMONING_ENGINE_ADDRESS: process.env.SUMMONING_ENGINE_ADDRESS || "",
  ELDER_ARTIFACTS_ADDRESS: process.env.ELDER_ARTIFACTS_ADDRESS || "",
  ELDRITCH_GLYPHS_ADDRESS: process.env.ELDRITCH_GLYPHS_ADDRESS || "",

  // Database
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/summoning",

  // Public-facing base URL — used in metadata JSON for image URLs so the same
  // code path works in dev (http://localhost:3002) and prod (https://api.thesummoning.xyz).
  // No trailing slash. Falls back to localhost if unset so dev "just works".
  PUBLIC_BASE_URL:
    (process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || "3002"}`).replace(/\/$/, ""),
} as const;

// Validate required config on startup
export function validateConfig(): void {
  const required = [
    "SUMMONING_ENGINE_ADDRESS",
  ] as const;

  for (const key of required) {
    if (!config[key]) {
      console.warn(`Warning: ${key} is not set. Event listener will not start.`);
    }
  }
}
