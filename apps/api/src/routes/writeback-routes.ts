import {
  WritebackApprovalExecuteParamsSchema,
  WritebackExecutionIdParamsSchema,
  WritebackExecutionListQuerySchema,
} from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import {
  InvalidWritebackPayloadError,
  WritebackApprovalNotApprovedError,
  WritebackApprovalNotFoundError,
  WritebackExecutionNotFoundError,
  WritebackExecutionNotRetryableError,
  type WritebackExecutionServiceApi,
} from "../services/writeback-execution-service.js";

export async function registerWritebackRoutes(
  app: FastifyInstance,
  writebackExecutionService?: WritebackExecutionServiceApi,
) {
  function requireService() {
    if (!writebackExecutionService) {
      throw app.httpErrors.serviceUnavailable("Writeback service unavailable");
    }
    return writebackExecutionService;
  }

  app.get("/writebacks", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    const filters = WritebackExecutionListQuerySchema.parse(request.query);
    const executions = await requireService().listExecutions(user, filters);
    return { executions };
  });

  app.post("/writebacks/approvals/:approvalId/execute", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    const { approvalId } = WritebackApprovalExecuteParamsSchema.parse(
      request.params,
    );

    try {
      const execution = await requireService().executeApprovedApproval(
        user,
        approvalId,
      );
      return { execution };
    } catch (error) {
      throw mapWritebackError(app, error);
    }
  });

  app.post("/writebacks/:executionId/retry", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    const { executionId } = WritebackExecutionIdParamsSchema.parse(
      request.params,
    );

    try {
      const execution = await requireService().retryExecution(
        user,
        executionId,
      );
      return { execution };
    } catch (error) {
      throw mapWritebackError(app, error);
    }
  });
}

function mapWritebackError(app: FastifyInstance, error: unknown) {
  if (
    error instanceof WritebackApprovalNotFoundError ||
    error instanceof WritebackExecutionNotFoundError
  ) {
    return app.httpErrors.notFound(error.message);
  }

  if (
    error instanceof WritebackApprovalNotApprovedError ||
    error instanceof WritebackExecutionNotRetryableError
  ) {
    return app.httpErrors.conflict(error.message);
  }

  if (error instanceof InvalidWritebackPayloadError) {
    return app.httpErrors.badRequest(error.message);
  }

  return error;
}
