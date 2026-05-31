import type { FastifyBaseLogger } from "fastify";
import type { ReminderServiceApi } from "../services/reminder-service.js";

export const DEFAULT_REMINDER_JOB_INTERVAL_MS = 15 * 60 * 1000;

export class ReminderJobRunner {
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private readonly reminders: ReminderServiceApi,
    private readonly logger: Pick<FastifyBaseLogger, "error" | "info">,
    private readonly intervalMs = DEFAULT_REMINDER_JOB_INTERVAL_MS,
  ) {}

  start() {
    if (this.interval) {
      return;
    }

    void this.runOnce();
    this.interval = setInterval(() => void this.runOnce(), this.intervalMs);
  }

  stop() {
    if (!this.interval) {
      return;
    }

    clearInterval(this.interval);
    this.interval = null;
  }

  async runOnce() {
    try {
      const result = await this.reminders.generateReminders();
      this.logger.info(
        {
          createdCount: result.createdCount,
          resolvedCount: result.resolvedCount,
        },
        "Closeout reminder generation completed",
      );
    } catch (error) {
      this.logger.error(error, "Closeout reminder generation failed");
    }
  }
}
