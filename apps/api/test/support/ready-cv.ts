import {
  type CvContent,
  cvViewSchema,
  type Question,
  questionListSchema,
} from '@ai-cv-builder/shared';
import type { ComposeOutput, CvAiOutput } from '../../src/ai/cv-ai.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { GenerationRunner } from '../../src/generation/generation-runner.js';
import { composeOutput, extractOutput, noFindings } from './cv-ai-fixtures.js';
import { postCv, SAMPLE_TEXT_SOURCE } from './create-cv.js';
import { givenUser } from './given-user.js';
import type { TestApp } from './test-app.js';

/**
 * A signed-in User with a CV the pipeline has generated from `compose`
 * (by default {@link composeOutput}): ready, with content and its Questions.
 */
export async function givenReadyCv(
  testApp: TestApp,
  compose: ComposeOutput = composeOutput(),
) {
  const owner = await givenUser(testApp);
  const created = await postCv(owner.agent, {
    text: SAMPLE_TEXT_SOURCE,
  }).expect(201);
  const cvId = created.body.cvId as string;
  const prisma = testApp.app.get(PrismaService);
  const { id: generationId } = await prisma.generation.findFirstOrThrow({
    where: { cvId },
  });
  testApp.cvAi
    .returns('extract', extractOutput())
    .returns('compose', compose)
    .returns('judge', noFindings());
  await testApp.app.get(GenerationRunner).run(generationId);

  async function view() {
    const response = await owner.agent.get(`/api/cvs/${cvId}`).expect(200);
    return cvViewSchema.parse(response.body);
  }
  async function content(): Promise<CvContent> {
    return (await view()).content!;
  }
  async function questions(): Promise<Question[]> {
    const response = await owner.agent
      .get(`/api/cvs/${cvId}/questions`)
      .expect(200);
    return questionListSchema.parse(response.body).items;
  }
  /** The Question with this text; fails the test if there is none. */
  async function question(text: string): Promise<Question> {
    const found = (await questions()).find((q) => q.text === text);
    if (!found) throw new Error(`No Question "${text}"`);
    return found;
  }
  /** Saves a pending Answer to the Question with this text; returns the Question's id. */
  async function answer(questionText: string, text: string) {
    const { id } = await question(questionText);
    await owner.agent
      .put(`/api/cvs/${cvId}/questions/${id}/answer`)
      .send({ answer: text })
      .expect(200);
    return id;
  }
  /** What update returns for the sample Experience as it is now, with `changes` applied. */
  async function experienceUpdate(
    changes: Partial<CvAiOutput<'update'>['experience'][number]> = {},
    asked: CvAiOutput<'update'>['questions'] = [],
  ): Promise<CvAiOutput<'update'>> {
    const [experience] = (await content()).experience;
    const {
      review: _review,
      rev: _rev,
      edited: _edited,
      ...fields
    } = experience!;
    return {
      contact: null,
      summary: null,
      experience: [
        {
          ...fields,
          bullets: fields.bullets.map(({ id, text, sourceFactIds }) => ({
            id,
            text,
            sourceFactIds,
          })),
          ...changes,
        },
      ],
      education: [],
      skills: [],
      questions: asked,
    };
  }
  return {
    ...owner,
    cvId,
    view,
    content,
    questions,
    question,
    answer,
    experienceUpdate,
  };
}

export const LOCATION_QUESTION = 'Where were you based?';
export const NUMBERS_QUESTION = 'How many invoices did the service bill?';
export const SUMMARY_QUESTION = 'What kind of teams do you like to work in?';

/** {@link composeOutput} plus Questions on the Experience, its bullet and the summary. */
export function composeWithQuestions(): ComposeOutput {
  return {
    ...composeOutput(),
    questions: [
      {
        section: 'experience',
        itemIndex: 0,
        bulletIndex: null,
        field: 'location',
        text: LOCATION_QUESTION,
      },
      {
        section: 'experience',
        itemIndex: 0,
        bulletIndex: 0,
        field: 'text',
        text: NUMBERS_QUESTION,
      },
      {
        section: 'summary',
        itemIndex: null,
        bulletIndex: null,
        field: 'text',
        text: SUMMARY_QUESTION,
      },
    ],
  };
}
