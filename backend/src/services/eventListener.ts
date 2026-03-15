/**
 * On-chain event listener.
 *
 * Watches for RitualSacrifice events emitted by SummoningEngine
 * and feeds them to the Glyph Engine for processing.
 *
 * See ARCHITECTURE.md Section 4.3 for specification.
 */

import { createPublicClient, http, parseAbiItem } from "viem";
import { mainnet, sepolia } from "viem/chains";
import { config } from "../config.js";
import { processRitualSacrifice } from "./glyphEngine.js";

const chain = config.CHAIN_ID === 1 ? mainnet : sepolia;

const client = createPublicClient({
  chain,
  transport: http(config.RPC_URL),
});

const ritualSacrificeEvent = parseAbiItem(
  "event RitualSacrifice(uint256 indexed epochId, address indexed wallet, uint256 amount, uint256 totalCommitted)"
);

export function startEventListener(): void {
  const address = config.SUMMONING_ENGINE_ADDRESS as `0x${string}`;

  console.log(`[EVENTS] Listening for RitualSacrifice on ${address}`);

  client.watchEvent({
    address,
    event: ritualSacrificeEvent,
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          const args = log.args as {
            epochId?: bigint;
            wallet?: string;
            amount?: bigint;
            totalCommitted?: bigint;
          };

          if (!args.epochId || !args.wallet || !args.amount) {
            console.warn("[EVENTS] Missing event args:", log);
            continue;
          }

          console.log(
            `[EVENTS] RitualSacrifice: epoch=${args.epochId} wallet=${args.wallet} amount=${args.amount}`
          );

          await processRitualSacrifice({
            epochId: Number(args.epochId),
            wallet: args.wallet,
            amount: args.amount,
            txHash: log.transactionHash!,
            blockNumber: Number(log.blockNumber),
          });
        } catch (err) {
          console.error("[EVENTS] Error processing sacrifice event:", err);
        }
      }
    },
    onError: (error) => {
      console.error("[EVENTS] Watch error:", error);
      // Reconnect after 5 seconds
      setTimeout(() => startEventListener(), 5000);
    },
  });
}
