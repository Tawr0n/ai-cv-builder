import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const signupSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(8).max(128),
  })
  .meta({ id: 'Signup' });

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
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
