import {
  apiErrorSchema,
  cvListSchema,
  userSchema,
} from '@ai-cv-builder/shared';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { givenUser, TEST_PASSWORD } from './support/given-user.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('authentication', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  describe('sign up', () => {
    it('creates a User and logs them in with an httpOnly SameSite=Lax cookie', async () => {
      const response = await testApp
        .http()
        .post('/api/auth/signup')
        .send({ email: ' Ada@Example.com ', password: 'correct horse battery' })
        .expect(201);

      expect(userSchema.parse(response.body).email).toBe('ada@example.com');
      const [cookie] = response.get('set-cookie') ?? [];
      expect(cookie).toMatch(/^sid=[\w-]+;/);
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Max-Age=2592000/);
    });

    it('answers 409 email_taken for an email that already has a User', async () => {
      const { email } = await givenUser(testApp);

      const response = await testApp
        .http()
        .post('/api/auth/signup')
        .send({ email: email.toUpperCase(), password: 'another password' })
        .expect(409);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'email_taken',
      );
    });

    it('rejects a short password with 400 validation_failed', async () => {
      const response = await testApp
        .http()
        .post('/api/auth/signup')
        .send({ email: 'ada@example.com', password: 'short' })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'validation_failed',
      );
    });
  });

  describe('log in', () => {
    it('starts a new session for the right email and password', async () => {
      const { email, password } = await givenUser(testApp);

      const response = await testApp
        .http()
        .post('/api/auth/login')
        .send({ email: email.toUpperCase(), password })
        .expect(200);

      expect(userSchema.parse(response.body).email).toBe(email);
      expect(response.get('set-cookie')?.[0]).toMatch(/^sid=/);
    });

    it('answers the same 401 for a wrong password and an unknown email', async () => {
      const { email } = await givenUser(testApp);

      const wrongPassword = await testApp
        .http()
        .post('/api/auth/login')
        .send({ email, password: 'wrong password' })
        .expect(401);
      const unknownEmail = await testApp
        .http()
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: TEST_PASSWORD })
        .expect(401);

      expect(unknownEmail.body).toEqual(wrongPassword.body);
      expect(apiErrorSchema.parse(wrongPassword.body).error.code).toBe(
        'invalid_credentials',
      );
    });
  });

  describe('session', () => {
    it('keeps the User logged in across requests', async () => {
      const { agent, email } = await givenUser(testApp);

      const response = await agent.get('/api/auth/me').expect(200);

      expect(userSchema.parse(response.body).email).toBe(email);
    });

    it('ends on log out: the old cookie stops working', async () => {
      const { agent } = await givenUser(testApp);

      await agent.post('/api/auth/logout').expect(204);

      const response = await agent.get('/api/auth/me');
      expect(response.status).toBe(401);
    });

    it('does not renew a session with more than half its life left', async () => {
      const { agent } = await givenUser(testApp);

      const response = await agent.get('/api/auth/me').expect(200);

      expect(response.get('set-cookie')).toBeUndefined();
    });

    it('slides the expiry and re-sends the cookie once less than half is left', async () => {
      const { agent, user } = await givenUser(testApp);
      await setSessionExpiry(user.id, daysFromNow(10));

      const response = await agent.get('/api/auth/me').expect(200);

      expect(response.get('set-cookie')?.[0]).toMatch(/^sid=.*Max-Age=2592000/);
      const expiresAt = await sessionExpiry(user.id);
      expect(expiresAt.getTime()).toBeGreaterThan(daysFromNow(29).getTime());
    });

    it('rejects an expired session', async () => {
      const { agent, user } = await givenUser(testApp);
      await setSessionExpiry(user.id, daysFromNow(-1));

      const response = await agent.get('/api/auth/me');
      expect(response.status).toBe(401);
    });

    it('rejects a made-up cookie', async () => {
      const response = await request(testApp.app.getHttpServer())
        .get('/api/auth/me')
        .set('cookie', 'sid=made-up');

      expect(response.status).toBe(401);
    });
  });

  describe('CVs', () => {
    it('lists the (empty) CVs of the signed-in User', async () => {
      const { agent } = await givenUser(testApp);

      const response = await agent.get('/api/cvs').expect(200);

      expect(cvListSchema.parse(response.body)).toEqual({ items: [] });
    });
  });

  describe('CSRF', () => {
    it('refuses an unsafe request from a foreign Origin', async () => {
      const { agent } = await givenUser(testApp);

      const response = await agent
        .post('/api/auth/logout')
        .set('origin', 'https://evil.example')
        .expect(403);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'forbidden_origin',
      );
      const stillLoggedIn = await agent.get('/api/auth/me');
      expect(stillLoggedIn.status).toBe(200);
    });

    it('also guards the public sign-up', async () => {
      const response = await testApp
        .http()
        .post('/api/auth/signup')
        .set('origin', 'https://evil.example')
        .send({ email: 'a@example.com', password: 'correct horse battery' });

      expect(response.status).toBe(403);
    });

    it('accepts the loopback alias of the web app origin', async () => {
      const response = await testApp
        .http()
        .post('/api/auth/login')
        .set('origin', 'http://127.0.0.1:3000')
        .send({ email: 'a@example.com', password: 'whatever' });

      expect(response.status).toBe(401);
    });

    it('also guards the public log-in', async () => {
      const response = await testApp
        .http()
        .post('/api/auth/login')
        .set('origin', 'https://evil.example')
        .send({ email: 'a@example.com', password: 'whatever' });

      expect(response.status).toBe(403);
    });

    it('accepts an unsafe request from the web app origin', async () => {
      const { agent } = await givenUser(testApp);

      const response = await agent
        .post('/api/auth/logout')
        .set('origin', 'http://localhost:3000');

      expect(response.status).toBe(204);
    });
  });

  function daysFromNow(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  function setSessionExpiry(userId: string, expiresAt: Date) {
    return testApp.app
      .get(PrismaService)
      .session.updateMany({ where: { userId }, data: { expiresAt } });
  }

  async function sessionExpiry(userId: string) {
    const session = await testApp.app
      .get(PrismaService)
      .session.findFirstOrThrow({ where: { userId } });
    return session.expiresAt;
  }
});
