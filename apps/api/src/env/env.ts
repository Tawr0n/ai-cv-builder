import { PDF_LIMITS } from '@ai-cv-builder/shared';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  ANTHROPIC_API_KEY: z.string().min(1),
  /** Origins the web app is served from, comma-separated; unsafe requests from any other `Origin` are refused. */
  APP_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://127.0.0.1:3000')
    .transform((list) => list.split(',').map((origin) => origin.trim()))
    .pipe(z.array(z.url()).min(1)),
  PORT: z.coerce.number().int().positive().default(3001),

  // Every limit below has a default; env only overrides it.
  PDF_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(PDF_LIMITS.maxBytes),
  PDF_MAX_PAGES: z.coerce
    .number()
    .int()
    .positive()
    .default(PDF_LIMITS.maxPages),
  /** Queued or running Generations one User may have at once: a cost fuse. */
  MAX_ACTIVE_GENERATIONS: z.coerce.number().int().positive().default(3),
  ANTHROPIC_MODEL_EXTRACT: z.string().min(1).default('claude-sonnet-5-5'),
  /** Compose's model also runs repair. */
  ANTHROPIC_MODEL_COMPOSE: z.string().min(1).default('claude-sonnet-5-5'),
  /** The last line of defence against invented facts: the strongest model. */
  ANTHROPIC_MODEL_JUDGE: z.string().min(1).default('claude-opus-5-5'),
  /** Per Anthropic call, SDK retries excluded. */
  AI_CALL_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  /** Per Generation attempt: the job's `expireInSeconds`. */
  GENERATION_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(120),
  /** A dead worker's job is noticed after this long without a heartbeat (pg-boss minimum 10). */
  GENERATION_HEARTBEAT_SECONDS: z.coerce.number().int().min(10).default(30),
  /** Generations this API process runs at once; matches the per-User active limit by default. */
  GENERATION_CONCURRENCY: z.coerce.number().int().positive().default(3),
  /** Job retries, for transient failures only. */
  GENERATION_RETRY_LIMIT: z.coerce.number().int().min(0).default(1),
  /** `false` starts the API without taking Generation jobs (tests drive the handler directly). */
  GENERATION_WORKER: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
});

export type Env = z.infer<typeof envSchema>;

/** Injection token for the validated {@link Env}. */
export const ENV = Symbol('ENV');

/** Validates the process environment; the app refuses to start on any problem. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Invalid environment:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
