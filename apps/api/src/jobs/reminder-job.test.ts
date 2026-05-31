import { describe, expect, it, vi } from "vitest";
import { ReminderJobRunner } from "./reminder-job.js";

describe("ReminderJobRunner", () => {
  it("runs reminder generation once and logs the result", async () => {
    const reminders = {
      generateReminders: vi.fn().mockResolvedValue({
        createdCount: 2,
        resolvedCount: 1,
        reminders: [],
      }),
      listReminders: vi.fn(),
      listStaleReminders: vi.fn(),
      resolveReminder: vi.fn(),
    };
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
    };
    const runner = new ReminderJobRunner(reminders, logger);

    await runner.runOnce();

    expect(reminders.generateReminders).toHaveBeenCalledTimes(1);
    expect(logger.info).toHaveBeenCalledWith(
      { createdCount: 2, resolvedCount: 1 },
      "Closeout reminder generation completed",
    );
  });

  it("logs generation failures without throwing", async () => {
    const error = new Error("database unavailable");
    const reminders = {
      generateReminders: vi.fn().mockRejectedValue(error),
      listReminders: vi.fn(),
      listStaleReminders: vi.fn(),
      resolveReminder: vi.fn(),
    };
    const logger = {
      error: vi.fn(),
      info: vi.fn(),
    };
    const runner = new ReminderJobRunner(reminders, logger);

    await runner.runOnce();

    expect(logger.error).toHaveBeenCalledWith(
      error,
      "Closeout reminder generation failed",
    );
  });
});
