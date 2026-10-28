// PROTOTYPE, throwaway. Runs both pipelines on every sample, checks them, writes results/*.json.
// Usage: pnpm run run [sampleId]   (reads ANTHROPIC_API_KEY from <repo>/.env.prototype)
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { judge, MODEL, singleCall, staged, type SourceInput } from "./pipeline.ts";
import { validate } from "./validate.ts";

process.loadEnvFile(new URL("../../.env.prototype", import.meta.url).pathname);

const SAMPLES: { id: string; role: string; file: string; oracleText: string }[] = [
  { id: "1-rich-text", role: "Senior Backend Engineer", file: "1-rich-text.txt", oracleText: "1-rich-text.txt" },
  // The PDF's text is known only because we made the PDF; production has no such oracle.
  { id: "2-pdf", role: "Product Analyst", file: "2-pdf.pdf", oracleText: "2-pdf-source.txt" },
  { id: "3-sparse-uk", role: "Middle Frontend Developer", file: "3-sparse-uk.txt", oracleText: "3-sparse-uk.txt" },
];

const EFFORT = (process.env.EFFORT ?? "medium") as "low" | "medium" | "high";
const client = new Anthropic({ timeout: 180_000, maxRetries: 2 });
const only = process.argv[2];
const dir = new URL("./samples/", import.meta.url);
mkdirSync(new URL("./results/", import.meta.url), { recursive: true });

for (const s of SAMPLES.filter((s) => !only || s.id === only)) {
  const src: SourceInput = s.file.endsWith(".pdf")
    ? { kind: "pdf", base64: readFileSync(new URL(s.file, dir)).toString("base64") }
    : { kind: "text", text: readFileSync(new URL(s.file, dir), "utf8") };
  const oracle = readFileSync(new URL(s.oracleText, dir), "utf8");

  const runs = await Promise.all(
    ([["single", singleCall], ["staged", staged]] as const).map(async ([name, fn]) => {
      try {
        const r = await fn(client, src, s.role, EFFORT);
        const issues = validate(r.cv, r.facts, oracle);
        const j = await judge(client, r.facts, r.cv);
        return { pipeline: name, ok: true as const, ...r, issues, judge: j.findings, calls: [...r.calls, j.stats] };
      } catch (e) {
        return { pipeline: name, ok: false as const, error: String(e) };
      }
    }),
  );

  const out = { sample: s.id, role: s.role, model: MODEL, effort: EFFORT, source: oracle, runs };
  writeFileSync(new URL(`./results/${s.id}.json`, import.meta.url), JSON.stringify(out, null, 2));
  for (const r of runs) {
    console.log(r.ok
      ? `${s.id} ${r.pipeline}: facts=${r.facts.length} issues=${r.issues.length} judge=${r.judge.length} questions=${r.cv.questions.length} $${r.calls.reduce((a, c) => a + c.costUsd, 0).toFixed(3)}`
      : `${s.id} ${r.pipeline}: FAILED ${r.error}`);
  }
}
