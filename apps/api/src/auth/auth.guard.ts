import { SESSION_COOKIE } from '@ai-cv-builder/shared';
import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { ApiException } from '../http/api.exception.js';
import { AuthService } from './auth.service.js';
import { IS_PUBLIC } from './public.decorator.js';
import { setSessionCookie } from './session-cookie.js';

/** Global guard: every route needs a valid session unless it is marked `@Public()`. */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const cookie: unknown = req.cookies?.[SESSION_COOKIE];
    const token = typeof cookie === 'string' ? cookie : undefined;
    const session = token ? await this.auth.authenticate(token) : null;
    if (!token || !session) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'unauthenticated',
        'Log in to continue',
      );
    }

    req.user = session.user;
    req.sessionToken = token;
    if (session.renewed) {
      setSessionCookie(http.getResponse<Response>(), token);
    }
    return true;
  }
}
