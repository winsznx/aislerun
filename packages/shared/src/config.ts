import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  SERVICE_BASE_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  PAYMENT_RECEIVER: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  X402_NETWORK: z.literal("eip155:8453"),
  X402_FACILITATOR_URL: z.string().url(),
  INSPECTION_PRICE_USD: z.string().regex(/^\d+(\.\d{1,6})?$/),
  REPORT_TOKEN_SECRET: z.string().min(32),
  EVIDENCE_DIR: z.string().min(1),
  FIXTURE_ORIGIN: z.string().url(),
  WEB_BASE_URL: z.string().url(),
  WORKER_ENABLED: z.enum(["true", "false"]).default("true"),
  BUILD_VERSION: z.string().default("dev"),
  DEMO_RUNS: z.string().optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

let cached: Config | undefined;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (cached) return cached;
  const parsed = ConfigSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid configuration: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}
