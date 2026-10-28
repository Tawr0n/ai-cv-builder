// PROTOTYPE, throwaway. Runs the same pipelines without an API key: each LLM call becomes a
// job file that a Claude Code subagent answers by writing JSON next to it.
// Usage: tsx offline.ts prep-1 | prep-compose | prep-judge | collect   (job files name the model: <sample>.<model>.<step>)
// Caveat vs run.ts: no constrained decoding (schema is only requested), no token/cost numbers.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as z from "zod/v4";
import { COMPOSE_RULES, CvDraft, ExtractOutput, FACT_RULES, JUDGE_SYSTEM, JudgeOutput, MODEL, SingleOutput, type Fact } from "./pipeline.ts";
import { validate } from "./validate.ts";

const SAMPLES = [
  { id: "1-rich-text", role: "Senior Backend Engineer", file: "1-rich-text.txt", oracle: "1-rich-text.txt" },
  { id: "2-pdf", role: "Product Analyst", file: "2-pdf.pdf", oracle: "2-pdf-source.txt" },
  { id: "3-sparse-uk", role: "Middle Frontend Developer", file: "3-sparse-uk.txt", oracle: "3-sparse-uk.txt" },
];
const here = new URL(".", import.meta.url).pathname;
const jobs = `${here}offline-jobs/`;
mkdirSync(jobs, { recursive: true });
mkdirSync(`${here}results/`, { recursive: true });

const schemaText = (s: z.ZodType) => JSON.stringify(z.toJSONSchema(s), null, 1);
const sourceText = (s: (typeof SAMPLES)[number]) =>
  s.file.endsWith(".pdf")
    ? `The Source is the PDF file at ${here}samples/${s.file}. Read that file (and no other file).`
    : `<source>\n${readFileSync(`${here}samples/${s.file}`, "utf8")}\n</source>`;

function job(name: string, system: string, user: string, schema: z.ZodType) {
  writeFileSync(`${jobs}${name}.md`, `# SYSTEM\n\n${system}\n\n# USER\n\n${user}\n\n# OUTPUT\n\nRespond with one JSON object matching this JSON Schema, and nothing else. Write it to ${jobs}${name}.out.json.\n\n${schemaText(schema)}\n`);
}
const readOut = <T>(name: string, schema: z.ZodType<T>): T => schema.parse(JSON.parse(readFileSync(`${jobs}${name}.out.json`, "utf8")));
const factsJson = (facts: Fact[]) => JSON.stringify(facts.map(({ id, text }) => ({ id, text })), null, 1);


// Job-file prefixes: "" is the first (Opus) run, kept under its original names.
type Variant = { id: string; single?: string; extract?: string; compose?: string; judge: string };
const VARIANTS: Variant[] = [
  { id: "opus-single", single: "single", judge: "single.judge" },
  { id: "opus-staged", extract: "extract", compose: "compose", judge: "staged.judge" },
  { id: "sonnet-single", single: "sonnet.single", judge: "sonnet-single.judge" },
  { id: "sonnet-staged", extract: "sonnet.extract", compose: "sonnet.compose", judge: "sonnet-staged.judge" },
  { id: "haiku-single", single: "haiku.single", judge: "haiku-single.judge" },
  { id: "haiku-staged", extract: "haiku.extract", compose: "haiku.compose", judge: "haiku-staged.judge" },
  { id: "haiku-extract+opus-compose", extract: "haiku.extract", compose: "haiku-opus.compose", judge: "haiku-opus.judge" },
  { id: "haiku-extract+sonnet-compose", extract: "haiku.extract", compose: "haiku-sonnet.compose", judge: "haiku-sonnet.judge" },
];
const has = (name: string) => existsSync(`${jobs}${name}.out.json`);

const SINGLE_SYSTEM = `You turn a person's Source (an old CV or a free-text description) into a role-targeted CV draft.\n\nFirst list the Facts.\n${FACT_RULES}\n\nThen ${COMPOSE_RULES}`;
const EXTRACT_SYSTEM = `You extract Facts from a person's Source (an old CV or a free-text description). Do not judge relevance; extract everything.\n${FACT_RULES}`;
const COMPOSE_SYSTEM = `You turn a list of Facts about a person into a role-targeted CV draft. The Facts are all you know about them.\n\n${COMPOSE_RULES}`;

const pipelineOutput = (s: (typeof SAMPLES)[number], v: Variant) => {
  if (v.single) return readOut(`${s.id}.${v.single}`, SingleOutput);
  return { facts: readOut(`${s.id}.${v.extract}`, ExtractOutput).facts, cv: readOut(`${s.id}.${v.compose}`, CvDraft) };
};
const produced = (s: (typeof SAMPLES)[number], v: Variant) => has(`${s.id}.${v.single ?? v.compose}`);

const step = process.argv[2];

if (step === "prep-1") {
  for (const s of SAMPLES) for (const v of VARIANTS) {
    if (v.single) job(`${s.id}.${v.single}`, SINGLE_SYSTEM, `${sourceText(s)}\n\nTarget role: ${s.role}`, SingleOutput);
    if (v.extract) job(`${s.id}.${v.extract}`, EXTRACT_SYSTEM, sourceText(s), ExtractOutput);
  }
}

if (step === "prep-compose") {
  for (const s of SAMPLES) for (const v of VARIANTS) {
    if (!v.compose || !has(`${s.id}.${v.extract}`)) continue;
    const { facts } = readOut(`${s.id}.${v.extract}`, ExtractOutput);
    job(`${s.id}.${v.compose}`, COMPOSE_SYSTEM, `<facts>\n${factsJson(facts)}\n</facts>\n\nTarget role: ${s.role}`, CvDraft);
  }
}

if (step === "prep-judge") {
  for (const s of SAMPLES) for (const v of VARIANTS) {
    if (!produced(s, v) || has(`${s.id}.${v.judge}`)) continue;
    const { facts, cv } = pipelineOutput(s, v);
    job(`${s.id}.${v.judge}`, JUDGE_SYSTEM,
      `<facts>\n${factsJson(facts)}\n</facts>\n<cv>\n${JSON.stringify({ ...cv, questions: undefined }, null, 1)}\n</cv>`, JudgeOutput);
  }
}

if (step === "collect") {
  for (const s of SAMPLES) {
    const oracle = readFileSync(`${here}samples/${s.oracle}`, "utf8");
    const runs = VARIANTS.filter((v) => produced(s, v)).map((v) => {
      try {
        const { facts, cv } = pipelineOutput(s, v);
        const judge = has(`${s.id}.${v.judge}`) ? readOut(`${s.id}.${v.judge}`, JudgeOutput).findings : [];
        const calls = (v.single ? ["single", "judge"] : ["extract", "compose", "judge"])
          .map((label) => ({ label, inputTokens: 0, outputTokens: 0, costUsd: 0, ms: 0, stopReason: "offline" }));
        return { pipeline: v.id, ok: true as const, facts, cv, issues: validate(cv, facts, oracle), judge, calls };
      } catch (e) {
        return { pipeline: v.id, ok: false as const, error: String(e) };
      }
    });
    writeFileSync(`${here}results/${s.id}.json`, JSON.stringify({ sample: s.id, role: s.role, model: `${MODEL} family via Claude Code subagents (offline); judge always Opus`, effort: "n/a", source: oracle, runs }, null, 2));
    for (const r of runs) console.log(r.ok
      ? `${s.id} ${r.pipeline}: facts=${r.facts.length} reject=${r.issues.filter((i) => i.severity === "reject").length} flag=${r.issues.filter((i) => i.severity === "flag").length} judge=${r.judge.length} questions=${r.cv.questions.length}`
      : `${s.id} ${r.pipeline}: FAILED ${r.error}`);
  }
}
