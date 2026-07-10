import { describe, it, expect } from "vitest";
import { shouldResolve, suggestNextThreshold } from "../src/services/epochKeeper.js";

describe("epochKeeper shouldResolve", () => {
  const ritualEnd = 1_800_000_000n;

  it("does not resolve before ritualEnd", () => {
    expect(shouldResolve({ resolved: false, ritualEnd }, ritualEnd - 1n)).toBe(false);
  });

  it("resolves exactly at ritualEnd", () => {
    expect(shouldResolve({ resolved: false, ritualEnd }, ritualEnd)).toBe(true);
  });

  it("resolves after ritualEnd", () => {
    expect(shouldResolve({ resolved: false, ritualEnd }, ritualEnd + 3600n)).toBe(true);
  });

  it("never resolves an already-resolved epoch", () => {
    expect(shouldResolve({ resolved: true, ritualEnd }, ritualEnd + 3600n)).toBe(false);
  });
});

describe("epochKeeper suggestNextThreshold", () => {
  const RITUAL = 10n ** 18n;

  it("doubles on success", () => {
    expect(suggestNextThreshold(75_000n * RITUAL, true)).toBe(150_000n * RITUAL);
  });

  it("halves on failure", () => {
    expect(suggestNextThreshold(150_000n * RITUAL, false)).toBe(75_000n * RITUAL);
  });

  it("floors at 25k on failure", () => {
    expect(suggestNextThreshold(30_000n * RITUAL, false)).toBe(25_000n * RITUAL);
    expect(suggestNextThreshold(25_000n * RITUAL, false)).toBe(25_000n * RITUAL);
  });
});
