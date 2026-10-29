import type { User } from '@ai-cv-builder/shared';

declare global {
  namespace Express {
    interface Request {
      /** Set by the AuthGuard once the session cookie checks out. */
      user?: User;
    }
  }
}
