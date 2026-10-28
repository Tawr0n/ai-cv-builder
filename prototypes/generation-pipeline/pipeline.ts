// PROTOTYPE, throwaway. Two candidate generation pipelines for the
// "Generation pipeline that never invents facts" ticket.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import * as z from "zod/v4";

export const MODEL = "claude-opus-5-5";
// $ per token (input, output), first-party API rates; Haiku's applies to prompts up to 100K tokens.
const PRICES: Record<Model, [number, number]> = {
  "claude-opus-5-5": [4 / 1e6, 20 / 1e6],
  "claude-sonnet-5-5": [2 / 1e6, 10 / 1e6],
  "claude-haiku-5-5": [0.1 / 1e6, 0.5 / 1e6],
};
export type Model = "claude-opus-5-5" | "claude-sonnet-5-5" | "claude-haiku-5-5";

// ---------- schemas (LLM output shapes) ----------

export const FactIds = z.array(z.string()).describe("ids of the Facts this item rests on");
const YearMonth = z.string().nullable().describe("YYYY-MM, or YYYY if only the year is known, or null if unknown");

export const Fact = z.object({
  id: z.string().describe("f1, f2, ..."),
  text: z.string().describe("one atomic statement about the person, in the Source's own terms"),
  quote: z.string().describe("the shortest verbatim span of the Source this fact comes from"),
});
export type Fact = z.infer<typeof Fact>;

export const Question = z.object({
  section: z.enum(["contact", "summary", "experience", "education", "skills"]),
  itemIndex: z.number().int().nullable().describe("index into that section's array, or null for the whole section"),
  field: z.string().nullable(),
  text: z.string().describe("a short, specific question to the user"),
});

export const CvDraft = z.object({
  contact: z.object({
    fullName: z.string().describe("empty string if unknown"),
    email: z.string().describe("empty string if unknown"),
    phone: z.string().nullable(),
    location: z.string().nullable(),
    links: z.array(z.string()),
    sourceFactIds: FactIds,
  }),
  summary: z.object({ text: z.string(), sourceFactIds: FactIds }),
  experience: z.array(
    z.object({
      organization: z.string(),
      title: z.string(),
      startDate: YearMonth,
      endDate: YearMonth.describe("null if current OR unknown; say which in a Question if unknown"),
      isCurrent: z.boolean(),
      location: z.string().nullable(),
      sourceFactIds: FactIds,
      bullets: z.array(z.object({ text: z.string(), sourceFactIds: FactIds })),
    }),
  ),
  education: z.array(
    z.object({
      institution: z.string(),
      degree: z.string().describe("empty string if unknown"),
      field: z.string().nullable(),
      startDate: YearMonth,
      endDate: YearMonth,
      sourceFactIds: FactIds,
    }),
  ),
  skills: z.array(z.object({ name: z.string(), sourceFactIds: FactIds })),
  questions: z.array(Question),
});
export type CvDraft = z.infer<typeof CvDraft>;

export const ExtractOutput = z.object({ facts: z.array(Fact) });
export const SingleOutput = z.object({ facts: z.array(Fact), cv: CvDraft });

// ---------- prompts ----------

export const FACT_RULES = `A Fact is one atomic statement about the person that the Source states. Split compound sentences: "Built X in Node.js, processes 2M tx/day" is two Facts. Keep numbers, names, dates and scope exactly as written; never round, upgrade or generalise them. Include contact details, each role (organization, title, dates), each responsibility/achievement, each education entry, each skill and language. Vague statements stay vague ("some startups" stays "some startups").`;

export const COMPOSE_RULES = `Write a CV draft aimed at the Target role.

Grounding (most important):
- Every item cites the Facts it rests on in sourceFactIds. Every claim in the text (number, name, technology, scope, seniority, outcome) must be stated by a cited Fact. Rephrasing and tightening is fine; adding is not.
- Never invent metrics, dates, employers, titles, degrees, technologies or outcomes. Do not upgrade scope ("helped with" stays "helped with", not "led").
- If something a good CV for this role needs is missing or vague (no dates, no title, no measurable outcome, vague employer), leave the field empty/null or the bullet modest, and add a Question asking the user for it. Prefer a Question over a guess.
- Only skills that a Fact names. Do not infer skills from tools ("used Kubernetes" does not give "DevOps").

Shape:
- Experience in reverse chronological order. Within an experience, bullets ordered by relevance to the Target role, at most 4, each one line (<= ~20 words), starting with a verb.
- Keep experiences that are irrelevant to the role but shorten them to 0-1 bullets; never drop education.
- Skills ordered by relevance to the Target role; spoken languages go into skills.
- Summary: 2-3 sentences, positioned for the Target role, only from Facts.
- Write the CV in English. Questions in the language of the Source.
- Questions: at most 6, the most valuable first, each about one thing, anchored to section/item/field.`;

export type SourceInput = { kind: "text"; text: string } | { kind: "pdf"; base64: string };

function sourceBlock(src: SourceInput): Anthropic.ContentBlockParam {
  return src.kind === "pdf"
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: src.base64 } }
    : { type: "text", text: `<source>\n${src.text}\n</source>` };
}

// ---------- calls ----------

export type CallStats = { label: string; model: Model; inputTokens: number; outputTokens: number; costUsd: number; ms: number; stopReason: string | null };
export type Effort = "low" | "medium" | "high";

async function call<T>(
  client: Anthropic,
  label: string,
  model: Model,
  format: ReturnType<typeof zodOutputFormat<z.ZodType<T>>>,
  system: string,
  content: Anthropic.ContentBlockParam[],
  effort: Effort,
): Promise<{ output: T; stats: CallStats }> {
  const t0 = Date.now();
  const res = await client.messages.parse({
    model,
    max_tokens: 16000,
    system,
    output_config: { format, effort },
    messages: [{ role: "user", content }],
  });
  const [priceIn, priceOut] = PRICES[model];
  const stats: CallStats = {
    label,
    model,
    inputTokens: res.usage.input_tokens,
    outputTokens: res.usage.output_tokens,
    costUsd: res.usage.input_tokens * priceIn + res.usage.output_tokens * priceOut,
    ms: Date.now() - t0,
    stopReason: res.stop_reason,
  };
  if (res.stop_reason !== "end_turn" || !res.parsed_output) {
    throw new Error(`${label}: stop_reason=${res.stop_reason}, parsed=${!!res.parsed_output}, request_id=${res._request_id}`);
  }
  return { output: res.parsed_output as T, stats };
}

export async function singleCall(client: Anthropic, src: SourceInput, role: string, effort: Effort, model: Model) {
  const system = `You turn a person's Source (an old CV or a free-text description) into a role-targeted CV draft.\n\nFirst list the Facts.\n${FACT_RULES}\n\nThen ${COMPOSE_RULES}`;
  const { output, stats } = await call(client, "single", model, zodOutputFormat(SingleOutput), system, [
    sourceBlock(src),
    { type: "text", text: `Target role: ${role}` },
  ], effort);
  return { facts: output.facts, cv: output.cv, calls: [stats] };
}

export async function staged(client: Anthropic, src: SourceInput, role: string, effort: Effort, extractModel: Model, composeModel: Model) {
  const ex = await call(client, "extract", extractModel, zodOutputFormat(ExtractOutput),
    `You extract Facts from a person's Source (an old CV or a free-text description). Do not judge relevance; extract everything.\n${FACT_RULES}`,
    [sourceBlock(src)], effort);
  // The composer never sees the Source: anything not extracted cannot leak in.
  const factsJson = JSON.stringify(ex.output.facts.map(({ id, text }) => ({ id, text })), null, 1);
  const co = await call(client, "compose", composeModel, zodOutputFormat(CvDraft),
    `You turn a list of Facts about a person into a role-targeted CV draft. The Facts are all you know about them.\n\n${COMPOSE_RULES}`,
    [{ type: "text", text: `<facts>\n${factsJson}\n</facts>\n\nTarget role: ${role}` }], effort);
  return { facts: ex.output.facts, cv: co.output, calls: [ex.stats, co.stats] };
}

// ---------- optional LLM check: is every claim entailed by its cited facts? ----------

export const JudgeOutput = z.object({
  findings: z.array(z.object({
    path: z.string().describe("e.g. experience[0].bullets[2], skills[3], summary"),
    claim: z.string().describe("the specific unsupported part"),
    severity: z.enum(["invented", "exaggerated", "miscited"]).describe("invented: no fact states it; exaggerated: fact states less; miscited: another fact supports it but not the cited ones"),
  })),
});
export type JudgeFinding = z.infer<typeof JudgeOutput>["findings"][number];

export const JUDGE_SYSTEM = `You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.`;

export async function judge(client: Anthropic, facts: Fact[], cv: CvDraft, model: Model = MODEL) {
  const { output, stats } = await call(client, "judge", model, zodOutputFormat(JudgeOutput), JUDGE_SYSTEM,
    [{ type: "text", text: `<facts>\n${JSON.stringify(facts.map(({ id, text }) => ({ id, text })), null, 1)}\n</facts>\n<cv>\n${JSON.stringify({ ...cv, questions: undefined }, null, 1)}\n</cv>` }],
    "medium");
  return { findings: output.findings, stats };
}
