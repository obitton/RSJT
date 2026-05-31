import {
  JobMoneyIdParamsSchema,
  OverrideSplitCategoryRequestSchema,
  UpdateJobMoneyRequestSchema,
} from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import {
  JobMoneyNotFoundError,
  type JobMoneyServiceApi,
} from "../services/job-money-service.js";

export async function registerJobMoneyRoutes(
  app: FastifyInstance,
  jobMoneyService?: JobMoneyServiceApi,
) {
  function requireService() {
    if (!jobMoneyService) {
      throw app.httpErrors.serviceUnavailable("Job money service unavailable");
    }
    return jobMoneyService;
  }

  app.get("/jobs/:jobId/money", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    const { jobId } = JobMoneyIdParamsSchema.parse(request.params);
    try {
      return await requireService().getMoney(user, jobId);
    } catch (error) {
      throw mapJobMoneyError(app, error);
    }
  });

  app.patch("/jobs/:jobId/money", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    const { jobId } = JobMoneyIdParamsSchema.parse(request.params);
    const body = UpdateJobMoneyRequestSchema.parse(request.body ?? {});
    try {
      return await requireService().updateMoney(user, jobId, body);
    } catch (error) {
      throw mapJobMoneyError(app, error);
    }
  });

  app.post("/manager/jobs/:jobId/split-override", async (request) => {
    const user = await app.requireRole(request, ["manager"]);
    const { jobId } = JobMoneyIdParamsSchema.parse(request.params);
    const body = OverrideSplitCategoryRequestSchema.parse(request.body);
    try {
      return await requireService().overrideSplitCategory(user, jobId, body);
    } catch (error) {
      throw mapJobMoneyError(app, error);
    }
  });
}

function mapJobMoneyError(app: FastifyInstance, error: unknown) {
  if (error instanceof JobMoneyNotFoundError) {
    return app.httpErrors.notFound("Job money record not found");
  }
  return error;
}
