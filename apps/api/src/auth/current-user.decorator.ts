import type { User } from '@ai-cv-builder/shared';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** The signed-in User; only set on routes behind the {@link AuthGuard}. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User =>
    context.switchToHttp().getRequest<Request>().user!,
);
