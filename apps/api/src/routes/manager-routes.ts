import {
  CustomerIntakeDetailParamsSchema,
  ManagerJobDetailParamsSchema,
  ManagerLeadDetailParamsSchema,
} from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import type { CustomerIntakeStateMachineServiceApi } from "../services/customer-intake-state-machine-service.js";
import type { ManagerDashboardServiceApi } from "../services/manager-dashboard-service.js";

export type ManagerRoutesOptions = {
  intakeService?: CustomerIntakeStateMachineServiceApi | undefined;
};

export async function registerManagerRoutes(
  app: FastifyInstance,
  managerDashboardService?: ManagerDashboardServiceApi,
  options: ManagerRoutesOptions = {},
) {
  function requireService() {
    if (!managerDashboardService) {
      throw app.httpErrors.serviceUnavailable(
        "Manager dashboard service unavailable",
      );
    }

    return managerDashboardService;
  }

  function requireIntakeService() {
    if (!options.intakeService) {
      throw app.httpErrors.serviceUnavailable(
        "Customer intake service unavailable",
      );
    }
    return options.intakeService;
  }

  app.get("/manager/dashboard", async (request) => {
    await app.requireRole(request, ["manager"]);
    return requireService().getDashboard();
  });

  app.get("/manager/jobs/:jobId", async (request) => {
    await app.requireRole(request, ["manager"]);
    const { jobId } = ManagerJobDetailParamsSchema.parse(request.params);
    const detail = await requireService().getJobDetail(jobId);

    if (!detail) {
      throw app.httpErrors.notFound("Job not found");
    }

    return detail;
  });

  app.get("/manager/conversations/:conversationId/lead", async (request) => {
    await app.requireRole(request, ["manager"]);
    const { conversationId } = ManagerLeadDetailParamsSchema.parse(
      request.params,
    );
    const detail = await requireService().getLeadDetail(conversationId);

    if (!detail) {
      throw app.httpErrors.notFound("Lead not found");
    }

    return detail;
  });

  app.get("/manager/conversations/:conversationId/intake", async (request) => {
    await app.requireRole(request, ["manager"]);
    const { conversationId } = CustomerIntakeDetailParamsSchema.parse(
      request.params,
    );
    const snapshot =
      await requireIntakeService().getConversationSnapshot(conversationId);

    if (!snapshot) {
      throw app.httpErrors.notFound("Conversation not found");
    }

    return { snapshot };
  });
}
