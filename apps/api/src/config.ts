import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(47630),
  APP_BASE_URL: z.string().url().optional(),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(720),
  REPAIRSHOPR_SUBDOMAIN: z.string().min(1).optional(),
  REPAIRSHOPR_API_KEY: z.string().min(1).optional(),
  REPAIRSHOPR_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  REPAIRSHOPR_WRITEBACK_ENABLED: z.coerce.boolean().optional(),
  REPAIRSHOPR_WRITEBACK_TEST_RECORD_ALLOWLIST: z.string().min(1).optional(),
  AI_PROVIDER: z.string().min(1).optional(),
  AI_PROVIDER_API_KEY: z.string().min(1).optional(),
  AI_MODEL: z.string().min(1).optional(),
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().min(1).optional(),
  TWILIO_FROM_PHONE_NUMBER: z.string().min(1).optional(),
  TWILIO_WHATSAPP_FROM: z.string().min(1).optional(),
  MESSAGING_CHANNEL: z
    .enum(["sms", "whatsapp_sandbox"])
    .default("whatsapp_sandbox"),
  MESSAGING_OUTBOUND_ENABLED: z.coerce.boolean().default(false),
  MESSAGING_TEST_RECIPIENT_ALLOWLIST: z.string().min(1).optional(),
});

export type ApiConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return ConfigSchema.parse(env);
}
