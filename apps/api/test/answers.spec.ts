import { apiErrorSchema, questionSchema } from '@ai-cv-builder/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { givenUser } from './support/given-user.js';
import {
  composeWithQuestions,
  givenReadyCv,
  LOCATION_QUESTION,
} from './support/ready-cv.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('answering Questions', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterEach(() => {
    testApp.cvAi.assertAllConsumed();
    testApp.cvAi.reset();
  });

  afterAll(async () => {
    await testApp.app.close();
  });

  const given = () => givenReadyCv(testApp, composeWithQuestions());

  describe('PUT /api/cvs/:cvId/questions/:questionId/answer', () => {
    it('saves a pending Answer that stays editable', async () => {
      const cv = await given();
      const { id } = await cv.question(LOCATION_QUESTION);
      const url = `/api/cvs/${cv.cvId}/questions/${id}/answer`;

      const first = await cv.agent.put(url).send({ answer: ' Lodon ' });
      const second = await cv.agent.put(url).send({ answer: 'London, UK' });

      expect(first.status).toBe(200);
      expect(questionSchema.parse(first.body)).toMatchObject({
        status: 'answered',
        answer: 'Lodon',
        appliedAt: null,
        locked: false,
      });
      expect(second.status).toBe(200);
      expect(await cv.question(LOCATION_QUESTION)).toMatchObject({
        status: 'answered',
        answer: 'London, UK',
        appliedAt: null,
      });
    });

    it('rejects an empty or too long Answer with 400', async () => {
      const cv = await given();
      const { id } = await cv.question(LOCATION_QUESTION);
      const url = `/api/cvs/${cv.cvId}/questions/${id}/answer`;

      await cv.agent.put(url).send({ answer: '   ' }).expect(400);
      await cv.agent
        .put(url)
        .send({ answer: 'x'.repeat(1001) })
        .expect(400);
      expect(await cv.question(LOCATION_QUESTION)).toMatchObject({
        status: 'open',
        answer: null,
      });
    });

    it("answers 404 for a Question of another User's CV, or one that does not exist", async () => {
      const cv = await given();
      const { id } = await cv.question(LOCATION_QUESTION);
      const stranger = await givenUser(testApp);

      const foreign = await stranger.agent
        .put(`/api/cvs/${cv.cvId}/questions/${id}/answer`)
        .send({ answer: 'Mine now' });
      const missing = await cv.agent
        .put(
          `/api/cvs/${cv.cvId}/questions/00000000-0000-4000-8000-000000000000/answer`,
        )
        .send({ answer: 'London' });

      expect(foreign.status).toBe(404);
      expect(missing.status).toBe(404);
      expect(await cv.question(LOCATION_QUESTION)).toMatchObject({
        answer: null,
      });
    });
  });

  describe('dismiss and reopen', () => {
    it('dismisses a Question, drops its pending Answer, and reopens it', async () => {
      const cv = await given();
      const { id } = await cv.question(LOCATION_QUESTION);
      const base = `/api/cvs/${cv.cvId}/questions/${id}`;
      await cv.agent
        .put(`${base}/answer`)
        .send({ answer: 'London' })
        .expect(200);

      const dismissed = await cv.agent.post(`${base}/dismiss`).expect(200);
      expect(questionSchema.parse(dismissed.body)).toMatchObject({
        status: 'dismissed',
        answer: null,
      });
      const answering = await cv.agent
        .put(`${base}/answer`)
        .send({ answer: 'London' })
        .expect(409);
      expect(apiErrorSchema.parse(answering.body).error.code).toBe(
        'question_closed',
      );

      const reopened = await cv.agent.post(`${base}/reopen`).expect(200);
      expect(questionSchema.parse(reopened.body)).toMatchObject({
        status: 'open',
      });
    });

    it('reopens only a dismissed Question', async () => {
      const cv = await given();
      const { id } = await cv.question(LOCATION_QUESTION);

      const response = await cv.agent
        .post(`/api/cvs/${cv.cvId}/questions/${id}/reopen`)
        .expect(409);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'question_closed',
      );
    });
  });
});
