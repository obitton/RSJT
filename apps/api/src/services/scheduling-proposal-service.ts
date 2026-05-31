import type {
  ApprovalRecord,
  CreateApprovalRequest,
  EditSchedulingProposalRequest,
  RejectSchedulingProposalRequest,
  RepairShoprAppointmentPayload,
  SchedulingProposal,
  SessionUser,
  SourceEvidence,
} from "@rsjt/shared";
import { containsUnsafeCommitment } from "@rsjt/shared";
import type {
  EditSchedulingProposalPatch,
  ListSchedulingFilters,
} from "../repositories/scheduling-proposals-repository.js";

export interface SchedulingProposalStore {
  create(input: {
    conversationId: string;
    jobId: string | null;
    preferredWindowText: string;
    startAt: Date | null;
    endAt: Date | null;
    customerMessageBody: string;
    repairShoprAppointmentPayload: RepairShoprAppointmentPayload;
    sourceEvidence: SourceEvidence[];
    customerMessageApprovalId: string | null;
    appointmentApprovalId: string | null;
  }): Promise<SchedulingProposal>;
  list(filters?: ListSchedulingFilters): Promise<{
    pending: SchedulingProposal[];
    decided: SchedulingProposal[];
  }>;
  getById(proposalId: string): Promise<SchedulingProposal | null>;
  updatePending(
    proposalId: string,
    patch: EditSchedulingProposalPatch,
  ): Promise<SchedulingProposal | null>;
  setState(input: {
    proposalId: string;
    state: "approved" | "rejected" | "expired";
    actorUserId: string;
  }): Promise<SchedulingProposal | null>;
}

export interface SchedulingApprovalService {
  createApproval(
    user: SessionUser,
    input: CreateApprovalRequest,
  ): Promise<ApprovalRecord>;
  approveApproval(
    user: SessionUser,
    approvalId: string,
  ): Promise<ApprovalRecord>;
  rejectApproval(
    user: SessionUser,
    approvalId: string,
    input: { reason?: string },
  ): Promise<ApprovalRecord>;
}

export type GenerateFromConversationInput = {
  conversationId: string;
  jobId: string | null;
  preferredWindowText: string;
  startAt: Date | null;
  endAt: Date | null;
  customerMessageBody: string;
  appointmentNotes?: string;
  sourceEvidence: SourceEvidence[];
};

export interface SchedulingProposalServiceApi {
  generateFromConversation(
    user: SessionUser,
    input: GenerateFromConversationInput,
  ): Promise<SchedulingProposal>;
  listProposals(user: SessionUser): Promise<{
    pending: SchedulingProposal[];
    decided: SchedulingProposal[];
  }>;
  getProposal(
    user: SessionUser,
    proposalId: string,
  ): Promise<SchedulingProposal | null>;
  editProposal(
    user: SessionUser,
    proposalId: string,
    input: EditSchedulingProposalRequest,
  ): Promise<SchedulingProposal>;
  approveProposal(
    user: SessionUser,
    proposalId: string,
  ): Promise<SchedulingProposal>;
  rejectProposal(
    user: SessionUser,
    proposalId: string,
    input: RejectSchedulingProposalRequest,
  ): Promise<SchedulingProposal>;
}

export class SchedulingProposalNotFoundError extends Error {
  constructor() {
    super("Scheduling proposal not found");
  }
}

export class SchedulingProposalNotPendingError extends Error {
  constructor() {
    super("Scheduling proposal is not pending");
  }
}

export class UnsafeSchedulingWordingError extends Error {}

export class SchedulingProposalService implements SchedulingProposalServiceApi {
  constructor(
    private readonly store: SchedulingProposalStore,
    private readonly approvalService: SchedulingApprovalService,
  ) {}

  async generateFromConversation(
    user: SessionUser,
    input: GenerateFromConversationInput,
  ): Promise<SchedulingProposal> {
    if (input.sourceEvidence.length === 0) {
      throw new Error("Scheduling proposals require source evidence");
    }
    if (containsUnsafeCommitment(input.customerMessageBody)) {
      throw new UnsafeSchedulingWordingError(
        "Proposed wording must not confirm availability before approval",
      );
    }

    const appointmentPayload: RepairShoprAppointmentPayload = {
      ...(input.appointmentNotes ? { notes: input.appointmentNotes } : {}),
      status: "staged",
    };

    const customerMessageApproval = await this.approvalService.createApproval(
      user,
      {
        kind: "customer_message",
        risk: "scheduling",
        requiredRole: "tech",
        payload: {
          conversationId: input.conversationId,
          jobId: input.jobId,
          body: input.customerMessageBody,
          preferredWindowText: input.preferredWindowText,
        },
        evidence: input.sourceEvidence,
      },
    );

    const appointmentApproval = await this.approvalService.createApproval(
      user,
      {
        kind: "appointment_creation",
        risk: "scheduling",
        requiredRole: "tech",
        payload: {
          conversationId: input.conversationId,
          jobId: input.jobId,
          appointment: appointmentPayload,
          preferredWindowText: input.preferredWindowText,
        },
        evidence: input.sourceEvidence,
      },
    );

    return this.store.create({
      conversationId: input.conversationId,
      jobId: input.jobId,
      preferredWindowText: input.preferredWindowText,
      startAt: input.startAt,
      endAt: input.endAt,
      customerMessageBody: input.customerMessageBody,
      repairShoprAppointmentPayload: appointmentPayload,
      sourceEvidence: input.sourceEvidence,
      customerMessageApprovalId: customerMessageApproval.id,
      appointmentApprovalId: appointmentApproval.id,
    });
  }

  async listProposals(_user: SessionUser) {
    return this.store.list();
  }

  async getProposal(_user: SessionUser, proposalId: string) {
    return this.store.getById(proposalId);
  }

  async editProposal(
    _user: SessionUser,
    proposalId: string,
    input: EditSchedulingProposalRequest,
  ): Promise<SchedulingProposal> {
    const proposal = await this.requirePendingProposal(proposalId);

    const nextWording =
      input.customerMessageBody ?? proposal.customerMessageBody;
    if (containsUnsafeCommitment(nextWording)) {
      throw new UnsafeSchedulingWordingError(
        "Edited wording must not confirm availability before approval",
      );
    }

    const patch: EditSchedulingProposalPatch = {};
    if (input.preferredWindowText !== undefined) {
      patch.preferredWindowText = input.preferredWindowText;
    }
    if (input.customerMessageBody !== undefined) {
      patch.customerMessageBody = input.customerMessageBody;
    }
    const updated = await this.store.updatePending(proposalId, patch);
    if (!updated) {
      throw new SchedulingProposalNotPendingError();
    }
    return updated;
  }

  async approveProposal(
    user: SessionUser,
    proposalId: string,
  ): Promise<SchedulingProposal> {
    const proposal = await this.requirePendingProposal(proposalId);
    if (containsUnsafeCommitment(proposal.customerMessageBody)) {
      throw new UnsafeSchedulingWordingError(
        "Edit unsafe wording before approving the scheduling proposal",
      );
    }

    if (proposal.customerMessageApprovalId) {
      await this.approvalService.approveApproval(
        user,
        proposal.customerMessageApprovalId,
      );
    }
    if (proposal.appointmentApprovalId) {
      await this.approvalService.approveApproval(
        user,
        proposal.appointmentApprovalId,
      );
    }

    const updated = await this.store.setState({
      proposalId,
      state: "approved",
      actorUserId: user.id,
    });
    if (!updated) {
      throw new SchedulingProposalNotPendingError();
    }
    return updated;
  }

  async rejectProposal(
    user: SessionUser,
    proposalId: string,
    input: RejectSchedulingProposalRequest,
  ): Promise<SchedulingProposal> {
    const proposal = await this.requirePendingProposal(proposalId);
    const rejectInput = input.reason ? { reason: input.reason } : {};

    if (proposal.customerMessageApprovalId) {
      await this.approvalService.rejectApproval(
        user,
        proposal.customerMessageApprovalId,
        rejectInput,
      );
    }
    if (proposal.appointmentApprovalId) {
      await this.approvalService.rejectApproval(
        user,
        proposal.appointmentApprovalId,
        rejectInput,
      );
    }

    const updated = await this.store.setState({
      proposalId,
      state: "rejected",
      actorUserId: user.id,
    });
    if (!updated) {
      throw new SchedulingProposalNotPendingError();
    }
    return updated;
  }

  private async requirePendingProposal(
    proposalId: string,
  ): Promise<SchedulingProposal> {
    const proposal = await this.store.getById(proposalId);
    if (!proposal) {
      throw new SchedulingProposalNotFoundError();
    }
    if (proposal.state !== "pending") {
      throw new SchedulingProposalNotPendingError();
    }
    return proposal;
  }
}
