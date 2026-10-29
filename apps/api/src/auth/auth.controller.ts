import {
  type Login,
  loginSchema,
  type Signup,
  signupSchema,
  type User,
} from '@ai-cv-builder/shared';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../http/zod-validation.pipe.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { Public } from './public.decorator.js';
import { clearSessionCookie, setSessionCookie } from './session-cookie.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  async signup(
    @Body(new ZodValidationPipe(signupSchema)) body: Signup,
    @Res({ passthrough: true }) res: Response,
  ): Promise<User> {
    const { user, token } = await this.auth.signup(body);
    setSessionCookie(res, token);
    return user;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: Login,
    @Res({ passthrough: true }) res: Response,
  ): Promise<User> {
    const { user, token } = await this.auth.login(body);
    setSessionCookie(res, token);
    return user;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    // The guard already proved the cookie holds a live session.
    await this.auth.logout(req.sessionToken!);
    clearSessionCookie(res);
  }

  @Get('me')
  me(@CurrentUser() user: User): User {
    return user;
  }
}
