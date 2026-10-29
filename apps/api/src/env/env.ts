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
