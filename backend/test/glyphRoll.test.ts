/**
 * Glyph roll determinism and distribution tests.
 *
 * CRITICAL: The glyph assignment must be deterministic.
 * The same txHash must ALWAYS produce the same glyph.
 */

import { describe, it, expect } from "vitest";
import { rollGlyphFromTxHash } from "../src/utils/glyphRoll.js";

describe("rollGlyphFromTxHash", () => {
  it("is deterministic — same hash always produces same result", () => {
    const txHash =
      "0xabc123def456789012345678901234567890123456789012345678901234abcd";

    const result1 = rollGlyphFromTxHash(txHash);
    const result2 = rollGlyphFromTxHash(txHash);

    expect(result1.tierName).toBe(result2.tierName);
    expect(result1.tierIndex).toBe(result2.tierIndex);
    expect(result1.rune).toBe(result2.rune);
    expect(result1.lore).toBe(result2.lore);
  });

  it("different hashes produce different results", () => {
    const hash1 =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    const hash2 =
      "0x2222222222222222222222222222222222222222222222222222222222222222";

    const result1 = rollGlyphFromTxHash(hash1);
    const result2 = rollGlyphFromTxHash(hash2);

    // Not guaranteed to be different for any two hashes,
    // but statistically near-certain for these specific values
    const areDifferent =
      result1.tierName !== result2.tierName ||
      result1.rune !== result2.rune ||
      result1.lore !== result2.lore;

    expect(areDifferent).toBe(true);
  });

  it("returns valid tier data", () => {
    const txHash =
      "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef";
    const result = rollGlyphFromTxHash(txHash);

    expect(["Whisper", "Echo", "Tremor", "Rupture", "Breach"]).toContain(
      result.tierName
    );
    expect(result.tierIndex).toBeGreaterThanOrEqual(0);
    expect(result.tierIndex).toBeLessThanOrEqual(4);
    expect(result.rune.length).toBeGreaterThan(0);
    expect(result.lore.length).toBeGreaterThan(0);
    expect(result.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });

  it("distribution approximately matches target rates over 10,000 rolls", () => {
    const counts: Record<string, number> = {
      Whisper: 0,
      Echo: 0,
      Tremor: 0,
      Rupture: 0,
      Breach: 0,
    };

    const N = 10000;
    for (let i = 0; i < N; i++) {
      // Generate unique "tx hashes" using index
      const hex = i.toString(16).padStart(64, "0");
      const txHash = `0x${hex}`;
      const result = rollGlyphFromTxHash(txHash);
      counts[result.tierName]++;
    }

    // Check within ±3% of target rates (generous margin for 10K samples)
    const targets: Record<string, number> = {
      Whisper: 0.5,
      Echo: 0.28,
      Tremor: 0.15,
      Rupture: 0.06,
      Breach: 0.01,
    };

    for (const [tier, target] of Object.entries(targets)) {
      const actual = counts[tier] / N;
      const tolerance = 0.03; // ±3%
      expect(actual).toBeGreaterThan(target - tolerance);
      expect(actual).toBeLessThan(target + tolerance);
    }
  });
});
