import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { ENV, type Env } from '../env/env.js';
import { ApiException } from '../http/api.exception.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence on top of `SameSite=Lax`: an unsafe request that declares an
 * `Origin` must come from the web app. Browsers always send `Origin` on
 * cross-origin POSTs; requests without it (curl, tests) carry no ambient
 * browser cookies to abuse.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const origin = req.get('origin');
    if (
      SAFE_METHODS.has(req.method) ||
      origin === undefined ||
      this.env.APP_ORIGINS.includes(origin)
    ) {
      return true;
    }
    throw new ApiException(
      HttpStatus.FORBIDDEN,
      'forbidden_origin',
      'Request origin is not allowed',
    );
  }
}
