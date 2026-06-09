import { describe, expect, it } from "vitest";
import {
  ApprovalFilterQuerySchema,
  ContactCardDataSchema,
  ContactCardPreviewResponseSchema,
  ContactCardVcardResponseSchema,
  CreateApprovalRequestSchema,
  CustomerIntakePromptSchema,
  CustomerIntakeSnapshotSchema,
  CustomerIntakeStateSchema,
  ExpenseCategorySchema,
  ExtractedFactSchema,
  JobMoneyResponseSchema,
  ManagerDashboardResponseSchema,
  ManagerJobDetailResponseSchema,
  MatchConfidenceThresholds,
  MatchSearchInputSchema,
  OverrideSplitCategoryRequestSchema,
  ReminderGenerationResponseSchema,
  ReminderListResponseSchema,
  ResolveReminderResponseSchema,
  SplitCategorySchema,
  SplitPercentByCategory,
  TwilioInboundWebhookSchema,
  TwilioStatusCallbackSchema,
  UpdateExtractionRequestSchema,
  UpdateJobMoneyRequestSchema,
  WritebackApprovalPayloadSchema,
  WritebackExecutionListResponseSchema,
  WritebackExecutionResponseSchema,
  extractTwilioMediaItems,
} from "../index.js";

describe("domain contracts", () => {
  it("does not include travel as a deductible expense category", () => {
    expect(ExpenseCategorySchema.safeParse("travel").success).toBe(false);
  });

  it("models returning RepairShopr customer split", () => {
    expect(SplitCategorySchema.parse("returning_repairshopr_customer")).toBe(
      "returning_repairshopr_customer",
    );
    expect(SplitPercentByCategory.returning_repairshopr_customer).toEqual({
      manager: 30,
      tech: 70,
    });
  });

  it("uses medium-high and high match thresholds from PP01", () => {
    expect(MatchConfidenceThresholds.mediumHigh).toBe(0.7);
    expect(MatchConfidenceThresholds.high).toBe(0.85);
  });

  it("requires at least one match search hint", () => {
    expect(MatchSearchInputSchema.safeParse({}).success).toBe(false);
    expect(
      MatchSearchInputSchema.safeParse({ phone: "555-0101" }).success,
    ).toBe(true);
  });

  it("validates update extraction request bodies", () => {
    expect(
      UpdateExtractionRequestSchema.parse({ body: "  went to Michele  " }),
    ).toEqual({ body: "went to Michele" });
    expect(UpdateExtractionRequestSchema.safeParse({ body: "" }).success).toBe(
      false,
    );
  });

  it("parses typed extracted facts with source evidence", () => {
    const messageId = "00000000-0000-4000-8000-000000000201";

    expect(
      ExtractedFactSchema.parse({
        type: "gross_charge_cents",
        value: { amountCents: 20000 },
        confidence: 0.75,
        evidence: { messageId, quote: "200" },
        requiresConfirmation: true,
      }),
    ).toEqual({
      type: "gross_charge_cents",
      value: { amountCents: 20000 },
      confidence: 0.75,
      evidence: { messageId, quote: "200" },
      requiresConfirmation: true,
    });

    expect(
      ExtractedFactSchema.safeParse({
        type: "duration_minutes",
        value: { amountCents: 20000 },
        confidence: 0.75,
        evidence: { messageId, quote: "1 hr" },
        requiresConfirmation: true,
      }).success,
    ).toBe(false);
  });

  it("validates approval creation and filters", () => {
    const messageId = "00000000-0000-4000-8000-000000000201";
    const jobId = "00000000-0000-4000-8000-000000009001";

    expect(
      CreateApprovalRequestSchema.parse({
        jobId,
        kind: "customer_message",
        risk: "scheduling",
        requiredRole: "manager",
        payload: { body: "We can schedule tomorrow." },
        evidence: [{ messageId, quote: "schedule tomorrow" }],
      }),
    ).toEqual({
      jobId,
      kind: "customer_message",
      risk: "scheduling",
      requiredRole: "manager",
      payload: { body: "We can schedule tomorrow." },
      evidence: [{ messageId, quote: "schedule tomorrow" }],
    });

    expect(
      CreateApprovalRequestSchema.safeParse({
        kind: "customer_message",
        risk: "scheduling",
        requiredRole: "admin",
        payload: { body: "Invalid role" },
        evidence: [{ messageId, quote: "Invalid role" }],
      }).success,
    ).toBe(false);
    expect(
      ApprovalFilterQuerySchema.parse({
        state: "pending",
        risk: "scheduling",
        requiredRole: "tech",
      }),
    ).toEqual({
      state: "pending",
      risk: "scheduling",
      requiredRole: "tech",
    });
  });

  it("parses a manager dashboard response with groups and takeover", () => {
    const jobId = "00000000-0000-4000-8000-000000010101";
    const conversationId = "00000000-0000-4000-8000-000000020101";
    const updatedAt = new Date("2026-05-22T12:00:00.000Z");

    const response = ManagerDashboardResponseSchema.parse({
      summary: {
        leadsCount: 1,
        needsTechAnswerCount: 0,
        workingOnCount: 1,
        jobsCount: 0,
        repairCount: 0,
        openCount: 1,
        scheduledCount: 0,
        completedCount: 0,
        unmatchedCount: 1,
        takeoverCount: 1,
        payoutReadyCount: 0,
      },
      groups: {
        openJobs: [
          {
            id: jobId,
            state: "accepted",
            customerLabel: "Local laptop repair",
            updatedAt,
            grossChargeCents: 18000,
            pendingApprovalCount: 1,
            selectedMatchConfidenceBand: "high",
          },
        ],
        scheduledJobs: [],
        completedJobs: [],
        unmatchedJobs: [
          {
            id: "00000000-0000-4000-8000-000000010103",
            state: "unmatched",
            customerLabel: "Unmatched walk-in update",
            updatedAt,
            pendingApprovalCount: 0,
          },
        ],
        payoutReadyJobs: [],
      },
      leads: [],
      takeoverConversations: [
        {
          id: conversationId,
          externalPhone: "+15555550100",
          takeoverActive: true,
          takeoverStartedAt: updatedAt,
          updatedAt,
        },
      ],
    });

    expect(response.summary.openCount).toBe(1);
    expect(response.groups.openJobs[0]?.state).toBe("accepted");
    expect(response.groups.openJobs[0]?.selectedMatchConfidenceBand).toBe(
      "high",
    );
    expect(response.takeoverConversations[0]?.externalPhone).toBe(
      "+15555550100",
    );
  });

  it("parses a manager job detail response with optional selected match", () => {
    const jobId = "00000000-0000-4000-8000-000000010101";
    const matchId = "00000000-0000-4000-8000-000000030101";
    const approvalId = "00000000-0000-4000-8000-000000040101";
    const updatedAt = new Date("2026-05-22T12:00:00.000Z");

    const response = ManagerJobDetailResponseSchema.parse({
      job: {
        id: jobId,
        state: "accepted",
        customerLabel: "Local laptop repair",
        updatedAt,
        grossChargeCents: 18000,
        pendingApprovalCount: 1,
      },
      pendingApprovals: [
        {
          id: approvalId,
          kind: "customer_message",
          risk: "scheduling",
          requiredRole: "manager",
          updatedAt,
        },
      ],
      selectedMatch: {
        id: matchId,
        confidence: 0.9,
        confidenceBand: "high",
        repairShoprReference: {
          entityType: "ticket",
          repairShoprId: "local-ticket-101",
          displayLabel: "Local laptop repair",
        },
      },
    });

    expect(response.selectedMatch?.confidenceBand).toBe("high");
    expect(response.pendingApprovals[0]?.kind).toBe("customer_message");
  });

  it("parses an SMS inbound Twilio webhook with passthrough fields", () => {
    const payload = TwilioInboundWebhookSchema.parse({
      MessageSid: "SM12345",
      AccountSid: "AC12345",
      From: "+15555550100",
      To: "+15555550199",
      Body: "Hello there",
      NumMedia: "0",
      FromCity: "Seattle",
    });

    expect(payload.NumMedia).toBe(0);
    expect(payload.Body).toBe("Hello there");
    expect(payload).toMatchObject({ FromCity: "Seattle" });
    expect(extractTwilioMediaItems(payload)).toEqual([]);
  });

  it("parses an MMS inbound Twilio webhook and extracts media items", () => {
    const payload = TwilioInboundWebhookSchema.parse({
      MessageSid: "SM12346",
      From: "+15555550100",
      To: "+15555550199",
      Body: "Photo attached",
      NumMedia: "1",
      MediaUrl0: "https://api.twilio.com/media/abc",
      MediaContentType0: "image/jpeg",
    });

    const media = extractTwilioMediaItems(payload);
    expect(media).toEqual([
      {
        index: 0,
        contentType: "image/jpeg",
        url: "https://api.twilio.com/media/abc",
      },
    ]);
  });

  it("accepts WhatsApp-style sender values", () => {
    const payload = TwilioInboundWebhookSchema.parse({
      MessageSid: "SM12347",
      From: "whatsapp:+15555550100",
      To: "whatsapp:+14155238886",
      Body: "Hello",
      NumMedia: "0",
    });

    expect(payload.From).toBe("whatsapp:+15555550100");
  });

  it("parses a status callback with extra unknown params", () => {
    const callback = TwilioStatusCallbackSchema.parse({
      MessageSid: "SM12348",
      MessageStatus: "delivered",
      AccountSid: "AC12345",
      ChannelMetadata: "{}",
      RawDlrDoneDate: "2026-05-26T11:00:00Z",
    });

    expect(callback.MessageStatus).toBe("delivered");
    expect(callback).toMatchObject({ RawDlrDoneDate: "2026-05-26T11:00:00Z" });
  });

  it("rejects invalid NumMedia values", () => {
    const result = TwilioInboundWebhookSchema.safeParse({
      MessageSid: "SM12349",
      From: "+15555550100",
      To: "+15555550199",
      Body: "Bad",
      NumMedia: "-1",
    });
    expect(result.success).toBe(false);

    const nonInteger = TwilioInboundWebhookSchema.safeParse({
      MessageSid: "SM12350",
      From: "+15555550100",
      To: "+15555550199",
      Body: "Bad",
      NumMedia: "two",
    });
    expect(nonInteger.success).toBe(false);
  });

  it("parses a customer intake snapshot for a collecting conversation", () => {
    const conversationId = "00000000-0000-4000-8000-000000060101";
    const lastInboundMessageId = "00000000-0000-4000-8000-000000060102";
    const snapshot = CustomerIntakeSnapshotSchema.parse({
      conversationId,
      state: "collecting",
      customerName: "Casey Customer",
      phone: "+15555550100",
      email: null,
      serviceAddress: null,
      problemDescription: "My laptop will not boot.",
      preferredTiming: null,
      blockedReason: null,
      spamScore: 0,
      matchedReference: null,
      matchedConfidenceBand: null,
      lastInboundMessageId,
      lastInboundAt: new Date("2026-05-26T00:00:00.000Z"),
      updatedAt: new Date("2026-05-26T00:00:00.000Z"),
    });
    expect(snapshot.state).toBe("collecting");
    expect(snapshot.customerName).toBe("Casey Customer");
  });

  it("parses an intake prompt for a single missing field", () => {
    const prompt = CustomerIntakePromptSchema.parse({
      field: "serviceAddress",
      message: "What is the service address?",
    });
    expect(prompt.field).toBe("serviceAddress");
  });

  it("parses a blocked intake snapshot with a reason", () => {
    const snapshot = CustomerIntakeSnapshotSchema.parse({
      conversationId: "00000000-0000-4000-8000-000000060103",
      state: "blocked",
      customerName: null,
      phone: "+15555550100",
      email: null,
      serviceAddress: null,
      problemDescription: null,
      preferredTiming: null,
      blockedReason: "Excessive links",
      spamScore: 3,
      matchedReference: null,
      matchedConfidenceBand: null,
      lastInboundMessageId: null,
      lastInboundAt: null,
      updatedAt: new Date(),
    });
    expect(snapshot.blockedReason).toBe("Excessive links");
  });

  it("rejects unknown intake states", () => {
    expect(CustomerIntakeStateSchema.safeParse("collecting").success).toBe(
      true,
    );
    expect(CustomerIntakeStateSchema.safeParse("processing").success).toBe(
      false,
    );
  });

  it("parses an available contact card preview", () => {
    const conversationId = "00000000-0000-4000-8000-000000060201";
    const preview = ContactCardPreviewResponseSchema.parse({
      available: true,
      missingFields: [],
      state: "review_ready",
      contact: {
        conversationId,
        fullName: "Casey Customer",
        phone: "+15555550100",
        email: "casey@example.com",
        serviceAddress: "123 Main Street",
      },
    });

    expect(preview.available).toBe(true);
    expect(preview.contact?.fullName).toBe("Casey Customer");
  });

  it("parses an unavailable contact card preview", () => {
    const preview = ContactCardPreviewResponseSchema.parse({
      available: false,
      missingFields: ["phone"],
      state: "collecting",
      contact: null,
    });

    expect(preview.available).toBe(false);
    expect(preview.missingFields).toEqual(["phone"]);
  });

  it("parses contact card vCard text", () => {
    const response = ContactCardVcardResponseSchema.parse({
      text: "BEGIN:VCARD\nVERSION:3.0\nFN:Casey Customer\nEND:VCARD",
    });

    expect(response.text).toContain("FN:Casey Customer");
  });

  it("rejects contact card data without name or phone", () => {
    expect(
      ContactCardDataSchema.safeParse({
        conversationId: "00000000-0000-4000-8000-000000060202",
        fullName: "",
        phone: "+15555550100",
        email: null,
        serviceAddress: null,
      }).success,
    ).toBe(false);

    expect(
      ContactCardDataSchema.safeParse({
        conversationId: "00000000-0000-4000-8000-000000060202",
        fullName: "Casey Customer",
        phone: "",
        email: null,
        serviceAddress: null,
      }).success,
    ).toBe(false);
  });

  it("rejects manager dashboard jobs with invalid state or UUID", () => {
    expect(
      ManagerJobDetailResponseSchema.safeParse({
        job: {
          id: "not-a-uuid",
          state: "accepted",
          updatedAt: new Date(),
          pendingApprovalCount: 0,
        },
        pendingApprovals: [],
      }).success,
    ).toBe(false);

    expect(
      ManagerJobDetailResponseSchema.safeParse({
        job: {
          id: "00000000-0000-4000-8000-000000010101",
          state: "fictional",
          updatedAt: new Date(),
          pendingApprovalCount: 0,
        },
        pendingApprovals: [],
      }).success,
    ).toBe(false);
  });

  it("validates RepairShopr writeback payloads", () => {
    expect(
      WritebackApprovalPayloadSchema.parse({
        action: "lead_create",
        target: { entityType: "lead", displayLabel: "New lead" },
        repairShoprPayload: {
          first_name: "Casey",
          phone: "+15555550100",
        },
      }),
    ).toMatchObject({
      action: "lead_create",
      target: { entityType: "lead" },
    });

    expect(
      WritebackApprovalPayloadSchema.parse({
        action: "ticket_comment_create",
        target: { entityType: "ticket", repairShoprId: "4412" },
        repairShoprPayload: {
          body: "Customer prefers Friday morning.",
          hidden: true,
        },
      }),
    ).toMatchObject({
      action: "ticket_comment_create",
      target: { repairShoprId: "4412" },
    });

    expect(
      WritebackApprovalPayloadSchema.safeParse({
        action: "ticket_comment_create",
        target: { entityType: "ticket" },
        repairShoprPayload: { body: "Missing target id" },
      }).success,
    ).toBe(false);
  });

  it("validates appointment and customer-message execution payloads", () => {
    const conversationId = "00000000-0000-4000-8000-000000060104";

    expect(
      WritebackApprovalPayloadSchema.parse({
        conversationId,
        appointment: {
          status: "staged",
          notes: "Customer prefers Friday morning.",
        },
        preferredWindowText: "Friday morning",
      }),
    ).toMatchObject({
      conversationId,
      preferredWindowText: "Friday morning",
    });

    expect(
      WritebackApprovalPayloadSchema.parse({
        conversationId,
        body: "We can check Friday morning after confirming availability.",
      }),
    ).toMatchObject({
      conversationId,
      body: "We can check Friday morning after confirming availability.",
    });

    expect(
      WritebackApprovalPayloadSchema.safeParse({
        conversationId,
        body: "",
      }).success,
    ).toBe(false);
  });

  it("validates writeback execution responses", () => {
    const executionId = "00000000-0000-4000-8000-000000070101";
    const approvalId = "00000000-0000-4000-8000-000000070102";
    const createdAt = new Date("2026-05-26T00:00:00.000Z");
    const execution = {
      id: executionId,
      approvalId,
      jobId: null,
      kind: "repairshopr_writeback",
      state: "succeeded",
      targetKind: "repairshopr",
      action: "lead_create",
      requestPayload: {
        action: "lead_create",
        target: { entityType: "lead", displayLabel: "New lead" },
        repairShoprPayload: { first_name: "Casey" },
      },
      responsePayload: { id: 901 },
      errorMessage: null,
      repairShoprEntityType: "lead",
      repairShoprId: "901",
      attemptCount: 1,
      lastAttemptedAt: createdAt,
      executedByUserId: "00000000-0000-4000-8000-000000070103",
      succeededAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    };

    expect(
      WritebackExecutionResponseSchema.parse({ execution }).execution
        .repairShoprId,
    ).toBe("901");
    expect(
      WritebackExecutionListResponseSchema.parse({ executions: [execution] })
        .executions,
    ).toHaveLength(1);
    expect(
      WritebackExecutionResponseSchema.safeParse({
        execution: { ...execution, state: "running" },
      }).success,
    ).toBe(false);
  });

  it("parses job money with calculated profit basis", () => {
    const now = new Date("2026-05-26T00:00:00.000Z");
    const response = JobMoneyResponseSchema.parse({
      summary: {
        jobId: "00000000-0000-4000-8000-000000090001",
        state: "payout_ready",
        isCompleted: true,
        splitCategory: "new_lead",
        grossChargeCents: 18000,
        reportedExpenseCents: 2500,
        reportedProfitCents: null,
        calculatedProfitCents: 15500,
        profitBasis: "charge_minus_reported_expenses",
        managerPercent: 20,
        techPercent: 80,
        managerShareCents: 3100,
        techShareCents: 12400,
        payoutReady: true,
        missingFields: [],
      },
      expenses: [
        {
          id: "00000000-0000-4000-8000-000000090002",
          jobId: "00000000-0000-4000-8000-000000090001",
          category: "parts",
          amountCents: 2500,
          description: "Replacement adapter",
          enteredByUserId: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    expect(response.summary.profitBasis).toBe("charge_minus_reported_expenses");
    expect(response.summary.techShareCents).toBe(12400);
  });

  it("parses job money with reported profit basis", () => {
    const response = JobMoneyResponseSchema.parse({
      summary: {
        jobId: "00000000-0000-4000-8000-000000090003",
        state: "completed",
        isCompleted: true,
        splitCategory: "customer_service_heavy",
        grossChargeCents: null,
        reportedExpenseCents: 0,
        reportedProfitCents: 10101,
        calculatedProfitCents: 10101,
        profitBasis: "reported_profit",
        managerPercent: 50,
        techPercent: 50,
        managerShareCents: 5051,
        techShareCents: 5050,
        payoutReady: true,
        missingFields: [],
      },
      expenses: [],
    });

    expect(response.summary.managerShareCents).toBe(5051);
    expect(response.summary.techShareCents).toBe(5050);
  });

  it("rejects invalid job money and split override input", () => {
    expect(
      JobMoneyResponseSchema.safeParse({
        summary: {
          jobId: "00000000-0000-4000-8000-000000090004",
          state: "completed",
          isCompleted: true,
          splitCategory: "new_lead",
          grossChargeCents: -1,
          reportedExpenseCents: 0,
          reportedProfitCents: null,
          calculatedProfitCents: null,
          profitBasis: null,
          managerPercent: null,
          techPercent: null,
          managerShareCents: null,
          techShareCents: null,
          payoutReady: false,
          missingFields: ["profit_detail"],
        },
        expenses: [],
      }).success,
    ).toBe(false);

    expect(
      OverrideSplitCategoryRequestSchema.safeParse({
        splitCategory: "new_lead",
        reason: " ",
      }).success,
    ).toBe(false);
  });

  it("allows money updates to clear reported profit", () => {
    expect(
      UpdateJobMoneyRequestSchema.parse({
        grossChargeCents: 18000,
        reportedProfitCents: null,
      }),
    ).toEqual({
      grossChargeCents: 18000,
      reportedProfitCents: null,
    });
  });

  it("parses closeout reminder responses", () => {
    const now = new Date("2026-05-26T12:00:00.000Z");
    const reminder = {
      id: "00000000-0000-4000-8000-000000180001",
      jobId: "00000000-0000-4000-8000-000000010102",
      jobState: "scheduled",
      customerLabel: "Scheduled onsite setup",
      reason: "missing_completion",
      createdAt: now,
      resolvedAt: null,
      stale: false,
    };

    const list = ReminderListResponseSchema.parse({ reminders: [reminder] });

    expect(list.reminders[0]?.reason).toBe("missing_completion");
    expect(
      ReminderGenerationResponseSchema.parse({
        createdCount: 1,
        resolvedCount: 0,
        reminders: [reminder],
      }).createdCount,
    ).toBe(1);
    expect(
      ResolveReminderResponseSchema.parse({
        reminder: { ...reminder, resolvedAt: now },
      }).reminder.resolvedAt,
    ).toEqual(now);
  });

  it("rejects invalid closeout reminder reasons", () => {
    expect(
      ReminderListResponseSchema.safeParse({
        reminders: [
          {
            id: "00000000-0000-4000-8000-000000180001",
            jobId: "00000000-0000-4000-8000-000000010102",
            jobState: "scheduled",
            customerLabel: "Scheduled onsite setup",
            reason: "send_customer_sms",
            createdAt: new Date("2026-05-26T12:00:00.000Z"),
            resolvedAt: null,
            stale: false,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
