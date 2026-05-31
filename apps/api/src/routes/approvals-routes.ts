import {
  ApprovalFilterQuerySchema,
  ApprovalIdParamsSchema,
  CreateApprovalRequestSchema,
  EditApprovalRequestSchema,
  RejectApprovalRequestSchema,
} from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import {
  ApprovalNotFoundError,
  ApprovalNotPendingError,
  ApprovalRoleError,
  type ApprovalServiceApi,
} from "../services/approval-service.js";

export async function registerApprovalRoutes(
  app: FastifyInstance,
  approvalService?: ApprovalServiceApi,
) {
  function requireApprovalService() {
    if (!approvalService) {
      throw app.httpErrors.serviceUnavailable("Approval service unavailable");
    }

    return approvalService;
  }

  app.post("/approvals", async (request) => {
    const user = await app.requireUser(request);
    const body = CreateApprovalRequestSchema.parse(request.body);
    const approval = await requireApprovalService().createApproval(user, body);

    return { approval };
  });

  app.get("/approvals", async (request) => {
    await app.requireUser(request);
    const filters = ApprovalFilterQuerySchema.parse(request.query);
    const approvals = await requireApprovalService().listApprovals(filters);

    return { approvals };
  });

  app.patch("/approvals/:approvalId", async (request) => {
    const user = await app.requireUser(request);
    const { approvalId } = ApprovalIdParamsSchema.parse(request.params);
    const body = EditApprovalRequestSchema.parse(request.body);

    try {
      const approval = await requireApprovalService().editApproval(
        user,
        approvalId,
        body,
      );
      return { approval };
    } catch (error) {
      throw mapApprovalError(app, error);
    }
  });

  app.post("/approvals/:approvalId/approve", async (request) => {
    const user = await app.requireUser(request);
    const { approvalId } = ApprovalIdParamsSchema.parse(request.params);

    try {
      const approval = await requireApprovalService().approveApproval(
        user,
        approvalId,
      );
      return { approval };
    } catch (error) {
      throw mapApprovalError(app, error);
    }
  });

  app.post("/approvals/:approvalId/reject", async (request) => {
    const user = await app.requireUser(request);
    const { approvalId } = ApprovalIdParamsSchema.parse(request.params);
    const body = RejectApprovalRequestSchema.parse(request.body ?? {});

    try {
      const approval = await requireApprovalService().rejectApproval(
        user,
        approvalId,
        body,
      );
      return { approval };
    } catch (error) {
      throw mapApprovalError(app, error);
    }
  });

  app.post("/approvals/:approvalId/expire", async (request) => {
    const user = await app.requireUser(request);
    const { approvalId } = ApprovalIdParamsSchema.parse(request.params);

    try {
      const approval = await requireApprovalService().expireApproval(
        user,
        approvalId,
      );
      return { approval };
    } catch (error) {
      throw mapApprovalError(app, error);
    }
  });
}

function mapApprovalError(app: FastifyInstance, error: unknown) {
  if (error instanceof ApprovalNotFoundError) {
    return app.httpErrors.notFound("Approval not found");
  }

  if (error instanceof ApprovalNotPendingError) {
    return app.httpErrors.conflict("Approval is not pending");
  }

  if (error instanceof ApprovalRoleError) {
    return app.httpErrors.forbidden("Insufficient role");
  }

  return error;
}
