import { JobIdParamsSchema, UpdateExtractionRequestSchema } from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import type { UpdateExtractionServiceApi } from "../services/update-extraction-service.js";

export async function registerUpdateRoutes(
  app: FastifyInstance,
  updateExtractionService?: UpdateExtractionServiceApi,
) {
  function requireUpdateExtractionService() {
    if (!updateExtractionService) {
      throw app.httpErrors.serviceUnavailable(
        "Update extraction service unavailable",
      );
    }

    return updateExtractionService;
  }

  app.post("/jobs/:jobId/updates/extract", async (request) => {
    const user = await app.requireUser(request);
    const { jobId } = JobIdParamsSchema.parse(request.params);
    const { body } = UpdateExtractionRequestSchema.parse(request.body);

    return requireUpdateExtractionService().extractJobUpdate({
      jobId,
      authorRole: user.role,
      body,
    });
  });
}
