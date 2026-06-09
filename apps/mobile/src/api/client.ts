import {
  isRecord,
  toLoginResponse,
  toSessionUser,
} from "@/auth/session-validation";
import {
  toContactCardPreviewResponse,
  toContactCardVcardResponse,
} from "@/contact-cards/contact-card-validation";
import {
  toConversationDetailResponse,
  toConversationListResponse,
  toSendConversationMessageResponse,
} from "@/conversations/conversation-validation";
import {
  toManagerDashboardResponse,
  toManagerJobDetailResponse,
  toManagerLeadDetailResponse,
} from "@/dashboard/dashboard-validation";
import {
  toJobUpdateFeedResponse,
  toUpdateExtractionResponse,
} from "@/jobs/job-validation";
import { toJobMoneyResponse } from "@/money/money-validation";
import {
  toReminderGenerationResponse,
  toReminderListResponse,
  toResolveReminderResponse,
} from "@/reminders/reminder-validation";
import {
  toSchedulingDecisionResponse,
  toSchedulingProposalDetailResponse,
  toSchedulingProposalListResponse,
} from "@/scheduling/scheduling-validation";
import {
  toWritebackExecutionListResponse,
  toWritebackExecutionResponse,
} from "@/writebacks/writeback-validation";
import type {
  ContactCardPreviewResponse,
  ContactCardVcardResponse,
  ConversationDetailResponse,
  ConversationListResponse,
  EditSchedulingProposalRequest,
  JobMoneyResponse,
  JobUpdateFeedResponse,
  LoginRequest,
  LoginResponse,
  ManagerDashboardResponse,
  ManagerJobDetailResponse,
  ManagerLeadDetailResponse,
  OverrideSplitCategoryRequest,
  RejectSchedulingProposalRequest,
  ReminderGenerationResponse,
  ReminderListResponse,
  ResolveReminderResponse,
  SchedulingDecisionResponse,
  SchedulingProposalDetailResponse,
  SchedulingProposalListResponse,
  SendConversationMessageRequest,
  SendConversationMessageResponse,
  SessionUser,
  SetTakeoverRequest,
  UpdateExtractionRequest,
  UpdateExtractionResponse,
  UpdateJobMoneyRequest,
  WritebackExecutionListQuery,
  WritebackExecutionListResponse,
  WritebackExecutionResponse,
} from "@rsjt/shared";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:47630";

export type AuthSessionResponse = {
  user: SessionUser;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly payload: unknown,
  ) {
    super(message);
  }
}

export type ApiClient = {
  login: (input: LoginRequest) => Promise<LoginResponse>;
  getSession: (token: string) => Promise<AuthSessionResponse>;
  logout: (token: string) => Promise<void>;
  getJobUpdateFeed: (token: string) => Promise<JobUpdateFeedResponse>;
  getJobMoney: (token: string, jobId: string) => Promise<JobMoneyResponse>;
  updateJobMoney: (
    token: string,
    jobId: string,
    input: UpdateJobMoneyRequest,
  ) => Promise<JobMoneyResponse>;
  overrideJobSplitCategory: (
    token: string,
    jobId: string,
    input: OverrideSplitCategoryRequest,
  ) => Promise<JobMoneyResponse>;
  listReminders: (token: string) => Promise<ReminderListResponse>;
  generateReminders: (token: string) => Promise<ReminderGenerationResponse>;
  resolveReminder: (
    token: string,
    reminderId: string,
  ) => Promise<ResolveReminderResponse>;
  listStaleReminders: (token: string) => Promise<ReminderListResponse>;
  extractJobUpdate: (
    token: string,
    jobId: string,
    input: UpdateExtractionRequest,
  ) => Promise<UpdateExtractionResponse>;
  getManagerDashboard: (token: string) => Promise<ManagerDashboardResponse>;
  getManagerJobDetail: (
    token: string,
    jobId: string,
  ) => Promise<ManagerJobDetailResponse>;
  getManagerLeadDetail: (
    token: string,
    conversationId: string,
  ) => Promise<ManagerLeadDetailResponse>;
  getContactCardPreview: (
    token: string,
    conversationId: string,
  ) => Promise<ContactCardPreviewResponse>;
  getContactCardVcard: (
    token: string,
    conversationId: string,
  ) => Promise<ContactCardVcardResponse>;
  listTechConversations: (token: string) => Promise<ConversationListResponse>;
  getTechConversation: (
    token: string,
    conversationId: string,
  ) => Promise<ConversationDetailResponse>;
  setConversationTakeover: (
    token: string,
    conversationId: string,
    input: SetTakeoverRequest,
  ) => Promise<ConversationDetailResponse>;
  sendConversationMessage: (
    token: string,
    conversationId: string,
    input: SendConversationMessageRequest,
  ) => Promise<SendConversationMessageResponse>;
  listSchedulingProposals: (
    token: string,
  ) => Promise<SchedulingProposalListResponse>;
  getSchedulingProposal: (
    token: string,
    proposalId: string,
  ) => Promise<SchedulingProposalDetailResponse>;
  editSchedulingProposal: (
    token: string,
    proposalId: string,
    input: EditSchedulingProposalRequest,
  ) => Promise<SchedulingProposalDetailResponse>;
  approveSchedulingProposal: (
    token: string,
    proposalId: string,
  ) => Promise<SchedulingDecisionResponse>;
  rejectSchedulingProposal: (
    token: string,
    proposalId: string,
    input: RejectSchedulingProposalRequest,
  ) => Promise<SchedulingDecisionResponse>;
  listWritebackExecutions: (
    token: string,
    filters?: WritebackExecutionListQuery,
  ) => Promise<WritebackExecutionListResponse>;
  executeApprovedWriteback: (
    token: string,
    approvalId: string,
  ) => Promise<WritebackExecutionResponse>;
  retryWritebackExecution: (
    token: string,
    executionId: string,
  ) => Promise<WritebackExecutionResponse>;
};

export function createApiClient(
  baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL,
): ApiClient {
  const apiBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    login: async (input) => {
      return requestJson({
        apiBaseUrl,
        path: "/auth/login",
        method: "POST",
        body: input,
        parse: parseLoginResponse,
      });
    },
    getSession: async (token) =>
      requestJson({
        apiBaseUrl,
        path: "/auth/session",
        method: "GET",
        token,
        parse: parseAuthSessionResponse,
      }),
    logout: async (token) => {
      await requestNoContent({
        apiBaseUrl,
        path: "/auth/logout",
        method: "POST",
        token,
      });
    },
    getJobUpdateFeed: async (token) =>
      requestJson({
        apiBaseUrl,
        path: "/jobs/update-feed",
        method: "GET",
        token,
        parse: parseJobUpdateFeedResponse,
      }),
    getJobMoney: async (token, jobId) =>
      requestJson({
        apiBaseUrl,
        path: `/jobs/${encodeURIComponent(jobId)}/money`,
        method: "GET",
        token,
        parse: parseJobMoneyResponse,
      }),
    updateJobMoney: async (token, jobId, input) =>
      requestJson({
        apiBaseUrl,
        path: `/jobs/${encodeURIComponent(jobId)}/money`,
        method: "PATCH",
        token,
        body: input,
        parse: parseJobMoneyResponse,
      }),
    overrideJobSplitCategory: async (token, jobId, input) =>
      requestJson({
        apiBaseUrl,
        path: `/manager/jobs/${encodeURIComponent(jobId)}/split-override`,
        method: "POST",
        token,
        body: input,
        parse: parseJobMoneyResponse,
      }),
    listReminders: async (token) =>
      requestJson({
        apiBaseUrl,
        path: "/reminders",
        method: "GET",
        token,
        parse: parseReminderListResponse,
      }),
    generateReminders: async (token) =>
      requestJson({
        apiBaseUrl,
        path: "/reminders/generate",
        method: "POST",
        token,
        parse: parseReminderGenerationResponse,
      }),
    resolveReminder: async (token, reminderId) =>
      requestJson({
        apiBaseUrl,
        path: `/reminders/${encodeURIComponent(reminderId)}/resolve`,
        method: "POST",
        token,
        parse: parseResolveReminderResponse,
      }),
    listStaleReminders: async (token) =>
      requestJson({
        apiBaseUrl,
        path: "/manager/reminders/stale",
        method: "GET",
        token,
        parse: parseReminderListResponse,
      }),
    extractJobUpdate: async (token, jobId, input) =>
      requestJson({
        apiBaseUrl,
        path: `/jobs/${encodeURIComponent(jobId)}/updates/extract`,
        method: "POST",
        token,
        body: input,
        parse: parseUpdateExtractionResponse,
      }),
    getManagerDashboard: async (token) =>
      requestJson({
        apiBaseUrl,
        path: "/manager/dashboard",
        method: "GET",
        token,
        parse: parseManagerDashboardResponse,
      }),
    getManagerJobDetail: async (token, jobId) =>
      requestJson({
        apiBaseUrl,
        path: `/manager/jobs/${encodeURIComponent(jobId)}`,
        method: "GET",
        token,
        parse: parseManagerJobDetailResponse,
      }),
    getManagerLeadDetail: async (token, conversationId) =>
      requestJson({
        apiBaseUrl,
        path: `/manager/conversations/${encodeURIComponent(
          conversationId,
        )}/lead`,
        method: "GET",
        token,
        parse: parseManagerLeadDetailResponse,
      }),
    getContactCardPreview: async (token, conversationId) =>
      requestJson({
        apiBaseUrl,
        path: `/manager/conversations/${encodeURIComponent(
          conversationId,
        )}/contact-card/preview`,
        method: "GET",
        token,
        parse: parseContactCardPreviewResponse,
      }),
    getContactCardVcard: async (token, conversationId) =>
      requestText({
        apiBaseUrl,
        path: `/manager/conversations/${encodeURIComponent(
          conversationId,
        )}/contact-card`,
        token,
        parse: parseContactCardVcardResponse,
      }),
    listTechConversations: async (token) =>
      requestJson({
        apiBaseUrl,
        path: "/tech/conversations",
        method: "GET",
        token,
        parse: parseConversationListResponse,
      }),
    getTechConversation: async (token, conversationId) =>
      requestJson({
        apiBaseUrl,
        path: `/tech/conversations/${encodeURIComponent(conversationId)}`,
        method: "GET",
        token,
        parse: parseConversationDetailResponse,
      }),
    setConversationTakeover: async (token, conversationId, input) =>
      requestJson({
        apiBaseUrl,
        path: `/tech/conversations/${encodeURIComponent(conversationId)}/takeover`,
        method: "POST",
        token,
        body: input,
        parse: parseConversationDetailResponse,
      }),
    sendConversationMessage: async (token, conversationId, input) =>
      requestJson({
        apiBaseUrl,
        path: `/tech/conversations/${encodeURIComponent(conversationId)}/messages`,
        method: "POST",
        token,
        body: input,
        parse: parseSendConversationMessageResponse,
      }),
    listSchedulingProposals: async (token) =>
      requestJson({
        apiBaseUrl,
        path: "/tech/scheduling/proposals",
        method: "GET",
        token,
        parse: parseSchedulingProposalListResponse,
      }),
    getSchedulingProposal: async (token, proposalId) =>
      requestJson({
        apiBaseUrl,
        path: `/tech/scheduling/proposals/${encodeURIComponent(proposalId)}`,
        method: "GET",
        token,
        parse: parseSchedulingProposalDetailResponse,
      }),
    editSchedulingProposal: async (token, proposalId, input) =>
      requestJson({
        apiBaseUrl,
        path: `/tech/scheduling/proposals/${encodeURIComponent(proposalId)}`,
        method: "PATCH",
        token,
        body: input,
        parse: parseSchedulingProposalDetailResponse,
      }),
    approveSchedulingProposal: async (token, proposalId) =>
      requestJson({
        apiBaseUrl,
        path: `/tech/scheduling/proposals/${encodeURIComponent(proposalId)}/approve`,
        method: "POST",
        token,
        parse: parseSchedulingDecisionResponse,
      }),
    rejectSchedulingProposal: async (token, proposalId, input) =>
      requestJson({
        apiBaseUrl,
        path: `/tech/scheduling/proposals/${encodeURIComponent(proposalId)}/reject`,
        method: "POST",
        token,
        body: input,
        parse: parseSchedulingDecisionResponse,
      }),
    listWritebackExecutions: async (token, filters = {}) =>
      requestJson({
        apiBaseUrl,
        path: `/writebacks${writebackQuery(filters)}`,
        method: "GET",
        token,
        parse: parseWritebackExecutionListResponse,
      }),
    executeApprovedWriteback: async (token, approvalId) =>
      requestJson({
        apiBaseUrl,
        path: `/writebacks/approvals/${encodeURIComponent(approvalId)}/execute`,
        method: "POST",
        token,
        parse: parseWritebackExecutionResponse,
      }),
    retryWritebackExecution: async (token, executionId) =>
      requestJson({
        apiBaseUrl,
        path: `/writebacks/${encodeURIComponent(executionId)}/retry`,
        method: "POST",
        token,
        parse: parseWritebackExecutionResponse,
      }),
  };
}

export const apiClient = createApiClient();

type JsonRequestOptions<T> = {
  apiBaseUrl: string;
  path: string;
  method: "GET" | "POST" | "PATCH";
  token?: string;
  body?: unknown;
  parse: (payload: unknown) => T;
};

async function requestJson<T>({
  apiBaseUrl,
  path,
  method,
  token,
  body,
  parse,
}: JsonRequestOptions<T>) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: buildHeaders(token, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await readPayload(response);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      getErrorMessage(payload, "Request failed"),
      payload,
    );
  }

  return parse(payload);
}

type NoContentRequestOptions = {
  apiBaseUrl: string;
  path: string;
  method: "POST";
  token?: string;
};

type TextRequestOptions<T> = {
  apiBaseUrl: string;
  path: string;
  token?: string;
  parse: (payload: unknown) => T;
};

async function requestText<T>({
  apiBaseUrl,
  path,
  token,
  parse,
}: TextRequestOptions<T>) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: "GET",
    headers: buildTextHeaders(token),
  });
  const text = await response.text();

  if (!response.ok) {
    const payload = parseErrorPayload(text);
    throw new ApiError(
      response.status,
      getErrorMessage(payload, "Request failed"),
      payload,
    );
  }

  return parse({ text });
}

async function requestNoContent({
  apiBaseUrl,
  path,
  method,
  token,
}: NoContentRequestOptions) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: buildHeaders(token),
  });

  if (!response.ok) {
    const payload = await readPayload(response);
    throw new ApiError(
      response.status,
      getErrorMessage(payload, "Request failed"),
      payload,
    );
  }
}

function buildHeaders(token?: string, hasBody = false) {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

function buildTextHeaders(token?: string) {
  const headers: Record<string, string> = {
    Accept: "text/vcard",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function readPayload(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function parseErrorPayload(text: string) {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function parseLoginResponse(payload: unknown) {
  const result = toLoginResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected login response", payload);
  }

  return result;
}

function parseAuthSessionResponse(payload: unknown): AuthSessionResponse {
  if (!isRecord(payload)) {
    throw new ApiError(0, "Unexpected session response", payload);
  }

  const user = toSessionUser(payload.user);
  if (!user) {
    throw new ApiError(0, "Unexpected session response", payload);
  }

  return { user };
}

function parseJobUpdateFeedResponse(payload: unknown) {
  const result = toJobUpdateFeedResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected job update feed response", payload);
  }

  return result;
}

function parseUpdateExtractionResponse(payload: unknown) {
  const result = toUpdateExtractionResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected update extraction response", payload);
  }

  return result;
}

function parseJobMoneyResponse(payload: unknown) {
  const result = toJobMoneyResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected job money response", payload);
  }

  return result;
}

function parseReminderListResponse(payload: unknown) {
  const result = toReminderListResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected reminder list response", payload);
  }

  return result;
}

function parseReminderGenerationResponse(payload: unknown) {
  const result = toReminderGenerationResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected reminder generation response", payload);
  }

  return result;
}

function parseResolveReminderResponse(payload: unknown) {
  const result = toResolveReminderResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected resolve reminder response", payload);
  }

  return result;
}

function parseManagerDashboardResponse(payload: unknown) {
  const result = toManagerDashboardResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected manager dashboard response", payload);
  }

  return result;
}

function parseManagerJobDetailResponse(payload: unknown) {
  const result = toManagerJobDetailResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected manager job detail response", payload);
  }

  return result;
}

function parseManagerLeadDetailResponse(payload: unknown) {
  const result = toManagerLeadDetailResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected manager lead detail response", payload);
  }

  return result;
}

function parseContactCardPreviewResponse(payload: unknown) {
  const result = toContactCardPreviewResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected contact card preview response", payload);
  }

  return result;
}

function parseContactCardVcardResponse(payload: unknown) {
  const result = toContactCardVcardResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected contact card vCard response", payload);
  }

  return result;
}

function parseConversationListResponse(payload: unknown) {
  const result = toConversationListResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected conversation list response", payload);
  }
  return result;
}

function parseConversationDetailResponse(payload: unknown) {
  const result = toConversationDetailResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected conversation detail response", payload);
  }
  return result;
}

function parseSendConversationMessageResponse(payload: unknown) {
  const result = toSendConversationMessageResponse(payload);
  if (!result) {
    throw new ApiError(
      0,
      "Unexpected send conversation message response",
      payload,
    );
  }
  return result;
}

function parseSchedulingProposalListResponse(payload: unknown) {
  const result = toSchedulingProposalListResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected scheduling list response", payload);
  }
  return result;
}

function parseSchedulingProposalDetailResponse(payload: unknown) {
  const result = toSchedulingProposalDetailResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected scheduling detail response", payload);
  }
  return result;
}

function parseSchedulingDecisionResponse(payload: unknown) {
  const result = toSchedulingDecisionResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected scheduling decision response", payload);
  }
  return result;
}

function parseWritebackExecutionListResponse(payload: unknown) {
  const result = toWritebackExecutionListResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected writeback list response", payload);
  }
  return result;
}

function parseWritebackExecutionResponse(payload: unknown) {
  const result = toWritebackExecutionResponse(payload);
  if (!result) {
    throw new ApiError(0, "Unexpected writeback response", payload);
  }
  return result;
}

function writebackQuery(filters: WritebackExecutionListQuery) {
  const params = new URLSearchParams();
  if (filters.state) {
    params.set("state", filters.state);
  }
  if (filters.approvalId) {
    params.set("approvalId", filters.approvalId);
  }
  if (filters.jobId) {
    params.set("jobId", filters.jobId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (isRecord(payload) && typeof payload.error === "string") {
    return payload.error;
  }

  if (isRecord(payload) && typeof payload.message === "string") {
    return payload.message;
  }

  return fallback;
}
