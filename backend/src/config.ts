import "dotenv/config";

export const config = {
  // Server
  PORT: parseInt(process.env.PORT || "3001"),
  WS_PORT: parseInt(process.env.WS_PORT || "3002"),

  // Chain
  CHAIN_ID: parseInt(process.env.CHAIN_ID || "11155111"),
  RPC_URL: process.env.RPC_URL || "http://127.0.0.1:8545",
  WS_RPC_URL: process.env.WS_RPC_URL || "ws://127.0.0.1:8545",

  // Contract addresses
  RITUAL_TOKEN_ADDRESS: process.env.RITUAL_TOKEN_ADDRESS || "",
  BONDING_CURVE_ADDRESS: process.env.BONDING_CURVE_ADDRESS || "",
  SUMMONING_ENGINE_ADDRESS: process.env.SUMMONING_ENGINE_ADDRESS || "",
  ELDER_ARTIFACTS_ADDRESS: process.env.ELDER_ARTIFACTS_ADDRESS || "",
  ELDRITCH_GLYPHS_ADDRESS: process.env.ELDRITCH_GLYPHS_ADDRESS || "",

  // Database
  DATABASE_URL: process.env.DATABASE_URL || "postgresql://postgres:password@localhost:5432/summoning",
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
