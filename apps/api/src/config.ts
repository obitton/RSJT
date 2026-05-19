import { z } from "zod";

const ConfigSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(47630),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(720),
  REPAIRSHOPR_SUBDOMAIN: z.string().min(1).optional(),
  REPAIRSHOPR_API_KEY: z.string().min(1).optional(),
  REPAIRSHOPR_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
});

export type ApiConfig = z.infer<typeof ConfigSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return ConfigSchema.parse(env);
}
