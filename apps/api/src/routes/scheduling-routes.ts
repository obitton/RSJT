import {
  EditSchedulingProposalRequestSchema,
  RejectSchedulingProposalRequestSchema,
  SchedulingProposalIdParamsSchema,
} from "@rsjt/shared";
import type { FastifyInstance } from "fastify";
import {
  SchedulingProposalNotFoundError,
  SchedulingProposalNotPendingError,
  type SchedulingProposalServiceApi,
  UnsafeSchedulingWordingError,
} from "../services/scheduling-proposal-service.js";

export async function registerSchedulingRoutes(
  app: FastifyInstance,
  service?: SchedulingProposalServiceApi,
) {
  function requireService() {
    if (!service) {
      throw app.httpErrors.serviceUnavailable("Scheduling service unavailable");
    }
    return service;
  }

  app.get("/tech/scheduling/proposals", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    return requireService().listProposals(user);
  });

  app.get("/tech/scheduling/proposals/:proposalId", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    const { proposalId } = SchedulingProposalIdParamsSchema.parse(
      request.params,
    );
    const proposal = await requireService().getProposal(user, proposalId);
    if (!proposal) {
      throw app.httpErrors.notFound("Scheduling proposal not found");
    }
    return { proposal };
  });

  app.patch("/tech/scheduling/proposals/:proposalId", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    const { proposalId } = SchedulingProposalIdParamsSchema.parse(
      request.params,
    );
    const body = EditSchedulingProposalRequestSchema.parse(request.body);
    try {
      const proposal = await requireService().editProposal(
        user,
        proposalId,
        body,
      );
      return { proposal };
    } catch (error) {
      throw mapSchedulingError(app, error);
    }
  });

  app.post(
    "/tech/scheduling/proposals/:proposalId/approve",
    async (request) => {
      const user = await app.requireRole(request, ["tech", "manager"]);
      const { proposalId } = SchedulingProposalIdParamsSchema.parse(
        request.params,
      );
      try {
        const proposal = await requireService().approveProposal(
          user,
          proposalId,
        );
        return { proposal };
      } catch (error) {
        throw mapSchedulingError(app, error);
      }
    },
  );

  app.post("/tech/scheduling/proposals/:proposalId/reject", async (request) => {
    const user = await app.requireRole(request, ["tech", "manager"]);
    const { proposalId } = SchedulingProposalIdParamsSchema.parse(
      request.params,
    );
    const body = RejectSchedulingProposalRequestSchema.parse(
      request.body ?? {},
    );
    try {
      const proposal = await requireService().rejectProposal(
        user,
        proposalId,
        body,
      );
      return { proposal };
    } catch (error) {
      throw mapSchedulingError(app, error);
    }
  });
}

function mapSchedulingError(app: FastifyInstance, error: unknown) {
  if (error instanceof SchedulingProposalNotFoundError) {
    return app.httpErrors.notFound("Scheduling proposal not found");
  }
  if (error instanceof SchedulingProposalNotPendingError) {
    return app.httpErrors.conflict("Scheduling proposal is not pending");
  }
  if (error instanceof UnsafeSchedulingWordingError) {
    return app.httpErrors.badRequest(error.message);
  }
  return error;
}
