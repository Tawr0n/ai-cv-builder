import {
  CvAi,
  type CvAiInput,
  type CvAiOutput,
  type CvAiStep,
} from '../../src/ai/cv-ai.js';

type Outcome<S extends CvAiStep> =
  | { kind: 'returns'; value: CvAiOutput<S> }
  | { kind: 'throws'; error: unknown }
  | { kind: 'runs'; run: (input: CvAiInput<S>) => Promise<CvAiOutput<S>> };

type PerStep<T extends Record<CvAiStep, unknown>> = { [S in CvAiStep]: T[S] };

/**
 * Strict fake of {@link CvAi}: each step answers from its own queue of scripted
 * results or errors, and a call nobody scripted fails the test instead of
 * succeeding by default. `calls` records every input, per step.
 */
export class ScriptedCvAi extends CvAi {
  readonly calls: PerStep<{ [S in CvAiStep]: CvAiInput<S>[] }> = {
    extract: [],
    compose: [],
    judge: [],
    repair: [],
  };

  private readonly scripts: PerStep<{ [S in CvAiStep]: Outcome<S>[] }> = {
    extract: [],
    compose: [],
    judge: [],
    repair: [],
  };

  returns<S extends CvAiStep>(step: S, ...values: CvAiOutput<S>[]): this {
    const queue: Outcome<S>[] = this.scripts[step];
    queue.push(...values.map((value) => ({ kind: 'returns' as const, value })));
    return this;
  }

  throws<S extends CvAiStep>(step: S, error: unknown): this {
    const queue: Outcome<S>[] = this.scripts[step];
    queue.push({ kind: 'throws', error });
    return this;
  }

  /** Answers one call with whatever `run` does: for side effects in the middle of a step. */
  runs<S extends CvAiStep>(
    step: S,
    run: (input: CvAiInput<S>) => Promise<CvAiOutput<S>>,
  ): this {
    const queue: Outcome<S>[] = this.scripts[step];
    queue.push({ kind: 'runs', run });
    return this;
  }

  /** Forgets every script and recorded call: for a test app shared by a whole file. */
  reset(): void {
    for (const step of Object.keys(this.scripts) as CvAiStep[]) {
      this.scripts[step].length = 0;
      this.calls[step].length = 0;
    }
  }

  /** Fails when a scripted result was never used: the code took a shorter path than the test expected. */
  assertAllConsumed(): void {
    for (const [step, queue] of Object.entries(this.scripts)) {
      if (queue.length > 0) {
        throw new Error(
          `ScriptedCvAi: ${queue.length} scripted ${step} result(s) never used`,
        );
      }
    }
  }

  extract(input: CvAiInput<'extract'>) {
    return this.next('extract', input);
  }

  compose(input: CvAiInput<'compose'>) {
    return this.next('compose', input);
  }

  judge(input: CvAiInput<'judge'>) {
    return this.next('judge', input);
  }

  repair(input: CvAiInput<'repair'>) {
    return this.next('repair', input);
  }

  private async next<S extends CvAiStep>(
    step: S,
    input: CvAiInput<S>,
  ): Promise<CvAiOutput<S>> {
    const calls: CvAiInput<S>[] = this.calls[step];
    calls.push(input);

    const queue: Outcome<S>[] = this.scripts[step];
    const outcome = queue.shift();
    if (!outcome) {
      throw new Error(`ScriptedCvAi: unexpected call to ${step}`);
    }
    switch (outcome.kind) {
      case 'returns':
        return outcome.value;
      case 'throws':
        throw outcome.error;
      case 'runs':
        return outcome.run(input);
    }
  }
}
