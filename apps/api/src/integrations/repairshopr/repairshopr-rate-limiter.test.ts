import { describe, expect, it } from "vitest";
import { RepairShoprRateLimiter } from "./repairshopr-rate-limiter.js";

describe("RepairShoprRateLimiter", () => {
  it("does not wait for the first 180 requests in a window", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new RepairShoprRateLimiter({
      now: () => now,
      sleep: async (delayMs) => {
        waits.push(delayMs);
        now += delayMs;
      },
    });

    for (let i = 0; i < 180; i += 1) {
      await limiter.waitForSlot();
    }

    expect(waits).toEqual([]);
  });

  it("waits for request 181 until the oldest request leaves the window", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new RepairShoprRateLimiter({
      now: () => now,
      sleep: async (delayMs) => {
        waits.push(delayMs);
        now += delayMs;
      },
    });

    for (let i = 0; i < 180; i += 1) {
      await limiter.waitForSlot();
    }
    await limiter.waitForSlot();

    expect(waits).toEqual([60000]);
  });

  it("prunes old timestamps when the clock advances", async () => {
    let now = 0;
    const waits: number[] = [];
    const limiter = new RepairShoprRateLimiter({
      now: () => now,
      sleep: async (delayMs) => {
        waits.push(delayMs);
        now += delayMs;
      },
    });

    for (let i = 0; i < 180; i += 1) {
      await limiter.waitForSlot();
    }

    now = 60001;
    await limiter.waitForSlot();

    expect(waits).toEqual([]);
  });
});
