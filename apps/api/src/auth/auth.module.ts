import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { OriginGuard } from './origin.guard.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    // Order matters: a foreign origin is refused before any session lookup.
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AuthModule {}
