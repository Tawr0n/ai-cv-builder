import { z } from 'zod';

/** Name of the session cookie; the API sets it and the web proxy looks for it. */
export const SESSION_COOKIE = 'sid';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const signupSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  })
  .meta({ id: 'Signup' });

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
  })
  .meta({ id: 'Login' });

export const userSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
  })
  .meta({ id: 'User' });

export type Signup = z.infer<typeof signupSchema>;
export type Login = z.infer<typeof loginSchema>;
export type User = z.infer<typeof userSchema>;
