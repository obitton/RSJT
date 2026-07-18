import cors from "@fastify/cors";
import formbody from "@fastify/formbody";
import sensible from "@fastify/sensible";
import type { AppDb } from "@rsjt/db";
import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import type { ApiConfig } from "./config.js";
import { createRepairShoprClientFromEnv } from "./integrations/repairshopr/repairshopr-client.js";
import { createRepairShoprWriteClientFromEnv } from "./integrations/repairshopr/repairshopr-write-client.js";
import { TwilioOutboundMessenger } from "./integrations/twilio/twilio-outbound-messenger.js";
import { TwilioWebhookVerifier } from "./integrations/twilio/twilio-webhook-verifier.js";
import { ReminderJobRunner } from "./jobs/reminder-job.js";
import { registerAuthPlugin } from "./plugins/auth.js";
import { registerDbPlugin } from "./plugins/db.js";
import { ApprovalsRepository } from "./repositories/approvals-repository.js";
import { ConversationsRepository } from "./repositories/conversations-repository.js";
import { ExtractedFactsRepository } from "./repositories/extracted-facts-repository.js";
import { IntakeRepository } from "./repositories/intake-repository.js";
import { JobCancellationRepository } from "./repositories/job-cancellation-repository.js";
import { JobMoneyRepository } from "./repositories/job-money-repository.js";
import { JobsRepository } from "./repositories/jobs-repository.js";
import { LeadConversionRepository } from "./repositories/lead-conversion-repository.js";
import { ManagerDashboardRepository } from "./repositories/manager-dashboard-repository.js";
import { MatchesRepository } from "./repositories/matches-repository.js";
import { MessagesRepository } from "./repositories/messages-repository.js";
import { RemindersRepository } from "./repositories/reminders-repository.js";
import { SchedulingProposalsRepository } from "./repositories/scheduling-proposals-repository.js";
import { WritebackExecutionsRepository } from "./repositories/writeback-executions-repository.js";
import { registerApprovalRoutes } from "./routes/approvals-routes.js";
import { registerAuthRoutes } from "./routes/auth-routes.js";
import { registerContactCardRoutes } from "./routes/contact-card-routes.js";
import { registerHealthRoutes } from "./routes/health-routes.js";
import { registerJobMoneyRoutes } from "./routes/job-money-routes.js";
import { registerJobsRoutes } from "./routes/jobs-routes.js";
import { registerManagerRoutes } from "./routes/manager-routes.js";
import { registerMatchRoutes } from "./routes/matches-routes.js";
import { registerReminderRoutes } from "./routes/reminder-routes.js";
import { registerSchedulingRoutes } from "./routes/scheduling-routes.js";
import { registerTechConversationRoutes } from "./routes/tech-conversation-routes.js";
import { registerTwilioWebhookRoutes } from "./routes/twilio-webhook-routes.js";
import { registerUpdateRoutes } from "./routes/updates-routes.js";
import { registerWritebackRoutes } from "./routes/writeback-routes.js";
import {
  ApprovalService,
  type ApprovalServiceApi,
} from "./services/approval-service.js";
import type { AuthSessionService } from "./services/auth-service.js";
import {
  ContactCardService,
  type ContactCardServiceApi,
} from "./services/contact-card-service.js";
import {
  CustomerIntakeStateMachineService,
  type CustomerIntakeStateMachineServiceApi,
} from "./services/customer-intake-state-machine-service.js";
import { IntakeSpamGate } from "./services/intake-spam-gate.js";
import {
  JobCancellationService,
  type JobCancellationServiceApi,
} from "./services/job-cancellation-service.js";
import {
  JobMoneyService,
  type JobMoneyServiceApi,
} from "./services/job-money-service.js";
import {
  JobUpdateFeedService,
  type JobUpdateFeedServiceApi,
} from "./services/job-update-feed-service.js";
import {
  LeadConversionService,
  type LeadConversionServiceApi,
} from "./services/lead-conversion-service.js";
import {
  LiveTakeoverService,
  type LiveTakeoverServiceApi,
} from "./services/live-takeover-service.js";
import {
  ManagerDashboardService,
  type ManagerDashboardServiceApi,
} from "./services/manager-dashboard-service.js";
import {
  MatchingService,
  type MatchingServiceApi,
} from "./services/matching-service.js";
import {
  MessagingWebhookService,
  type MessagingWebhookServiceApi,
} from "./services/messaging-webhook-service.js";
import {
  ReminderService,
  type ReminderServiceApi,
} from "./services/reminder-service.js";
import {
  SchedulingProposalService,
  type SchedulingProposalServiceApi,
} from "./services/scheduling-proposal-service.js";
import {
  DeterministicUpdateExtractionAdapter,
  UpdateExtractionService,
  type UpdateExtractionServiceApi,
} from "./services/update-extraction-service.js";
import {
  type CustomerMessageExecutor,
  WritebackExecutionService,
  type WritebackExecutionServiceApi,
} from "./services/writeback-execution-service.js";

type AppOptions = {
  authService?: AuthSessionService;
  db?: AppDb;
  approvalService?: ApprovalServiceApi;
  contactCardService?: ContactCardServiceApi;
  customerIntakeService?: CustomerIntakeStateMachineServiceApi;
  intakeBotUserId?: string;
  jobCancellationService?: JobCancellationServiceApi;
  jobMoneyService?: JobMoneyServiceApi;
  jobUpdateFeedService?: JobUpdateFeedServiceApi;
  leadConversionService?: LeadConversionServiceApi;
  liveTakeoverService?: LiveTakeoverServiceApi;
  managerDashboardService?: ManagerDashboardServiceApi;
  matchingService?: MatchingServiceApi;
  messagingWebhookService?: MessagingWebhookServiceApi;
  reminderService?: ReminderServiceApi;
  schedulingProposalService?: SchedulingProposalServiceApi;
  updateExtractionService?: UpdateExtractionServiceApi;
  writebackExecutionService?: WritebackExecutionServiceApi;
};

export async function buildApp(config: ApiConfig, options: AppOptions = {}) {
  const app = Fastify({ logger: config.NODE_ENV !== "test" });

  await app.register(cors, { origin: true });
  await app.register(formbody);
  await app.register(sensible);

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "Invalid request",
        issues: error.issues,
      });
    }

    if (isHttpError(error)) {
      return reply.status(error.statusCode).send({ error: error.message });
    }

    app.log.error(error);
    return reply.status(500).send({ error: "Internal server error" });
  });

  if (options.db) {
    app.decorate("db", options.db);
  } else if (!options.authService) {
    await registerDbPlugin(app, config);
  }

  await registerAuthPlugin(app, config, options.authService);
  await registerHealthRoutes(app);
  const writebackExecutionService =
    options.writebackExecutionService ??
    createDefaultWritebackExecutionService(app, config);
  const approvalService =
    options.approvalService ??
    createDefaultApprovalService(app, writebackExecutionService);
  const customerIntakeService =
    options.customerIntakeService ??
    createDefaultCustomerIntakeService(app, approvalService);
  await registerTwilioWebhookRoutes(
    app,
    options.messagingWebhookService ??
      createDefaultMessagingWebhookService(
        app,
        config,
        customerIntakeService,
        options.intakeBotUserId,
      ),
  );
  await registerAuthRoutes(app);
  await registerApprovalRoutes(app, approvalService);
  await registerWritebackRoutes(app, writebackExecutionService);
  await registerContactCardRoutes(
    app,
    options.contactCardService ?? createDefaultContactCardService(app),
  );
  await registerJobMoneyRoutes(
    app,
    options.jobMoneyService ?? createDefaultJobMoneyService(app),
  );
  const reminderService =
    options.reminderService ?? createDefaultReminderService(app);
  await registerReminderRoutes(app, reminderService);
  if (config.NODE_ENV !== "test" && reminderService) {
    const reminderJobRunner = new ReminderJobRunner(reminderService, app.log);
    app.addHook("onReady", async () => reminderJobRunner.start());
    app.addHook("onClose", async () => reminderJobRunner.stop());
  }
  await registerManagerRoutes(
    app,
    options.managerDashboardService ??
      createDefaultManagerDashboardService(app),
    { intakeService: customerIntakeService },
  );
  await registerTechConversationRoutes(
    app,
    options.liveTakeoverService ??
      createDefaultLiveTakeoverService(app, config),
    options.leadConversionService ?? createDefaultLeadConversionService(app),
  );
  await registerSchedulingRoutes(
    app,
    options.schedulingProposalService ??
      createDefaultSchedulingProposalService(app, approvalService),
  );
  await registerJobsRoutes(
    app,
    options.jobUpdateFeedService ?? createDefaultJobUpdateFeedService(app),
    options.jobCancellationService ?? createDefaultJobCancellationService(app),
  );
  await registerUpdateRoutes(
    app,
    options.updateExtractionService ??
      createDefaultUpdateExtractionService(app),
  );
  await registerMatchRoutes(
    app,
    options.matchingService ?? createDefaultMatchingService(app, config),
  );

  return app;
}

function isHttpError(error: unknown): error is Error & { statusCode: number } {
  return (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  );
}

function createDefaultApprovalService(
  app: FastifyInstance,
  writebackExecutionService: WritebackExecutionServiceApi | undefined,
) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }

  return new ApprovalService(
    new ApprovalsRepository(app.db),
    writebackExecutionService instanceof WritebackExecutionService
      ? writebackExecutionService
      : undefined,
  );
}

function createDefaultJobUpdateFeedService(app: FastifyInstance) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }

  return new JobUpdateFeedService(new JobsRepository(app.db));
}

function createDefaultJobCancellationService(app: FastifyInstance) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }

  return new JobCancellationService(new JobCancellationRepository(app.db));
}

function createDefaultContactCardService(app: FastifyInstance) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }

  return new ContactCardService(new IntakeRepository(app.db));
}

function createDefaultJobMoneyService(app: FastifyInstance) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }

  return new JobMoneyService(new JobMoneyRepository(app.db));
}

function createDefaultReminderService(app: FastifyInstance) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }

  return new ReminderService(new RemindersRepository(app.db));
}

function createDefaultManagerDashboardService(app: FastifyInstance) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }

  return new ManagerDashboardService(new ManagerDashboardRepository(app.db));
}

function createDefaultUpdateExtractionService(app: FastifyInstance) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }

  return new UpdateExtractionService(
    new MessagesRepository(app.db),
    new ExtractedFactsRepository(app.db),
    new DeterministicUpdateExtractionAdapter(),
  );
}

function createDefaultMessagingWebhookService(
  app: FastifyInstance,
  config: ApiConfig,
  customerIntakeService: CustomerIntakeStateMachineServiceApi | undefined,
  intakeBotUserId: string | undefined,
) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }
  if (!config.TWILIO_AUTH_TOKEN || !config.APP_BASE_URL) {
    return undefined;
  }

  return new MessagingWebhookService(
    new MessagesRepository(app.db),
    new TwilioWebhookVerifier({
      authToken: config.TWILIO_AUTH_TOKEN,
      baseUrl: config.APP_BASE_URL,
    }),
    {
      intakeEvaluator: customerIntakeService ?? null,
      intakeBotUserId: intakeBotUserId ?? null,
    },
  );
}

function createDefaultCustomerIntakeService(
  app: FastifyInstance,
  approvalService: ApprovalServiceApi | undefined,
) {
  if (!app.hasDecorator("db") || !approvalService) {
    return undefined;
  }

  return new CustomerIntakeStateMachineService(
    new IntakeRepository(app.db),
    approvalService,
    new IntakeSpamGate(),
    null,
  );
}

function createDefaultLiveTakeoverService(
  app: FastifyInstance,
  config: ApiConfig,
) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }
  return new LiveTakeoverService(
    new ConversationsRepository(app.db),
    new TwilioOutboundMessenger(config),
    { channel: config.MESSAGING_CHANNEL },
  );
}

function createDefaultLeadConversionService(app: FastifyInstance) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }
  return new LeadConversionService(new LeadConversionRepository(app.db));
}

function createDefaultWritebackExecutionService(
  app: FastifyInstance,
  config: ApiConfig,
) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }

  return new WritebackExecutionService(
    new WritebackExecutionsRepository(app.db),
    new ApprovalsRepository(app.db),
    createDefaultRepairShoprWriteExecutor(config),
    createDefaultCustomerMessageExecutor(config),
    new ConversationsRepository(app.db),
    {
      repairShoprWritebackEnabled: Boolean(
        config.REPAIRSHOPR_WRITEBACK_ENABLED,
      ),
      repairShoprTestRecordAllowlist: parseAllowlist(
        config.REPAIRSHOPR_WRITEBACK_TEST_RECORD_ALLOWLIST,
      ),
    },
  );
}

function createDefaultRepairShoprWriteExecutor(config: ApiConfig) {
  if (
    !config.REPAIRSHOPR_WRITEBACK_ENABLED ||
    !config.REPAIRSHOPR_SUBDOMAIN ||
    !config.REPAIRSHOPR_API_KEY
  ) {
    return null;
  }

  return createRepairShoprWriteClientFromEnv({
    REPAIRSHOPR_SUBDOMAIN: config.REPAIRSHOPR_SUBDOMAIN,
    REPAIRSHOPR_API_KEY: config.REPAIRSHOPR_API_KEY,
    REPAIRSHOPR_TIMEOUT_MS: config.REPAIRSHOPR_TIMEOUT_MS,
  });
}

function createDefaultCustomerMessageExecutor(
  config: ApiConfig,
): CustomerMessageExecutor {
  const outbound = new TwilioOutboundMessenger(config);
  return {
    isEnabled: () => outbound.isEnabled(),
    send: (input) =>
      outbound.send({
        ...input,
        channel: config.MESSAGING_CHANNEL,
      }),
  };
}

function parseAllowlist(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function createDefaultSchedulingProposalService(
  app: FastifyInstance,
  approvalService: ApprovalServiceApi | undefined,
) {
  if (!app.hasDecorator("db") || !approvalService) {
    return undefined;
  }
  return new SchedulingProposalService(
    new SchedulingProposalsRepository(app.db),
    approvalService,
  );
}

function createDefaultMatchingService(app: FastifyInstance, config: ApiConfig) {
  if (!app.hasDecorator("db")) {
    return undefined;
  }

  if (!config.REPAIRSHOPR_SUBDOMAIN || !config.REPAIRSHOPR_API_KEY) {
    return undefined;
  }

  return new MatchingService(
    new MatchesRepository(app.db),
    createRepairShoprClientFromEnv({
      REPAIRSHOPR_SUBDOMAIN: config.REPAIRSHOPR_SUBDOMAIN,
      REPAIRSHOPR_API_KEY: config.REPAIRSHOPR_API_KEY,
      REPAIRSHOPR_TIMEOUT_MS: config.REPAIRSHOPR_TIMEOUT_MS,
    }),
  );
}
