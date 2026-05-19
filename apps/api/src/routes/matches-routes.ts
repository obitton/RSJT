import {
  JobIdParamsSchema,
  MatchCandidateParamsSchema,
  MatchSearchRequestSchema,
} from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import {
  MatchCandidateNotFoundError,
  type MatchingServiceApi,
} from "../services/matching-service.js";

export async function registerMatchRoutes(
  app: FastifyInstance,
  matchingService?: MatchingServiceApi,
) {
  function requireMatchingService() {
    if (!matchingService) {
      throw app.httpErrors.serviceUnavailable("Matching service unavailable");
    }

    return matchingService;
  }

  app.get("/jobs/:jobId/matches", async (request) => {
    await app.requireUser(request);
    const { jobId } = JobIdParamsSchema.parse(request.params);

    return requireMatchingService().listJobMatches(jobId);
  });

  app.post("/jobs/:jobId/matches/search", async (request) => {
    await app.requireUser(request);
    const { jobId } = JobIdParamsSchema.parse(request.params);
    const { input } = MatchSearchRequestSchema.parse(request.body);

    return requireMatchingService().searchJobMatches(jobId, input);
  });

  app.post("/jobs/:jobId/matches/:candidateId/select", async (request) => {
    await app.requireUser(request);
    const { jobId, candidateId } = MatchCandidateParamsSchema.parse(
      request.params,
    );

    try {
      return await requireMatchingService().selectMatch(jobId, candidateId);
    } catch (error) {
      if (error instanceof MatchCandidateNotFoundError) {
        throw app.httpErrors.notFound("Match candidate not found");
      }

      throw error;
    }
  });

  app.delete("/jobs/:jobId/matches/selection", async (request) => {
    await app.requireUser(request);
    const { jobId } = JobIdParamsSchema.parse(request.params);

    return requireMatchingService().unlinkMatch(jobId);
  });
}
