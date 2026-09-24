import type {
  AuthSessionResponse,
  CancelJobResponse,
  ContactCardPreviewResponse,
  ContactCardVcardResponse,
  ConversationDetailResponse,
  ConversationListResponse,
  ConvertLeadToJobResponse,
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
  SetTakeoverRequest,
  UpdateExtractionRequest,
  UpdateExtractionResponse,
  UpdateJobMoneyRequest,
  WritebackExecutionListQuery,
  WritebackExecutionListResponse,
  WritebackExecutionResponse,
} from "@rsjt/shared";
import {
  AuthSessionResponseSchema,
  CancelJobResponseSchema,
  ContactCardPreviewResponseSchema,
  ContactCardVcardResponseSchema,
  ConversationDetailResponseSchema,
  ConversationListResponseSchema,
  ConvertLeadToJobResponseSchema,
  JobMoneyResponseSchema,
  JobUpdateFeedResponseSchema,
  LoginResponseSchema,
  ManagerDashboardResponseSchema,
  ManagerJobDetailResponseSchema,
  ManagerLeadDetailResponseSchema,
  ReminderGenerationResponseSchema,
  ReminderListResponseSchema,
  ResolveReminderResponseSchema,
  SchedulingDecisionResponseSchema,
  SchedulingProposalDetailResponseSchema,
  SchedulingProposalListResponseSchema,
  SendConversationMessageResponseSchema,
  UpdateExtractionResponseSchema,
  WritebackExecutionListResponseSchema,
  WritebackExecutionResponseSchema,
} from "@rsjt/shared";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:47630";

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
  cancelJob: (
    token: string,
    jobId: string,
    reason: string,
  ) => Promise<CancelJobResponse>;
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
  convertLeadToJob: (
    token: string,
    conversationId: string,
  ) => Promise<ConvertLeadToJobResponse>;
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
    cancelJob: async (token, jobId, reason) =>
      requestJson({
        apiBaseUrl,
        path: `/jobs/${encodeURIComponent(jobId)}/cancel`,
        method: "POST",
        token,
        body: { reason },
        parse: parseCancelJobResponse,
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
    convertLeadToJob: async (token, conversationId) =>
      requestJson({
        apiBaseUrl,
        path: `/tech/conversations/${encodeURIComponent(conversationId)}/convert-to-job`,
        method: "POST",
        token,
        parse: parseConvertLeadToJobResponse,
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

type ResponseSchema<T> = {
  safeParse: (
    value: unknown,
  ) => { success: true; data: T } | { success: false; error: unknown };
};

function parseWith<T>(label: string, schema: ResponseSchema<T>) {
  return (payload: unknown): T => {
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new ApiError(0, `Unexpected ${label} response`, payload);
    }
    return result.data;
  };
}

const parseLoginResponse = parseWith("login", LoginResponseSchema);
const parseAuthSessionResponse = parseWith(
  "session",
  AuthSessionResponseSchema,
);
const parseJobUpdateFeedResponse = parseWith(
  "job update feed",
  JobUpdateFeedResponseSchema,
);
const parseUpdateExtractionResponse = parseWith(
  "update extraction",
  UpdateExtractionResponseSchema,
);
const parseJobMoneyResponse = parseWith("job money", JobMoneyResponseSchema);
const parseReminderListResponse = parseWith(
  "reminder list",
  ReminderListResponseSchema,
);
const parseReminderGenerationResponse = parseWith(
  "reminder generation",
  ReminderGenerationResponseSchema,
);
const parseResolveReminderResponse = parseWith(
  "resolve reminder",
  ResolveReminderResponseSchema,
);
const parseCancelJobResponse = parseWith("cancel job", CancelJobResponseSchema);
const parseManagerDashboardResponse = parseWith(
  "manager dashboard",
  ManagerDashboardResponseSchema,
);
const parseManagerJobDetailResponse = parseWith(
  "manager job detail",
  ManagerJobDetailResponseSchema,
);
const parseManagerLeadDetailResponse = parseWith(
  "manager lead detail",
  ManagerLeadDetailResponseSchema,
);
const parseContactCardPreviewResponse = parseWith(
  "contact card preview",
  ContactCardPreviewResponseSchema,
);
const parseContactCardVcardResponse = parseWith(
  "contact card vCard",
  ContactCardVcardResponseSchema,
);
const parseConversationListResponse = parseWith(
  "conversation list",
  ConversationListResponseSchema,
);
const parseConversationDetailResponse = parseWith(
  "conversation detail",
  ConversationDetailResponseSchema,
);
const parseSendConversationMessageResponse = parseWith(
  "send conversation message",
  SendConversationMessageResponseSchema,
);
const parseConvertLeadToJobResponse = parseWith(
  "convert lead to job",
  ConvertLeadToJobResponseSchema,
);
const parseSchedulingProposalListResponse = parseWith(
  "scheduling list",
  SchedulingProposalListResponseSchema,
);
const parseSchedulingProposalDetailResponse = parseWith(
  "scheduling detail",
  SchedulingProposalDetailResponseSchema,
);
const parseSchedulingDecisionResponse = parseWith(
  "scheduling decision",
  SchedulingDecisionResponseSchema,
);
const parseWritebackExecutionListResponse = parseWith(
  "writeback list",
  WritebackExecutionListResponseSchema,
);
const parseWritebackExecutionResponse = parseWith(
  "writeback",
  WritebackExecutionResponseSchema,
);

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
