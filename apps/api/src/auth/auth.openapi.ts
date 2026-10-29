import { loginSchema, signupSchema, userSchema } from '@ai-cv-builder/shared';
import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { errorResponse } from '../openapi/error-response.js';

const sessionCookie = {
  'Set-Cookie': {
    description: '`sid`: HttpOnly, SameSite=Lax, 30 days (sliding)',
    schema: { type: 'string' as const },
  },
};

export function registerAuthDocs(registry: OpenAPIRegistry) {
  registry.registerPath({
    method: 'post',
    path: '/api/auth/signup',
    tags: ['auth'],
    summary: 'Create a User and log them in',
    request: {
      body: { content: { 'application/json': { schema: signupSchema } } },
    },
    responses: {
      201: {
        description: 'The new User; the session cookie is set',
        headers: sessionCookie,
        content: { 'application/json': { schema: userSchema } },
      },
      400: errorResponse('`validation_failed`'),
      403: errorResponse('`forbidden_origin`'),
      409: errorResponse('`email_taken`'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/auth/login',
    tags: ['auth'],
    summary: 'Log in with email and password',
    request: {
      body: { content: { 'application/json': { schema: loginSchema } } },
    },
    responses: {
      200: {
        description: 'The User; the session cookie is set',
        headers: sessionCookie,
        content: { 'application/json': { schema: userSchema } },
      },
      400: errorResponse('`validation_failed`'),
      401: errorResponse(
        '`invalid_credentials`: the same answer for an unknown email and a wrong password',
      ),
      403: errorResponse('`forbidden_origin`'),
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/api/auth/logout',
    tags: ['auth'],
    summary: 'End the current session',
    responses: {
      204: { description: 'Logged out; the cookie is cleared' },
      401: errorResponse('`unauthenticated`'),
      403: errorResponse('`forbidden_origin`'),
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/api/auth/me',
    tags: ['auth'],
    summary: 'The signed-in User',
    responses: {
      200: {
        description: 'The signed-in User',
        content: { 'application/json': { schema: userSchema } },
      },
      401: errorResponse('`unauthenticated`'),
    },
  });
}
