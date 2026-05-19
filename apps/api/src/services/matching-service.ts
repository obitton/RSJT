import { randomUUID } from "node:crypto";
import {
  type MatchCandidate,
  type MatchConfidenceBand,
  MatchConfidenceThresholds,
  type MatchReason,
  type MatchSearchInput,
  type MatchSearchResponse,
  type MatchSelectionResponse,
  type RepairShoprEntityType,
  type RepairShoprReference,
} from "@rsjt/shared";
import type {
  RepairShoprAppointment,
  RepairShoprAppointmentQuery,
  RepairShoprContact,
  RepairShoprContactQuery,
  RepairShoprCustomer,
  RepairShoprCustomerQuery,
  RepairShoprInvoice,
  RepairShoprInvoiceQuery,
  RepairShoprLead,
  RepairShoprLeadQuery,
  RepairShoprPayment,
  RepairShoprPaymentQuery,
  RepairShoprTicket,
  RepairShoprTicketQuery,
} from "../integrations/repairshopr/repairshopr-types.js";
import type { MatchCandidateStore } from "../repositories/matches-repository.js";

const MATCH_REASON_WEIGHTS = {
  exactPhone: 0.45,
  exactEmail: 0.4,
  name: 0.15,
  address: 0.1,
  activeWork: 0.1,
  recentActivity: 0.05,
} as const;

const ACTIVE_TICKET_STATUSES = new Set(["new", "open", "in progress"]);
const RECENT_LOOKBACK_DAYS = 180;

export interface RepairShoprMatchReader {
  listCustomers(
    query?: RepairShoprCustomerQuery,
  ): Promise<RepairShoprCustomer[]>;
  listContacts(query?: RepairShoprContactQuery): Promise<RepairShoprContact[]>;
  listLeads(query?: RepairShoprLeadQuery): Promise<RepairShoprLead[]>;
  listTickets(query?: RepairShoprTicketQuery): Promise<RepairShoprTicket[]>;
  listAppointments(
    query?: RepairShoprAppointmentQuery,
  ): Promise<RepairShoprAppointment[]>;
  listInvoices(query?: RepairShoprInvoiceQuery): Promise<RepairShoprInvoice[]>;
  listPayments(query?: RepairShoprPaymentQuery): Promise<RepairShoprPayment[]>;
  toReference(
    entityType: RepairShoprEntityType,
    record:
      | RepairShoprCustomer
      | RepairShoprContact
      | RepairShoprLead
      | RepairShoprTicket
      | RepairShoprAppointment
      | RepairShoprInvoice
      | RepairShoprPayment,
  ): RepairShoprReference;
}

export interface MatchingServiceApi {
  listJobMatches(jobId: string): Promise<MatchSearchResponse>;
  searchJobMatches(
    jobId: string,
    input: MatchSearchInput,
  ): Promise<MatchSearchResponse>;
  selectMatch(
    jobId: string,
    candidateId: string,
  ): Promise<MatchSelectionResponse>;
  unlinkMatch(jobId: string): Promise<MatchSelectionResponse>;
}

export class MatchCandidateNotFoundError extends Error {
  constructor() {
    super("Match candidate not found");
  }
}

type ScoreableRecord = {
  reference: RepairShoprReference;
  customerId?: number | null | undefined;
  contactId?: number | null | undefined;
  phone?: string | null | undefined;
  mobile?: string | null | undefined;
  email?: string | null | undefined;
  name?: string | null | undefined;
  address?: string | null | undefined;
  hasActiveWork?: boolean | undefined;
  hasRecentActivity?: boolean | undefined;
};

export class MatchingService implements MatchingServiceApi {
  constructor(
    private readonly store: MatchCandidateStore,
    private readonly repairShopr: RepairShoprMatchReader,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID,
  ) {}

  async listJobMatches(jobId: string) {
    return buildSearchResponse(jobId, await this.store.listForJob(jobId));
  }

  async searchJobMatches(jobId: string, input: MatchSearchInput) {
    const records = await this.searchRepairShopr(input);
    const candidates = scoreRecords(input, records, this.createId);

    await this.store.replaceForJob(jobId, candidates);

    return buildSearchResponse(jobId, candidates);
  }

  async selectMatch(jobId: string, candidateId: string) {
    const repairShoprReference = await this.store.selectForJob(
      jobId,
      candidateId,
    );

    if (!repairShoprReference) {
      throw new MatchCandidateNotFoundError();
    }

    return {
      jobId,
      selectedCandidateId: candidateId,
      repairShoprReference,
    };
  }

  async unlinkMatch(jobId: string) {
    await this.store.clearSelection(jobId);

    return {
      jobId,
      selectedCandidateId: null,
      repairShoprReference: null,
    };
  }

  private async searchRepairShopr(input: MatchSearchInput) {
    const customers = await collectCustomerCandidates(this.repairShopr, input);
    const contacts = await collectContactCandidates(
      this.repairShopr,
      customers,
    );
    const leads = await collectLeadCandidates(this.repairShopr, input);
    const records = mergeRecords([...customers, ...contacts, ...leads]);

    records.push(...(await collectTicketCandidates(this.repairShopr, input)));
    await addActiveWorkContext(this.repairShopr, records);
    await addRecentActivityContext(
      this.repairShopr,
      records,
      input,
      this.now(),
    );

    return records;
  }
}

async function collectCustomerCandidates(
  repairShopr: RepairShoprMatchReader,
  input: MatchSearchInput,
) {
  const customers: RepairShoprCustomer[] = [];
  const customerQueries = [
    input.phone ? { phone: input.phone } : undefined,
    input.phone ? { mobile: input.phone } : undefined,
    input.email ? { email: input.email } : undefined,
    ...uniqueTextValues(input.name, input.address).map((query) => ({ query })),
  ];

  for (const query of customerQueries) {
    if (query) {
      customers.push(...(await repairShopr.listCustomers(query)));
    }
  }

  return customers.map((customer) => customerRecord(repairShopr, customer));
}

async function collectContactCandidates(
  repairShopr: RepairShoprMatchReader,
  customerRecords: ScoreableRecord[],
) {
  const contacts: RepairShoprContact[] = [];
  const customerIds = uniqueNumbers(
    customerRecords.map((record) => record.customerId),
  );

  for (const customerId of customerIds) {
    contacts.push(
      ...(await repairShopr.listContacts({ customer_id: customerId })),
    );
  }

  return contacts.map((contact) => contactRecord(repairShopr, contact));
}

async function collectLeadCandidates(
  repairShopr: RepairShoprMatchReader,
  input: MatchSearchInput,
) {
  const leads: RepairShoprLead[] = [];

  for (const query of uniqueTextValues(
    input.phone,
    input.email,
    input.name,
    input.address,
  )) {
    leads.push(...(await repairShopr.listLeads({ query })));
  }

  return leads.map((lead) => leadRecord(repairShopr, lead));
}

async function collectTicketCandidates(
  repairShopr: RepairShoprMatchReader,
  input: MatchSearchInput,
) {
  if (!input.ticketNumber) {
    return [];
  }

  return (await repairShopr.listTickets({ number: input.ticketNumber })).map(
    (ticket) => ticketRecord(repairShopr, ticket),
  );
}

async function addActiveWorkContext(
  repairShopr: RepairShoprMatchReader,
  records: ScoreableRecord[],
) {
  const customerIds = uniqueNumbers(records.map((record) => record.customerId));
  const contactIds = uniqueNumbers(records.map((record) => record.contactId));
  const tickets: RepairShoprTicket[] = [];

  for (const customerId of customerIds) {
    tickets.push(
      ...(await repairShopr.listTickets({ customer_id: customerId })),
    );
  }

  for (const contactId of contactIds) {
    tickets.push(...(await repairShopr.listTickets({ contact_id: contactId })));
  }

  for (const record of records) {
    record.hasActiveWork ||= tickets.some(
      (ticket) =>
        isActiveTicket(ticket) &&
        ((record.customerId !== undefined &&
          ticket.customer_id === record.customerId) ||
          (record.contactId !== undefined &&
            ticket.contact_id === record.contactId)),
    );
  }
}

async function addRecentActivityContext(
  repairShopr: RepairShoprMatchReader,
  records: ScoreableRecord[],
  input: MatchSearchInput,
  now: Date,
) {
  const since = lookbackDate(now);
  const appointments = await repairShopr.listAppointments({
    date_from: since,
    date_to: isoDate(now),
  });
  const invoices = await repairShopr.listInvoices({ since_updated_at: since });

  markRecentActivity(records, appointments);
  markRecentActivity(records, invoices);

  for (const query of uniqueTextValues(input.phone, input.email, input.name)) {
    const payments = await repairShopr.listPayments({ query });
    for (const payment of payments) {
      if (payment.customer) {
        records.push({
          ...customerRecord(repairShopr, payment.customer),
          hasRecentActivity: true,
        });
      }
    }
  }
}

function customerRecord(
  repairShopr: RepairShoprMatchReader,
  customer: RepairShoprCustomer,
): ScoreableRecord {
  return {
    reference: repairShopr.toReference("customer", customer),
    customerId: customer.id,
    phone: customer.phone,
    mobile: customer.mobile,
    email: customer.email,
    name:
      customer.business_then_name ??
      customer.business_and_full_name ??
      customer.fullname ??
      customer.business_name,
    address: joinAddress([
      customer.address,
      customer.address_2,
      customer.city,
      customer.state,
      customer.zip,
    ]),
  };
}

function contactRecord(
  repairShopr: RepairShoprMatchReader,
  contact: RepairShoprContact,
): ScoreableRecord {
  return {
    reference: repairShopr.toReference("contact", contact),
    customerId: contact.customer_id,
    contactId: contact.id,
    phone: contact.phone,
    mobile: contact.mobile,
    email: contact.email,
    name: contact.name,
    address: joinAddress([
      contact.address1,
      contact.address2,
      contact.city,
      contact.state,
      contact.zip,
    ]),
  };
}

function leadRecord(
  repairShopr: RepairShoprMatchReader,
  lead: RepairShoprLead,
): ScoreableRecord {
  return {
    reference: repairShopr.toReference("lead", lead),
    customerId: lead.customer_id,
    contactId: lead.contact_id,
    phone: lead.phone,
    mobile: lead.mobile,
    email: lead.email,
    name:
      lead.business_then_name ?? joinAddress([lead.first_name, lead.last_name]),
    address: joinAddress([lead.address, lead.city, lead.state, lead.zip]),
  };
}

function ticketRecord(
  repairShopr: RepairShoprMatchReader,
  ticket: RepairShoprTicket,
): ScoreableRecord {
  return {
    reference: repairShopr.toReference("ticket", ticket),
    customerId: ticket.customer_id,
    contactId: ticket.contact_id,
    name: ticket.customer_business_then_name ?? ticket.subject,
    hasActiveWork: isActiveTicket(ticket),
  };
}

function scoreRecords(
  input: MatchSearchInput,
  records: ScoreableRecord[],
  createId: () => string,
): MatchCandidate[] {
  return mergeRecords(records)
    .map((record) => {
      const reasons = scoreReasons(input, record);
      const confidence = Math.min(
        1,
        reasons.reduce((sum, item) => sum + item.weight, 0),
      );

      return {
        id: createId(),
        confidence,
        confidenceBand: confidenceBandForScore(confidence),
        reasons,
        repairShoprReference: record.reference,
      };
    })
    .filter((candidate) => candidate.reasons.length > 0)
    .sort((left, right) => right.confidence - left.confidence);
}

function scoreReasons(input: MatchSearchInput, record: ScoreableRecord) {
  const reasons: MatchReason[] = [];

  if (input.phone && phoneMatches(input.phone, record.phone, record.mobile)) {
    reasons.push(
      reason("Phone match", "Phone or mobile number matches.", "exactPhone"),
    );
  }

  if (input.email && emailsMatch(input.email, record.email)) {
    reasons.push(reason("Email match", "Email address matches.", "exactEmail"));
  }

  if (input.name && namesOverlap(input.name, record.name)) {
    reasons.push(reason("Name match", "Name tokens overlap.", "name"));
  }

  if (input.address && addressesOverlap(input.address, record.address)) {
    reasons.push(reason("Address match", "Address text overlaps.", "address"));
  }

  if (record.hasActiveWork) {
    reasons.push(
      reason("Active work", "Open RepairShopr work is present.", "activeWork"),
    );
  }

  if (record.hasRecentActivity) {
    reasons.push(
      reason(
        "Recent activity",
        "Recent RepairShopr activity is present.",
        "recentActivity",
      ),
    );
  }

  return reasons;
}

function buildSearchResponse(
  jobId: string,
  candidates: MatchCandidate[],
): MatchSearchResponse {
  const linkableCandidates = candidates.filter(
    (candidate) => candidate.confidence >= MatchConfidenceThresholds.mediumHigh,
  );
  const [displayLinkedCandidate] = linkableCandidates;

  return {
    jobId,
    candidates,
    displayLinkedCandidateId:
      linkableCandidates.length === 1 && displayLinkedCandidate
        ? displayLinkedCandidate.id
        : null,
    requiresConfirmation: linkableCandidates.length !== 1,
  };
}

function mergeRecords(records: ScoreableRecord[]) {
  const mergedRecords = new Map<string, ScoreableRecord>();

  for (const record of records) {
    const key = `${record.reference.entityType}:${record.reference.repairShoprId}`;
    const existing = mergedRecords.get(key);

    if (!existing) {
      mergedRecords.set(key, { ...record });
      continue;
    }

    existing.customerId ??= record.customerId;
    existing.contactId ??= record.contactId;
    existing.phone ??= record.phone;
    existing.mobile ??= record.mobile;
    existing.email ??= record.email;
    existing.name ??= record.name;
    existing.address ??= record.address;
    existing.hasActiveWork ||= record.hasActiveWork;
    existing.hasRecentActivity ||= record.hasRecentActivity;
  }

  return [...mergedRecords.values()];
}

function markRecentActivity(
  records: ScoreableRecord[],
  activity: Array<RepairShoprAppointment | RepairShoprInvoice>,
) {
  for (const record of records) {
    record.hasRecentActivity ||= activity.some(
      (item) =>
        record.customerId !== undefined &&
        item.customer_id === record.customerId,
    );
  }
}

function reason(
  label: string,
  detail: string,
  weightKey: keyof typeof MATCH_REASON_WEIGHTS,
): MatchReason {
  return {
    label,
    detail,
    weight: MATCH_REASON_WEIGHTS[weightKey],
  };
}

function confidenceBandForScore(score: number): MatchConfidenceBand {
  if (score >= MatchConfidenceThresholds.high) {
    return "high";
  }

  if (score >= MatchConfidenceThresholds.mediumHigh) {
    return "medium_high";
  }

  return "low";
}

function phoneMatches(
  inputPhone: string,
  primaryPhone?: string | null,
  mobilePhone?: string | null,
) {
  const inputDigits = comparablePhone(inputPhone);
  if (!inputDigits) {
    return false;
  }

  return [primaryPhone, mobilePhone].some(
    (phone) => comparablePhone(phone) === inputDigits,
  );
}

function comparablePhone(phone?: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length < 7) {
    return null;
  }

  return digits.length > 10 ? digits.slice(-10) : digits;
}

function emailsMatch(inputEmail: string, recordEmail?: string | null) {
  return normalizeText(inputEmail) === normalizeText(recordEmail);
}

function namesOverlap(inputName: string, recordName?: string | null) {
  return tokenOverlap(inputName, recordName, 1);
}

function addressesOverlap(inputAddress: string, recordAddress?: string | null) {
  return tokenOverlap(inputAddress, recordAddress, 2);
}

function tokenOverlap(
  inputValue: string,
  recordValue: string | null | undefined,
  minimumOverlap: number,
) {
  const inputTokens = tokens(inputValue);
  const recordTokens = tokens(recordValue);

  if (inputTokens.length === 0 || recordTokens.length === 0) {
    return false;
  }

  const overlap = inputTokens.filter((token) => recordTokens.includes(token));
  return overlap.length >= Math.min(minimumOverlap, inputTokens.length);
}

function tokens(value?: string | null) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1);
}

function normalizeText(value?: string | null) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function joinAddress(parts: Array<string | null | undefined>) {
  const address = parts.filter(isPresentText).join(" ");
  return address.length > 0 ? address : null;
}

function uniqueTextValues(...values: Array<string | null | undefined>) {
  return [
    ...new Set(values.filter(isPresentText).map((value) => value.trim())),
  ];
}

function uniqueNumbers(values: Array<number | null | undefined>) {
  return [...new Set(values.filter((value) => typeof value === "number"))];
}

function isPresentText(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isActiveTicket(ticket: RepairShoprTicket) {
  return ACTIVE_TICKET_STATUSES.has(normalizeText(ticket.status));
}

function lookbackDate(now: Date) {
  return isoDate(
    new Date(now.getTime() - RECENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
  );
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}
