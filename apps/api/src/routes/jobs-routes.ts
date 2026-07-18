import { CancelJobRequestSchema, JobIdParamsSchema } from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import {
  type JobCancellationServiceApi,
  JobNotCancelableError,
  JobNotFoundError,
} from "../services/job-cancellation-service.js";
import type { JobUpdateFeedServiceApi } from "../services/job-update-feed-service.js";

export async function registerJobsRoutes(
  app: FastifyInstance,
  jobUpdateFeedService?: JobUpdateFeedServiceApi,
  jobCancellationService?: JobCancellationServiceApi,
) {
  function requireJobUpdateFeedService() {
    if (!jobUpdateFeedService) {
      throw app.httpErrors.serviceUnavailable(
        "Job update feed service unavailable",
      );
    }

    return jobUpdateFeedService;
  }

  function requireJobCancellationService() {
    if (!jobCancellationService) {
      throw app.httpErrors.serviceUnavailable(
        "Job cancellation service unavailable",
      );
    }

    return jobCancellationService;
  }

  app.get("/jobs/update-feed", async (request) => {
    await app.requireUser(request);

    return requireJobUpdateFeedService().listUpdateFeed();
  });

  app.post("/jobs/:jobId/cancel", async (request) => {
    // Both techs and managers can cancel a job; a tech does not need a
    // manager's approval.
    const user = await app.requireRole(request, ["tech", "manager"]);
    const { jobId } = JobIdParamsSchema.parse(request.params);
    const { reason } = CancelJobRequestSchema.parse(request.body);

    try {
      const job = await requireJobCancellationService().cancelJob(
        user,
        jobId,
        reason,
      );
      return { job };
    } catch (error) {
      throw mapCancellationError(app, error);
    }
  });
}

function mapCancellationError(app: FastifyInstance, error: unknown) {
  if (error instanceof JobNotFoundError) {
    return app.httpErrors.notFound("Job not found");
  }
  if (error instanceof JobNotCancelableError) {
    return app.httpErrors.conflict("This job can no longer be canceled");
  }
  return error;
}
