import { randomUUID } from 'node:crypto';
import {
  apiErrorSchema,
  type CvContent,
  cvViewSchema,
} from '@ai-cv-builder/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/database/prisma.service.js';
import { GenerationRunner } from '../src/generation/generation-runner.js';
import { postCv, SAMPLE_TEXT_SOURCE } from './support/create-cv.js';
import { composeOutput, extractOutput } from './support/cv-ai-fixtures.js';
import { givenUser } from './support/given-user.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('editing CV items', () => {
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

  /** A signed-in User with a CV the pipeline has generated: ready, with content. */
  async function givenReadyCv() {
    const owner = await givenUser(testApp);
    const created = await postCv(owner.agent, {
      text: SAMPLE_TEXT_SOURCE,
    }).expect(201);
    const cvId = created.body.cvId as string;
    const { id: generationId } = await testApp.app
      .get(PrismaService)
      .generation.findFirstOrThrow({ where: { cvId } });
    testApp.cvAi
      .returns('extract', extractOutput())
      .returns('compose', composeOutput());
    await testApp.app.get(GenerationRunner).run(generationId);

    async function view() {
      const response = await owner.agent.get(`/api/cvs/${cvId}`).expect(200);
      return cvViewSchema.parse(response.body);
    }
    async function content(): Promise<CvContent> {
      return (await view()).content!;
    }
    return { ...owner, cvId, view, content };
  }

  describe('PATCH /api/cvs/:cvId/items/:itemId', () => {
    it('saves the fields, bumps the rev and marks the item edited', async () => {
      const { agent, cvId, content } = await givenReadyCv();
      const before = (await content()).summary;
      expect(before).toMatchObject({ rev: 1, edited: false });

      const response = await agent
        .patch(`/api/cvs/${cvId}/items/summary`)
        .send({ rev: 1, text: 'Backend engineer, billing and payments.' })
        .expect(200);

      expect(response.body).toMatchObject({
        text: 'Backend engineer, billing and payments.',
        rev: 2,
        edited: true,
      });
      expect((await content()).summary).toEqual(response.body);
    });

    it('answers 409 with the current item when the rev is stale', async () => {
      const { agent, cvId, content } = await givenReadyCv();
      await agent
        .patch(`/api/cvs/${cvId}/items/summary`)
        .send({ rev: 1, text: 'Edited on another device.' })
        .expect(200);

      const response = await agent
        .patch(`/api/cvs/${cvId}/items/summary`)
        .send({ rev: 1, text: 'Edited on this device.' })
        .expect(409);

      const { error } = apiErrorSchema.parse(response.body);
      expect(error.code).toBe('item_conflict');
      expect(error.current).toMatchObject({
        text: 'Edited on another device.',
        rev: 2,
      });
      expect((await content()).summary.text).toBe('Edited on another device.');
    });
  });

  describe('what a PATCH may change', () => {
    it.each([
      ['server-owned flags', { edited: false }],
      ['a field the item does not have', { title: 'Wizard' }],
      ['a value over the limit', { text: 'x'.repeat(1501) }],
      ['nothing', {}],
    ])('rejects %s with 400 and changes nothing', async (_, fields) => {
      const { agent, cvId, content } = await givenReadyCv();
      const before = (await content()).summary;

      const response = await agent
        .patch(`/api/cvs/${cvId}/items/summary`)
        .send({ rev: 1, ...fields })
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'validation_failed',
      );
      expect((await content()).summary).toEqual(before);
    });

    it("does not let another User change a CV's item", async () => {
      const { cvId, content } = await givenReadyCv();
      const stranger = await givenUser(testApp);
      const before = await content();

      await stranger.agent
        .patch(`/api/cvs/${cvId}/items/summary`)
        .send({ rev: 1, text: 'Hijacked.' })
        .expect(404);

      expect(await content()).toEqual(before);
    });
  });

  describe('DELETE /api/cvs/:cvId/items/:itemId', () => {
    it('removes an item with its own rev, bumps the version and returns the CV view', async () => {
      const { agent, cvId, content, view } = await givenReadyCv();
      const [skill] = (await content()).skills;
      const { version } = await view();

      const response = await agent
        .delete(`/api/cvs/${cvId}/items/${skill!.id}`)
        .query({ rev: skill!.rev })
        .expect(200);

      const after = cvViewSchema.parse(response.body);
      expect(after.content!.skills).toEqual([]);
      expect(after.version).toBe(version + 1);
    });

    it('removes a bullet without touching its experience', async () => {
      const { agent, cvId, content } = await givenReadyCv();
      const [experience] = (await content()).experience;
      const [bullet] = experience!.bullets;

      const response = await agent
        .delete(`/api/cvs/${cvId}/items/${bullet!.id}`)
        .query({ rev: bullet!.rev })
        .expect(200);

      const [after] = cvViewSchema.parse(response.body).content!.experience;
      expect(after).toMatchObject({ rev: experience!.rev, bullets: [] });
    });

    it('answers 409 with the current item when the rev is stale', async () => {
      const { agent, cvId, content } = await givenReadyCv();
      const [skill] = (await content()).skills;
      await agent
        .patch(`/api/cvs/${cvId}/items/${skill!.id}`)
        .send({ rev: 1, name: 'Rust' })
        .expect(200);

      const response = await agent
        .delete(`/api/cvs/${cvId}/items/${skill!.id}`)
        .query({ rev: 1 })
        .expect(409);

      const { error } = apiErrorSchema.parse(response.body);
      expect(error.code).toBe('item_conflict');
      expect(error.current).toMatchObject({ name: 'Rust', rev: 2 });
      expect((await content()).skills).toHaveLength(1);
    });

    it.each(['contact', 'summary'])(
      'refuses to remove %s with 400',
      async (id) => {
        const { agent, cvId } = await givenReadyCv();

        const response = await agent
          .delete(`/api/cvs/${cvId}/items/${id}`)
          .query({ rev: 1 })
          .expect(400);

        expect(apiErrorSchema.parse(response.body).error.code).toBe(
          'validation_failed',
        );
      },
    );

    it('answers 404 for an item that does not exist', async () => {
      const { agent, cvId } = await givenReadyCv();

      await agent
        .delete(`/api/cvs/${cvId}/items/${randomUUID()}`)
        .query({ rev: 1 })
        .expect(404);
    });
  });

  describe('POST /api/cvs/:cvId/items/:itemId/move', () => {
    /** A CV with three experiences, in the order the returned titles name. */
    async function givenThreeExperiences() {
      const cv = await givenReadyCv();
      for (const title of ['Second', 'Third']) {
        const added = await cv.agent
          .post(`/api/cvs/${cv.cvId}/sections/experience/items`)
          .send({})
          .expect(201);
        const experience = cvViewSchema
          .parse(added.body)
          .content!.experience.at(-1)!;
        await cv.agent
          .patch(`/api/cvs/${cv.cvId}/items/${experience.id}`)
          .send({ rev: 1, title })
          .expect(200);
      }
      const titles = async () =>
        (await cv.content()).experience.map(({ title }) => title);
      return { ...cv, titles };
    }

    it('moves an item one place and bumps the version', async () => {
      const { agent, cvId, content, view, titles } =
        await givenThreeExperiences();
      const { version } = await view();
      const [, , third] = (await content()).experience;

      const response = await agent
        .post(`/api/cvs/${cvId}/items/${third!.id}/move`)
        .send({ direction: 'up', version })
        .expect(200);

      const after = cvViewSchema.parse(response.body);
      expect(after.version).toBe(version + 1);
      expect(await titles()).toEqual(['Backend Engineer', 'Third', 'Second']);
      expect(after.content!.experience.map(({ title }) => title)).toEqual(
        await titles(),
      );
    });

    it('moves an education entry down', async () => {
      const { agent, cvId, view } = await givenReadyCv();
      const ids: string[] = [];
      for (let i = 0; i < 2; i++) {
        const added = await agent
          .post(`/api/cvs/${cvId}/sections/education/items`)
          .send({})
          .expect(201);
        ids.push(cvViewSchema.parse(added.body).content!.education.at(-1)!.id);
      }

      const { version } = await view();

      const response = await agent
        .post(`/api/cvs/${cvId}/items/${ids[0]}/move`)
        .send({ direction: 'down', version })
        .expect(200);

      expect(
        cvViewSchema
          .parse(response.body)
          .content!.education.map(({ id }) => id),
      ).toEqual([ids[1], ids[0]]);
    });

    it('leaves the order alone at either end', async () => {
      const { agent, cvId, content, view } = await givenThreeExperiences();
      const [first] = (await content()).experience;
      const { version } = await view();

      const response = await agent
        .post(`/api/cvs/${cvId}/items/${first!.id}/move`)
        .send({ direction: 'up', version })
        .expect(200);

      expect(cvViewSchema.parse(response.body)).toMatchObject({ version });
      expect((await content()).experience[0]!.id).toBe(first!.id);
    });

    it('answers 409 with the current order when the version is stale', async () => {
      const { agent, cvId, content, view } = await givenThreeExperiences();
      const { version } = await view();
      const [first, second, third] = (await content()).experience;
      await agent
        .post(`/api/cvs/${cvId}/items/${second!.id}/move`)
        .send({ direction: 'up', version })
        .expect(200);

      const response = await agent
        .post(`/api/cvs/${cvId}/items/${third!.id}/move`)
        .send({ direction: 'up', version })
        .expect(409);

      const { error } = apiErrorSchema.parse(response.body);
      expect(error).toMatchObject({
        code: 'version_conflict',
        version: version + 1,
        order: [second!.id, first!.id, third!.id],
      });
    });

    it.each(['contact', 'summary'])(
      'refuses to move %s with 400',
      async (id) => {
        const { agent, cvId, view } = await givenReadyCv();
        const { version } = await view();

        await agent
          .post(`/api/cvs/${cvId}/items/${id}/move`)
          .send({ direction: 'up', version })
          .expect(400);
      },
    );

    it('refuses to move a skill or a bullet with 400', async () => {
      const { agent, cvId, content, view } = await givenReadyCv();
      const { skills, experience } = await content();
      const { version } = await view();

      for (const { id } of [skills[0]!, experience[0]!.bullets[0]!]) {
        await agent
          .post(`/api/cvs/${cvId}/items/${id}/move`)
          .send({ direction: 'up', version })
          .expect(400);
      }
    });
  });

  describe('adding items', () => {
    it('appends an empty, edited experience and returns the CV view', async () => {
      const { agent, cvId, content } = await givenReadyCv();
      const before = await content();

      const response = await agent
        .post(`/api/cvs/${cvId}/sections/experience/items`)
        .send({})
        .expect(201);

      const view = cvViewSchema.parse(response.body);
      expect(view.content!.experience).toHaveLength(
        before.experience.length + 1,
      );
      expect(view.content!.experience.at(-1)).toMatchObject({
        organization: null,
        title: null,
        bullets: [],
        rev: 1,
        edited: true,
        sourceFactIds: [],
      });
      expect(view.content!.experience.slice(0, -1)).toEqual(before.experience);
    });

    it('adds an education entry the same way', async () => {
      const { agent, cvId } = await givenReadyCv();

      const response = await agent
        .post(`/api/cvs/${cvId}/sections/education/items`)
        .send({})
        .expect(201);

      expect(
        cvViewSchema.parse(response.body).content!.education,
      ).toMatchObject([{ institution: null, rev: 1, edited: true }]);
    });

    it('adds a skill with its name', async () => {
      const { agent, cvId } = await givenReadyCv();

      const response = await agent
        .post(`/api/cvs/${cvId}/sections/skills/items`)
        .send({ name: '  PostgreSQL ' })
        .expect(201);

      expect(
        cvViewSchema.parse(response.body).content!.skills.at(-1),
      ).toMatchObject({ name: 'PostgreSQL', rev: 1, edited: true });
    });

    it('rejects a skill without a name with 400', async () => {
      const { agent, cvId } = await givenReadyCv();

      const response = await agent
        .post(`/api/cvs/${cvId}/sections/skills/items`)
        .send({})
        .expect(400);

      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        'validation_failed',
      );
    });

    it('adds a bullet to an experience without touching the experience rev', async () => {
      const { agent, cvId, content } = await givenReadyCv();
      const [experience] = (await content()).experience;

      const response = await agent
        .post(`/api/cvs/${cvId}/items/${experience!.id}/bullets`)
        .send({ text: 'Cut invoice latency by half.' })
        .expect(201);

      const [updated] = cvViewSchema.parse(response.body).content!.experience;
      expect(updated!.rev).toBe(experience!.rev);
      expect(updated!.bullets.at(-1)).toMatchObject({
        text: 'Cut invoice latency by half.',
        rev: 1,
        edited: true,
      });
    });

    it('answers 404 when the experience for a bullet does not exist', async () => {
      const { agent, cvId } = await givenReadyCv();

      await agent
        .post(`/api/cvs/${cvId}/items/${randomUUID()}/bullets`)
        .send({ text: 'Orphan.' })
        .expect(404);
    });
  });
});
