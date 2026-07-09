import { describe, it, expect } from "vitest";
import { shouldResolve } from "../src/services/epochKeeper.js";

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
