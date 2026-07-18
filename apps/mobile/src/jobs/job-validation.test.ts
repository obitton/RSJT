import { describe, expect, it } from "vitest";
import { toCancelJobResponse, toJobSummary } from "./job-validation";

const jobId = "00000000-0000-4000-8000-0000000b0001";

describe("toCancelJobResponse", () => {
  it("parses a canceled job with its reason and canceled time", () => {
    const result = toCancelJobResponse({
      job: {
        id: jobId,
        state: "canceled",
        customerLabel: "Canceled tune-up",
        cancelReason: "Customer replaced the device",
        canceledAt: "2026-05-23T12:00:00.000Z",
      },
    });

    expect(result?.job.state).toBe("canceled");
    expect(result?.job.cancelReason).toBe("Customer replaced the device");
    expect(result?.job.canceledAt).toEqual(
      new Date("2026-05-23T12:00:00.000Z"),
    );
  });

  it("returns null when the job is missing or invalid", () => {
    expect(toCancelJobResponse({})).toBeNull();
    expect(
      toCancelJobResponse({ job: { id: jobId, state: "fictional" } }),
    ).toBeNull();
  });
});

describe("toJobSummary cancel fields", () => {
  it("omits cancel fields when they are absent", () => {
    const job = toJobSummary({ id: jobId, state: "scheduled" });

    expect(job).not.toBeNull();
    expect(job?.cancelReason).toBeUndefined();
    expect(job?.canceledAt).toBeUndefined();
  });

  it("rejects a job with an unparseable canceledAt", () => {
    expect(
      toJobSummary({ id: jobId, state: "canceled", canceledAt: "not-a-date" }),
    ).toBeNull();
  });
});
