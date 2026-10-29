/**
 * Input and output of each pipeline step. They stay `unknown` until the slice
 * that builds a step gives it real types (parsed domain types, never raw SDK
 * messages); the scripted fake in the tests follows them automatically.
 */
export interface CvAiSteps {
  extract: { input: unknown; output: unknown };
  compose: { input: unknown; output: unknown };
  judge: { input: unknown; output: unknown };
  repair: { input: unknown; output: unknown };
}

export type CvAiStep = keyof CvAiSteps;
export type CvAiInput<S extends CvAiStep> = CvAiSteps[S]['input'];
export type CvAiOutput<S extends CvAiStep> = CvAiSteps[S]['output'];

/**
 * The port between the Generation pipeline and the model: one method per step.
 * Structural validation of the output lives in the pipeline, outside the port,
 * so no implementation (the fake included) can skip it.
 */
export abstract class CvAi {
  abstract extract(input: CvAiInput<'extract'>): Promise<CvAiOutput<'extract'>>;
  abstract compose(input: CvAiInput<'compose'>): Promise<CvAiOutput<'compose'>>;
  abstract judge(input: CvAiInput<'judge'>): Promise<CvAiOutput<'judge'>>;
  abstract repair(input: CvAiInput<'repair'>): Promise<CvAiOutput<'repair'>>;
}
