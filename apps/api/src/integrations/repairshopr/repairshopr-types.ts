import { z } from "zod";

const NullableStringSchema = z.string().nullable().optional();
const NullableNumberSchema = z.number().nullable().optional();
const UnknownRecordSchema = z.record(z.string(), z.unknown()).optional();

export const RepairShoprMetaSchema = z.object({
  total_pages: z.number().optional(),
  total_entries: z.number().optional(),
  per_page: z.number().optional(),
  page: z.number().optional(),
});

export const RepairShoprCustomerSchema = z
  .object({
    id: z.number(),
    firstname: NullableStringSchema,
    lastname: NullableStringSchema,
    fullname: NullableStringSchema,
    business_name: NullableStringSchema,
    business_and_full_name: NullableStringSchema,
    business_then_name: NullableStringSchema,
    email: NullableStringSchema,
    phone: NullableStringSchema,
    mobile: NullableStringSchema,
    address: NullableStringSchema,
    address_2: NullableStringSchema,
    city: NullableStringSchema,
    state: NullableStringSchema,
    zip: NullableStringSchema,
    created_at: NullableStringSchema,
    updated_at: NullableStringSchema,
    properties: UnknownRecordSchema,
  })
  .passthrough();

export const RepairShoprContactSchema = z
  .object({
    id: z.number(),
    customer_id: z.number().nullable().optional(),
    name: NullableStringSchema,
    email: NullableStringSchema,
    phone: NullableStringSchema,
    mobile: NullableStringSchema,
    address1: NullableStringSchema,
    address2: NullableStringSchema,
    city: NullableStringSchema,
    state: NullableStringSchema,
    zip: NullableStringSchema,
    created_at: NullableStringSchema,
    updated_at: NullableStringSchema,
    properties: UnknownRecordSchema,
  })
  .passthrough();

export const RepairShoprLeadSchema = z
  .object({
    id: z.number(),
    first_name: NullableStringSchema,
    last_name: NullableStringSchema,
    business_then_name: NullableStringSchema,
    email: NullableStringSchema,
    phone: NullableStringSchema,
    mobile: NullableStringSchema,
    address: NullableStringSchema,
    city: NullableStringSchema,
    state: NullableStringSchema,
    zip: NullableStringSchema,
    status: NullableStringSchema,
    ticket_id: z.number().nullable().optional(),
    customer_id: z.number().nullable().optional(),
    contact_id: z.number().nullable().optional(),
    created_at: NullableStringSchema,
    updated_at: NullableStringSchema,
  })
  .passthrough();

export const RepairShoprTicketSchema = z
  .object({
    id: z.number(),
    number: z.union([z.number(), z.string()]).optional(),
    subject: NullableStringSchema,
    customer_id: z.number().nullable().optional(),
    contact_id: z.number().nullable().optional(),
    customer_business_then_name: NullableStringSchema,
    status: NullableStringSchema,
    problem_type: NullableStringSchema,
    created_at: NullableStringSchema,
    updated_at: NullableStringSchema,
    resolved_at: NullableStringSchema,
  })
  .passthrough();

export const RepairShoprAppointmentSchema = z
  .object({
    id: z.number(),
    summary: NullableStringSchema,
    description: NullableStringSchema,
    customer_id: z.number().nullable().optional(),
    ticket_id: z.number().nullable().optional(),
    start_at: NullableStringSchema,
    end_at: NullableStringSchema,
    created_at: NullableStringSchema,
    updated_at: NullableStringSchema,
  })
  .passthrough();

const RepairShoprAppointmentEnvelopeSchema = z
  .object({
    appointment: RepairShoprAppointmentSchema,
  })
  .passthrough();

export const RepairShoprInvoiceSchema = z
  .object({
    id: z.number(),
    customer_id: z.number().nullable().optional(),
    contact_id: z.number().nullable().optional(),
    ticket_id: z.number().nullable().optional(),
    customer_business_then_name: NullableStringSchema,
    number: z.union([z.number(), z.string()]).optional(),
    total: z.union([z.number(), z.string()]).nullable().optional(),
    subtotal: z.union([z.number(), z.string()]).nullable().optional(),
    amount_paid: NullableNumberSchema,
    balance_due: NullableNumberSchema,
    is_paid: z.boolean().optional(),
    verified_paid: z.boolean().optional(),
    created_at: NullableStringSchema,
    updated_at: NullableStringSchema,
  })
  .passthrough();

export const RepairShoprPaymentSchema = z
  .object({
    id: z.number(),
    success: z.boolean().optional(),
    payment_amount: NullableNumberSchema,
    invoice_ids: z.array(z.number().nullable()).optional(),
    customer: RepairShoprCustomerSchema.optional(),
    ref_num: NullableStringSchema,
    payment_method: NullableStringSchema,
    created_at: NullableStringSchema,
    updated_at: NullableStringSchema,
  })
  .passthrough();

export const RepairShoprTicketCommentSchema = z
  .object({
    id: z.number(),
    ticket_id: z.number().nullable().optional(),
    subject: NullableStringSchema,
    body: NullableStringSchema,
    hidden: z.boolean().optional(),
    user_id: z.number().nullable().optional(),
    created_at: NullableStringSchema,
    updated_at: NullableStringSchema,
  })
  .passthrough();

export const RepairShoprCustomersResponseSchema = z.object({
  customers: z.array(RepairShoprCustomerSchema),
  meta: RepairShoprMetaSchema.optional(),
});

export const RepairShoprContactsResponseSchema = z.object({
  contacts: z.array(RepairShoprContactSchema),
  meta: RepairShoprMetaSchema.optional(),
});

export const RepairShoprLeadsResponseSchema = z.object({
  leads: z.array(RepairShoprLeadSchema),
  meta: RepairShoprMetaSchema.optional(),
});

export const RepairShoprTicketsResponseSchema = z.object({
  tickets: z.array(RepairShoprTicketSchema),
  meta: RepairShoprMetaSchema.optional(),
});

export const RepairShoprAppointmentsResponseSchema = z.object({
  appointments: z.array(
    z.union([
      RepairShoprAppointmentSchema,
      RepairShoprAppointmentEnvelopeSchema,
    ]),
  ),
  meta: RepairShoprMetaSchema.optional(),
});

export const RepairShoprInvoicesResponseSchema = z.object({
  invoices: z.array(RepairShoprInvoiceSchema),
  meta: RepairShoprMetaSchema.optional(),
});

export const RepairShoprPaymentsResponseSchema = z.object({
  payments: z.array(RepairShoprPaymentSchema),
  meta: RepairShoprMetaSchema.optional(),
});

export const RepairShoprTicketCommentsResponseSchema = z.object({
  comments: z.array(RepairShoprTicketCommentSchema),
  meta: RepairShoprMetaSchema.optional(),
});

export const RepairShoprPageQuerySchema = z.object({
  page: z.number().int().positive().optional(),
});

export const RepairShoprCustomerQuerySchema = RepairShoprPageQuerySchema.extend(
  {
    query: z.string().min(1).optional(),
    firstname: z.string().min(1).optional(),
    lastname: z.string().min(1).optional(),
    business_name: z.string().min(1).optional(),
    email: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    mobile: z.string().min(1).optional(),
  },
);

export const RepairShoprContactQuerySchema = RepairShoprPageQuerySchema.extend({
  customer_id: z.number().int().positive().optional(),
});

export const RepairShoprLeadQuerySchema = RepairShoprPageQuerySchema.extend({
  query: z.string().min(1).optional(),
  status_list: z.string().min(1).optional(),
  has_ticket: z.boolean().optional(),
});

export const RepairShoprTicketQuerySchema = RepairShoprPageQuerySchema.extend({
  customer_id: z.number().int().positive().optional(),
  contact_id: z.number().int().positive().optional(),
  number: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  created_after: z.string().min(1).optional(),
  since_updated_at: z.string().min(1).optional(),
});

export const RepairShoprAppointmentQuerySchema =
  RepairShoprPageQuerySchema.extend({
    date_from: z.string().min(1).optional(),
    date_to: z.string().min(1).optional(),
    mine: z.boolean().optional(),
  });

export const RepairShoprInvoiceQuerySchema = RepairShoprPageQuerySchema.extend({
  paid: z.boolean().optional(),
  unpaid: z.boolean().optional(),
  ticket_id: z.number().int().positive().optional(),
  since_updated_at: z.string().min(1).optional(),
});

export const RepairShoprPaymentQuerySchema = RepairShoprPageQuerySchema.extend({
  query: z.string().min(1).optional(),
});

export const RepairShoprTicketCommentQuerySchema =
  RepairShoprPageQuerySchema.extend({
    ticket_id: z.number().int().positive().optional(),
    customer_id: z.number().int().positive().optional(),
    contact_id: z.number().int().positive().optional(),
    status: z.string().min(1).optional(),
    comment_created_after: z.string().min(1).optional(),
    comment_created_before: z.string().min(1).optional(),
  });

export const RepairShoprTicketCommentForTicketQuerySchema =
  RepairShoprPageQuerySchema.extend({
    sort_by: z.enum(["created_at", "updated_at"]).optional(),
    sort_direction: z.enum(["ASC", "DESC"]).optional(),
    created_after: z.string().min(1).optional(),
    created_before: z.string().min(1).optional(),
    updated_after: z.string().min(1).optional(),
    updated_before: z.string().min(1).optional(),
    per_page: z.number().int().positive().optional(),
    comment_format: z.enum(["plaintext", "richtext", "original"]).optional(),
  });

export type RepairShoprCustomer = z.infer<typeof RepairShoprCustomerSchema>;
export type RepairShoprContact = z.infer<typeof RepairShoprContactSchema>;
export type RepairShoprLead = z.infer<typeof RepairShoprLeadSchema>;
export type RepairShoprTicket = z.infer<typeof RepairShoprTicketSchema>;
export type RepairShoprAppointment = z.infer<
  typeof RepairShoprAppointmentSchema
>;
export type RepairShoprInvoice = z.infer<typeof RepairShoprInvoiceSchema>;
export type RepairShoprPayment = z.infer<typeof RepairShoprPaymentSchema>;
export type RepairShoprTicketComment = z.infer<
  typeof RepairShoprTicketCommentSchema
>;
export type RepairShoprCustomerQuery = z.infer<
  typeof RepairShoprCustomerQuerySchema
>;
export type RepairShoprContactQuery = z.infer<
  typeof RepairShoprContactQuerySchema
>;
export type RepairShoprLeadQuery = z.infer<typeof RepairShoprLeadQuerySchema>;
export type RepairShoprTicketQuery = z.infer<
  typeof RepairShoprTicketQuerySchema
>;
export type RepairShoprAppointmentQuery = z.infer<
  typeof RepairShoprAppointmentQuerySchema
>;
export type RepairShoprInvoiceQuery = z.infer<
  typeof RepairShoprInvoiceQuerySchema
>;
export type RepairShoprPaymentQuery = z.infer<
  typeof RepairShoprPaymentQuerySchema
>;
export type RepairShoprTicketCommentQuery = z.infer<
  typeof RepairShoprTicketCommentQuerySchema
>;
export type RepairShoprTicketCommentForTicketQuery = z.infer<
  typeof RepairShoprTicketCommentForTicketQuerySchema
>;

export function unwrapAppointment(
  appointment:
    | RepairShoprAppointment
    | z.infer<typeof RepairShoprAppointmentEnvelopeSchema>,
): RepairShoprAppointment {
  if ("appointment" in appointment) {
    return RepairShoprAppointmentSchema.parse(appointment.appointment);
  }

  return appointment;
}
