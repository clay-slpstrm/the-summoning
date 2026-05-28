/**
 * Backfill missed on-chain events at backend startup.
 *
 * Public-RPC filter expirations and backend downtime can drop GlyphMinted
 * events. On startup we scan a recent block range and re-process anything
 * missing from the DB. Idempotent thanks to handleGlyphMinted's findFirst
 * check on tokenId.
 */

import { createPublicClient, http, parseAbiItem, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { config } from "../config.js";
import { handleGlyphMinted } from "./glyphMintHandler.js";

const glyphMintedEvent = parseAbiItem(
  "event GlyphMinted(uint256 indexed tokenId, address indexed recipient, uint8 tier, uint8 runeIndex, uint8 loreIndex, uint256 epochId)"
);

// Chunk size is provider-dependent. Alchemy's free tier caps eth_getLogs at 10 blocks;
// paid tiers allow much larger. Configured via BACKFILL_CHUNK_SIZE.
const CHUNK_SIZE = config.BACKFILL_CHUNK_SIZE;

export async function backfillGlyphEvents(blockRange: number = config.BACKFILL_BLOCK_RANGE): Promise<void> {
  const address = config.ELDRITCH_GLYPHS_ADDRESS as `0x${string}`;
  if (!address) {
    console.log("[BACKFILL] ELDRITCH_GLYPHS_ADDRESS not set, skipping");
    return;
  }

  const client: PublicClient = createPublicClient({
    chain: sepolia,
    transport: http(config.RPC_URL),
  });

  const head = await client.getBlockNumber();
  const startBlock = head - BigInt(blockRange) > 0n ? head - BigInt(blockRange) : 0n;

  console.log(`[BACKFILL] Scanning GlyphMinted from block ${startBlock} to ${head}`);

  let totalLogs = 0;
  let totalProcessed = 0;

  for (let from = startBlock; from <= head; from += CHUNK_SIZE) {
    const to = from + CHUNK_SIZE - 1n > head ? head : from + CHUNK_SIZE - 1n;

    let logs;
    try {
      logs = await client.getLogs({
        address,
        event: glyphMintedEvent,
        fromBlock: from,
        toBlock: to,
      });
    } catch (err) {
      console.error(`[BACKFILL] getLogs failed for ${from}–${to}:`, (err as Error).message);
      continue;
    }

    totalLogs += logs.length;

    for (const log of logs) {
      const args = log.args;
      if (
        args.tokenId === undefined ||
        !args.recipient ||
        args.tier === undefined ||
        args.runeIndex === undefined ||
        args.loreIndex === undefined ||
        args.epochId === undefined ||
        !log.transactionHash ||
        log.blockNumber === null
      ) {
        continue;
      }

      try {
        await handleGlyphMinted({
          tokenId: Number(args.tokenId),
          recipient: args.recipient,
          tier: args.tier,
          runeIndex: args.runeIndex,
          loreIndex: args.loreIndex,
          epochId: Number(args.epochId),
          txHash: log.transactionHash,
          blockNumber: Number(log.blockNumber),
        });
        totalProcessed++;
      } catch (err) {
        console.error(`[BACKFILL] handleGlyphMinted failed for tokenId=${args.tokenId}:`, (err as Error).message);
      }
    }
  }

  console.log(`[BACKFILL] Done. Found ${totalLogs} events, processed ${totalProcessed}`);
}
