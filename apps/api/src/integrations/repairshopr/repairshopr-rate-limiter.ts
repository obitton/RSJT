type RateLimiterOptions = {
  limit?: number;
  windowMs?: number;
  now?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
};

export class RepairShoprRateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly sleep: (delayMs: number) => Promise<void>;
  private requestTimestamps: number[] = [];

  constructor(options: RateLimiterOptions = {}) {
    this.limit = options.limit ?? 180;
    this.windowMs = options.windowMs ?? 60_000;
    this.now = options.now ?? Date.now;
    this.sleep =
      options.sleep ??
      ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  }

  async waitForSlot() {
    this.prune();

    if (this.requestTimestamps.length >= this.limit) {
      const oldestTimestamp = this.requestTimestamps[0];
      if (oldestTimestamp !== undefined) {
        const delayMs = oldestTimestamp + this.windowMs - this.now();
        if (delayMs > 0) {
          await this.sleep(delayMs);
        }
        this.prune();
      }
    }

    this.requestTimestamps.push(this.now());
  }

  private prune() {
    const cutoff = this.now() - this.windowMs;
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => timestamp > cutoff,
    );
  }
}
