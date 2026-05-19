# PRD01 - Service Referral Ops Agent

## 1. What & Why

The business currently forwards repair and support work to Ilya through informal text messages, which leaves weak visibility into which jobs he accepts, what was scheduled, what was completed, what the customer paid, which expenses were deducted, and what split is owed. This feature creates a mobile-first operations agent that lets Ilya and the owner capture job activity with minimal typing while keeping RepairShopr as the source of truth for customer, lead, ticket, appointment, invoice, and payment records.

The first version should reduce manual coordination without letting AI make customer commitments. The agent can gather missing context, infer likely RepairShopr records, prompt Ilya when closeout details are missing, and present an owner dashboard for reconciliation.

## 1.5. System Context

- **System Name**: Service Referral Ops Agent
- **Module Role**: Capture delegated job updates, support async intake, and reconcile profit splits.
- **Related Modules**:
  - RepairShopr CRM, leads, tickets, appointments, invoices, payments, contacts, phones, and ticket comments.
  - Mobile app for Ilya and owner workflows.
  - Twilio SMS/MMS for customer-facing async intake.
- **Data Flow**:
  - Customer or owner context is matched against RepairShopr records.
  - Ilya sends short job updates or uses the app to take over a customer conversation.
  - The agent asks for missing details, proposes record matches, and records confirmed job state.
  - Confirmed job, appointment, invoice, payment, expense, and split data appears in the owner dashboard.
- **Independent Value**: The owner can see delegated job status and split math even if customer-facing automation remains limited.

## 2. Requirements

### Must-Have (P0)

- **Ilya Job Capture**: Ilya can send terse updates through a mobile-first message flow or app UI, and the agent extracts customer, job, time, charge, expense, completion, and follow-up details.
  - **User Story**: As Ilya, I want to report work in short natural-language messages, so that I can close out jobs without doing back-office data entry.

- **RepairShopr Record Matching**: The system can identify likely existing RepairShopr leads, customers, tickets, appointments, invoices, and payments from partial names, phone numbers, emails, addresses, and recent activity.
  - **User Story**: As the owner, I want job updates matched to the right RepairShopr record, so that delegated work stays tied to the CRM instead of floating in text threads.

- **Low-Confidence Confirmation**: The agent must ask for confirmation when it cannot confidently match a customer or job.
  - **User Story**: As the owner, I want uncertain matches to be confirmed before writeback, so that the system does not attach work to the wrong customer.

- **Staged RepairShopr Writeback**: The agent stages proposed RepairShopr updates in the app, and either Ilya or the owner can approve them with a quick action.
  - **User Story**: As Ilya or the owner, I want proposed CRM changes to be one-tap approveable, so that writeback is fast without making AI the final authority.

- **Async Customer Intake**: The system can gather basic customer information asynchronously: phone number, email, first name, last name, service address, and issue description.
  - **User Story**: As a customer, I want to provide appointment intake details asynchronously, so that I do not need to answer every question during a live call.

- **Customer SMS/MMS Channel**: Customers can text the service number through Twilio to start or continue an intake conversation.
  - **User Story**: As a customer, I want to text the service instead of waiting on a call, so that I can provide details when I have time.

- **Existing Customer Short-Circuit**: If the customer is identified from RepairShopr, the agent stops asking for information already known and only asks for missing or stale fields.
  - **User Story**: As a customer, I do not want to repeat details the business already has, so that the intake flow feels lightweight.

- **Customer Contact Cards**: When a new customer is identified, the app offers a contact card that the owner can add to their phone contacts.
  - **User Story**: As the owner, I want an easy contact card for each new identified customer, so that I can save customer details without manually copying names, phone numbers, emails, and addresses.

- **Ilya Approval Before Scheduling Commitments**: The system must not promise appointment times, arrival windows, or availability without explicit Ilya approval.
  - **User Story**: As Ilya, I want the system to collect scheduling context but wait for my approval, so that customers are not promised times I cannot honor.

- **Live Agent Takeover**: Ilya can take over a customer conversation from the app. While takeover is active, the AI stops responding to the customer unless Ilya releases control.
  - **User Story**: As Ilya, I want to jump into a conversation when needed, so that I can handle nuanced customer communication directly.

- **Closeout Reminders**: The agent can detect jobs that appear accepted or scheduled but lack closeout details and prompt Ilya to finish the record.
  - **User Story**: As the owner, I want Ilya to be reminded about unfinished job records, so that completed work does not disappear from reporting.

- **Profit Split Tracking**: The system calculates splits from Ilya-reported profit or profit after reported expenses, with split categories for returning RepairShopr customers, new leads, and manually overridden customer-service-heavy work.
  - **User Story**: As the owner, I want split reports based on profit after expenses, so that payouts reflect the agreed economics.

- **Completion-Based Payout Readiness**: A job becomes payout-ready when Ilya marks it complete by chat or app UI and the required charge, expense, or profit details are present.
  - **User Story**: As the owner, I want Ilya's completion confirmation to drive payout readiness, so that the workflow stays hands-off.

- **Owner Dashboard**: The app includes an owner-facing dashboard for open leads, scheduled jobs, completed jobs, unmatched updates, customer takeover state, revenue, expenses, profit, and split amounts.
  - **User Story**: As the owner, I want a single dashboard for delegated work, so that I can reconcile jobs and payouts without searching texts.

### Nice-to-Have (P1)

- **Customer Canned Response Launcher**: The owner can send a canned response that routes customers into the async intake flow.
- **Conversation Summary**: The agent can summarize the last relevant conversation context when Ilya opens a job or customer thread.

### Out of Scope

- AI handling inbound phone calls.
- AI voice agent behavior.
- Autonomous appointment creation or arrival-time promises without Ilya approval.
- Customer payment collection.
- Automated pricing or quoting decisions.
- Replacing RepairShopr as the CRM, ticketing, invoicing, payment, or appointment source of truth.
- RepairShopr appointment reminder emails, because those already exist in CRM.
- Full customer service ownership by Ilya unless manually marked for a different split category.
- Replacing the Twilio customer-facing channel with another v1 customer transport.

### Acceptance Criteria

- Ilya can submit a message like "went to Michele, 1 hr 200" and the system creates a structured job update with extracted customer hint, labor duration, charge, completion state, and missing fields to resolve.
- When exactly one high-confidence RepairShopr match exists, the system links the update to that record and shows the basis for the match.
- When multiple plausible matches or no match exists, the system asks a follow-up question instead of writing to the wrong record.
- The customer intake flow collects first name, last name, phone number, email, address, and issue description unless those fields are already known from an identified RepairShopr record.
- Customers can initiate or continue intake by texting the Twilio service number.
- Unknown customer texts do not create durable RepairShopr leads until minimum intake information is collected and the message passes basic spam and abuse checks.
- Each newly identified customer with at least a name and phone number has an app-accessible contact card that can be added to the owner's phone contacts.
- The system never sends a customer a confirmed appointment time, arrival window, or availability promise until Ilya explicitly approves it.
- Ilya can approve proposed appointment times, customer-facing scheduling messages, and RepairShopr appointment creation.
- Proposed RepairShopr writebacks are staged in the app and can be approved by Ilya or the owner with a quick action.
- When Ilya takes over a customer conversation, AI customer responses pause and takeover state is visible in the dashboard.
- A scheduled or accepted job that has no completion, charge/profit basis, or needed expense details triggers a closeout reminder to Ilya.
- The dashboard shows each job's customer, source category, current state, RepairShopr link, gross charge, expenses, profit, split category, and payout amounts.
- Split calculations use Ilya-reported profit when present, otherwise profit after reported expenses, not gross revenue.
- Returning RepairShopr customers use a 30/70 owner/Ilya profit split, new leads use a 20/80 owner/Ilya profit split, and manually marked customer-service-heavy jobs use a 50/50 split.
- Jobs become payout-ready when Ilya marks them complete by chat or app UI and either reported profit or enough charge/expense detail is present.
- The dashboard separates unresolved/unmatched items from reconciled jobs.

## 3. Behavior

- The owner or customer initiates a job or intake flow through the configured channel.
- The system searches RepairShopr for likely matching customers, contacts, leads, tickets, appointments, invoices, and payments using available identifiers and recent activity.
- If an existing record is found, the system uses known CRM fields and asks only for missing information.
- If no record is found, the system gathers the minimum required intake details and marks the record as new or unmatched until confirmed.
- Ilya can accept, schedule, take over, update, or close out a job from the app or message flow.
- Ilya can approve scheduling actions, customer-facing scheduling messages, and RepairShopr appointment creation from the app.
- The agent converts Ilya's natural-language updates into structured fields and prompts for missing values only when needed.
- The system records completion based on Ilya's confirmation.
- The system calculates profit from Ilya-reported profit when present, otherwise from gross charge minus reported expenses, then applies the configured split category.
- The owner reviews active, completed, unresolved, and payout-ready jobs in the dashboard.

## 4. Constraints

- RepairShopr remains the source of truth for CRM, lead, ticket, appointment, invoice, and payment records.
- Twilio SMS/MMS is the v1 customer-facing channel.
- Internal Ilya workflows should not require paid SMS if a mobile app or push-based flow can provide the same message-like experience.
- Customer-facing automation must be conservative: collect information, identify records, and hand off, but do not make scheduling commitments.
- Customer-facing intake must include basic spam and abuse controls before creating durable CRM records from unknown numbers.
- All AI-extracted facts that affect money, scheduling, customer identity, or CRM writeback must be traceable to the source message or confirmed by Ilya or the owner.
- Ilya's job completion confirmation is trusted for v1, whether submitted through chat or app UI.

## 5. Resolved Decisions

- Travel, parking, and tolls are Ilya's responsibility and are not deducted from profit.
- V1 tracks total amount charged, explicit parts/materials/subcontractor costs when Ilya reports them, or Ilya's directly reported profit when he provides it.
- Ilya is trusted to enter and edit charge, expense, and profit information. Owner review and override are available, but owner approval is not required before split calculation.
- High-confidence matches can auto-link for display. Medium-high single-candidate matches are acceptable when match reasons are visible. Ambiguous or low-confidence matches require confirmation or more information.
- Any existing RepairShopr customer is a returning customer, not a new lead. A new lead means no matching RepairShopr customer exists before this workflow creates or stages the record.
