import type { FastifyInstance } from "fastify";
import type { JobUpdateFeedServiceApi } from "../services/job-update-feed-service.js";

export async function registerJobsRoutes(
  app: FastifyInstance,
  jobUpdateFeedService?: JobUpdateFeedServiceApi,
) {
  function requireJobUpdateFeedService() {
    if (!jobUpdateFeedService) {
      throw app.httpErrors.serviceUnavailable(
        "Job update feed service unavailable",
      );
    }

    return jobUpdateFeedService;
  }

  app.get("/jobs/update-feed", async (request) => {
    await app.requireUser(request);

    return requireJobUpdateFeedService().listUpdateFeed();
  });
}
