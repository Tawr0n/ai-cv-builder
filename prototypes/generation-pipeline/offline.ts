// PROTOTYPE, throwaway. Runs the same pipelines without an API key: each LLM call becomes a
// job file that a Claude Code subagent answers by writing JSON next to it.
// Usage: tsx offline.ts prep-1 | prep-compose | prep-judge | collect
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

const step = process.argv[2];

if (step === "prep-1") {
  for (const s of SAMPLES) {
    job(`${s.id}.single`,
      `You turn a person's Source (an old CV or a free-text description) into a role-targeted CV draft.\n\nFirst list the Facts.\n${FACT_RULES}\n\nThen ${COMPOSE_RULES}`,
      `${sourceText(s)}\n\nTarget role: ${s.role}`, SingleOutput);
    job(`${s.id}.extract`,
      `You extract Facts from a person's Source (an old CV or a free-text description). Do not judge relevance; extract everything.\n${FACT_RULES}`,
      sourceText(s), ExtractOutput);
  }
}

if (step === "prep-compose") {
  for (const s of SAMPLES) {
    const { facts } = readOut(`${s.id}.extract`, ExtractOutput);
    job(`${s.id}.compose`,
      `You turn a list of Facts about a person into a role-targeted CV draft. The Facts are all you know about them.\n\n${COMPOSE_RULES}`,
      `<facts>\n${factsJson(facts)}\n</facts>\n\nTarget role: ${s.role}`, CvDraft);
  }
}

const pipelineOutput = (s: (typeof SAMPLES)[number], p: "single" | "staged") => {
  if (p === "single") return readOut(`${s.id}.single`, SingleOutput);
  return { facts: readOut(`${s.id}.extract`, ExtractOutput).facts, cv: readOut(`${s.id}.compose`, CvDraft) };
};

if (step === "prep-judge") {
  for (const s of SAMPLES) for (const p of ["single", "staged"] as const) {
    const { facts, cv } = pipelineOutput(s, p);
    job(`${s.id}.${p}.judge`, JUDGE_SYSTEM,
      `<facts>\n${factsJson(facts)}\n</facts>\n<cv>\n${JSON.stringify({ ...cv, questions: undefined }, null, 1)}\n</cv>`, JudgeOutput);
  }
}

if (step === "collect") {
  for (const s of SAMPLES) {
    const oracle = readFileSync(`${here}samples/${s.oracle}`, "utf8");
    const runs = (["single", "staged"] as const).map((p) => {
      try {
        const { facts, cv } = pipelineOutput(s, p);
        const judgeName = `${s.id}.${p}.judge`;
        const judge = existsSync(`${jobs}${judgeName}.out.json`) ? readOut(judgeName, JudgeOutput).findings : [];
        const calls = (p === "single" ? ["single", "judge"] : ["extract", "compose", "judge"])
          .map((label) => ({ label, inputTokens: 0, outputTokens: 0, costUsd: 0, ms: 0, stopReason: "offline" }));
        return { pipeline: p, ok: true as const, facts, cv, issues: validate(cv, facts, oracle), judge, calls };
      } catch (e) {
        return { pipeline: p, ok: false as const, error: String(e) };
      }
    });
    writeFileSync(`${here}results/${s.id}.json`, JSON.stringify({ sample: s.id, role: s.role, model: `${MODEL} via Claude Code subagents (offline)`, effort: "n/a", source: oracle, runs }, null, 2));
    for (const r of runs) console.log(r.ok ? `${s.id} ${r.pipeline}: facts=${r.facts.length} validator=${r.issues.length} judge=${r.judge.length} questions=${r.cv.questions.length}` : `${s.id} ${r.pipeline}: FAILED ${r.error}`);
  }
}
