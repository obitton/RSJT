import { z } from "zod";

// Dates are Date objects on the API side and ISO strings once serialized to JSON.
// Both parse to a Date so one schema validates API output and mobile input.
export const JsonDateSchema = z.union([
  z.date(),
  z
    .string()
    .datetime({ offset: true })
    .transform((value) => new Date(value)),
]);
