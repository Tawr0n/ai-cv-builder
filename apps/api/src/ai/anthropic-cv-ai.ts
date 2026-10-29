import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { z } from 'zod';
import { ENV, type Env } from '../env/env.js';
import {
  type Assertion,
  composeOutputSchema,
  CvAi,
  type CvAiInput,
  type CvAiStep,
  extractOutputSchema,
  type Fact,
  InvalidAiOutputError,
  judgeOutputSchema,
  repairOutputSchema,
  updateOutputSchema,
} from './cv-ai.js';
import type { CvContent } from '@ai-cv-builder/shared';
import type { Source } from '../source/source-storage.js';
import {
  COMPOSE_SYSTEM,
  EXTRACT_SYSTEM,
  JUDGE_SYSTEM,
  REPAIR_SYSTEM,
  UPDATE_SYSTEM,
} from './prompts.js';

/** Output ceiling per call (thinking included): with the timeouts, the cost ceiling of a Generation. */
const MAX_TOKENS = 16_000;

/** {@link CvAi} backed by the Claude API. Every call costs money. */
@Injectable()
export class AnthropicCvAi extends CvAi {
  private readonly logger = new Logger(AnthropicCvAi.name);
  private readonly client: Anthropic;

  constructor(@Inject(ENV) private readonly env: Env) {
    super();
    // The SDK retries 429 / 5xx / connection errors twice with backoff; failed requests are not billed.
    this.client = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
      timeout: env.AI_CALL_TIMEOUT_MS,
      maxRetries: 2,
    });
  }

  extract({ source, signal }: CvAiInput<'extract'>) {
    return this.call(
      'extract',
      this.env.ANTHROPIC_MODEL_EXTRACT,
      EXTRACT_SYSTEM,
      [
        sourceBlock(source),
        {
          type: 'text',
          text: 'Extract every fact about the person from the source above.',
        },
      ],
      extractOutputSchema,
      signal,
    );
  }

  compose({ facts, targetRole, signal }: CvAiInput<'compose'>) {
    return this.call(
      'compose',
      this.env.ANTHROPIC_MODEL_COMPOSE,
      COMPOSE_SYSTEM,
      [
        {
          type: 'text',
          text: [
            `<target_role>${targetRole}</target_role>`,
            `<facts>${JSON.stringify(factLines(facts))}</facts>`,
            'Write the CV for the target role from these facts only.',
          ].join('\n'),
        },
      ],
      composeOutputSchema,
      signal,
    );
  }

  update({
    facts,
    answers,
    targetRole,
    content,
    scope,
    signal,
  }: CvAiInput<'update'>) {
    return this.call(
      'update',
      this.env.ANTHROPIC_MODEL_COMPOSE,
      UPDATE_SYSTEM,
      [
        {
          type: 'text',
          text: [
            `<target_role>${targetRole}</target_role>`,
            `<facts>${JSON.stringify(factLines(facts))}</facts>`,
            `<answers>${JSON.stringify(factLines(answers))}</answers>`,
            `<cv>${JSON.stringify(cvLines(content))}</cv>`,
            `<scope>${JSON.stringify(scope)}</scope>`,
            'Rewrite the items in scope using these facts and answers only.',
          ].join('\n'),
        },
      ],
      updateOutputSchema,
      signal,
    );
  }

  judge({ facts, assertions, signal }: CvAiInput<'judge'>) {
    return this.call(
      'judge',
      this.env.ANTHROPIC_MODEL_JUDGE,
      JUDGE_SYSTEM,
      [
        {
          type: 'text',
          text: [
            `<facts>${JSON.stringify(factLines(facts))}</facts>`,
            `<assertions>${JSON.stringify(assertions.map(assertionLine))}</assertions>`,
            'Check every assertion against the facts it cites.',
          ].join('\n'),
        },
      ],
      judgeOutputSchema,
      signal,
    );
  }

  repair({ facts, targetRole, flagged, signal }: CvAiInput<'repair'>) {
    return this.call(
      'repair',
      this.env.ANTHROPIC_MODEL_COMPOSE,
      REPAIR_SYSTEM,
      [
        {
          type: 'text',
          text: [
            `<target_role>${targetRole}</target_role>`,
            `<facts>${JSON.stringify(factLines(facts))}</facts>`,
            `<flagged>${JSON.stringify(
              flagged.map(({ assertion, problem }) => ({
                ...assertionLine(assertion),
                problem,
              })),
            )}</flagged>`,
            'Fix each flagged assertion using these facts only.',
          ].join('\n'),
        },
      ],
      repairOutputSchema,
      signal,
    );
  }

  /**
   * One structured-output call. `create`, not `parse`: `parse` throws on
   * unparsable text before `stop_reason` can say why (a refusal, a cut-off).
   */
  private async call<Schema extends z.ZodType>(
    step: CvAiStep,
    model: string,
    system: string,
    content: Anthropic.ContentBlockParam[],
    schema: Schema,
    signal: AbortSignal | undefined,
  ): Promise<z.output<Schema>> {
    const format = zodOutputFormat(schema);
    const started = Date.now();
    const response = await this.client.messages.create(
      {
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: 'user', content }],
        output_config: { format, effort: 'medium' },
      },
      { signal },
    );
    this.logger.log({
      msg: 'claude call',
      step,
      model,
      requestId: response._request_id,
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      ms: Date.now() - started,
    });

    if (response.stop_reason === 'refusal') {
      throw new InvalidAiOutputError(step, 'the model refused');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new InvalidAiOutputError(step, 'output cut off at max_tokens');
    }
    const text = response.content.find((block) => block.type === 'text');
    if (!text) throw new InvalidAiOutputError(step, 'no text in the answer');
    try {
      return format.parse(text.text) as z.output<Schema>;
    } catch {
      throw new InvalidAiOutputError(step, 'output does not match the schema');
    }
  }
}

/** The Source as data: a PDF as a native document block (pages read as text + image), text fenced off. */
function sourceBlock(source: Source): Anthropic.ContentBlockParam {
  if (source.kind === 'pdf') {
    return {
      type: 'document',
      source: {
        type: 'base64',
        media_type: 'application/pdf',
        data: Buffer.from(source.bytes).toString('base64'),
      },
    };
  }
  return { type: 'text', text: `<source>\n${source.text}\n</source>` };
}

/** Facts as the model sees them; the quote carries the person's own language for Questions. */
function factLines(facts: Fact[]) {
  return facts.map(({ id, text, quote }) => ({ id, text, quote }));
}

function assertionLine({
  itemId,
  section,
  field,
  value,
  sourceFactIds,
}: Assertion) {
  return { itemId, section, field, value, sourceFactIds };
}

/** The CV as update sees it: ids, fields, `edited` and citations; no `rev` or review state. */
function cvLines(content: CvContent) {
  const strip = <Item extends object>(item: Item) => {
    const {
      rev: _rev,
      review: _review,
      ...rest
    } = item as Item & {
      rev: number;
      review?: unknown;
    };
    return rest;
  };
  return {
    contact: strip(content.contact),
    summary: strip(content.summary),
    experience: content.experience.map((item) => ({
      ...strip(item),
      bullets: item.bullets.map(strip),
    })),
    education: content.education.map(strip),
    skills: content.skills.map(strip),
  };
}
