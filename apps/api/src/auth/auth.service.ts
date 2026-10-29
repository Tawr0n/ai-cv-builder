import type { Login, Signup, User } from '@ai-cv-builder/shared';
import { HttpStatus, Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { ApiException } from '../http/api.exception.js';
import { SESSION_TTL_MS } from './session-cookie.js';

const PRISMA_UNIQUE_VIOLATION = 'P2002';
const USER_SELECT = { id: true, email: true } as const;

export interface IssuedSession {
  token: string;
  user: User;
}

export interface AuthenticatedSession {
  user: User;
  /** Set when the expiry was pushed forward, so the cookie must be re-sent. */
  renewed: boolean;
}

@Injectable()
export class AuthService {
  /** Checked for unknown emails so a miss takes as long as a wrong password. */
  private readonly dummyHash = hash('not-a-real-password');

  constructor(private readonly prisma: PrismaService) {}

  async signup({ email, password }: Signup): Promise<IssuedSession> {
    const passwordHash = await hash(password);
    let user: User;
    try {
      user = await this.prisma.user.create({
        data: { email, passwordHash },
        select: USER_SELECT,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiException(
          HttpStatus.CONFLICT,
          'email_taken',
          'Email already registered',
        );
      }
      throw error;
    }
    return { user, token: await this.openSession(user.id) };
  }

  async login({ email, password }: Login): Promise<IssuedSession> {
    const found = await this.prisma.user.findUnique({ where: { email } });
    const passwordOk = await verify(
      found?.passwordHash ?? (await this.dummyHash),
      password,
    );
    if (!found || !passwordOk) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'invalid_credentials',
        'Invalid email or password',
      );
    }
    const user = { id: found.id, email: found.email };
    return { user, token: await this.openSession(user.id) };
  }

  async logout(token: string) {
    await this.prisma.session.deleteMany({
      where: { tokenHash: hashToken(token) },
    });
  }

  /** The User behind a cookie token, or `null`; slides the expiry forward past half its life. */
  async authenticate(token: string): Promise<AuthenticatedSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: { select: USER_SELECT } },
    });
    if (!session) return null;

    const now = Date.now();
    if (session.expiresAt.getTime() <= now) {
      await this.prisma.session.deleteMany({ where: { id: session.id } });
      return null;
    }

    const renewed = session.expiresAt.getTime() - now < SESSION_TTL_MS / 2;
    if (renewed) {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { expiresAt: new Date(now + SESSION_TTL_MS) },
      });
    }
    return { user: session.user, renewed };
  }

  private async openSession(userId: string): Promise<string> {
    const token = randomBytes(32).toString('base64url');
    await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
    });
    return token;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === PRISMA_UNIQUE_VIOLATION
  );
}
