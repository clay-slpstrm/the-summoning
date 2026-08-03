import { describe, it, expect } from "vitest";
import { validateMessages, checkRateLimit } from "../src/services/herald.js";

describe("herald validateMessages", () => {
  it("rejects empty / non-array", () => {
    expect(validateMessages(undefined)).toBeNull();
    expect(validateMessages([])).toBeNull();
    expect(validateMessages("hi")).toBeNull();
  });

  it("rejects a history not ending in a user turn", () => {
    expect(
      validateMessages([{ role: "assistant", content: "hello" }])
    ).toBeNull();
  });

  it("rejects bad roles and empty content", () => {
    expect(validateMessages([{ role: "system", content: "x" }])).toBeNull();
    expect(validateMessages([{ role: "user", content: "   " }])).toBeNull();
  });

  it("accepts a valid conversation and truncates long content", () => {
    const long = "a".repeat(2000);
    const out = validateMessages([
      { role: "user", content: "what are glyphs?" },
      { role: "assistant", content: "Rolls of fate." },
      { role: "user", content: long },
    ]);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(3);
    expect(out![2].content.length).toBe(500);
  });
});

describe("herald checkRateLimit", () => {
  it("allows up to the per-minute cap then blocks", () => {
    const ip = "1.2.3.4";
    const t = 1_000_000;
    let allowed = 0;
    for (let i = 0; i < 10; i++) {
      if (checkRateLimit(ip, t + i)) allowed++;
    }
    // default cap is 6/min
    expect(allowed).toBe(6);
  });

  it("resets after the window slides", () => {
    const ip = "5.6.7.8";
    const t = 2_000_000;
    for (let i = 0; i < 6; i++) checkRateLimit(ip, t);
    expect(checkRateLimit(ip, t)).toBe(false);
    expect(checkRateLimit(ip, t + 61_000)).toBe(true);
  });
});
