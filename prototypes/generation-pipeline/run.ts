// PROTOTYPE, throwaway. Runs the same 8 variants as offline.ts, on the real API, checks them,
// writes results-api/*.json (subagent results stay in results/).
// Usage: pnpm run run [sampleId]   env: EFFORT=low|medium|high (default medium), REPEATS=n (default 1)
// Reads ANTHROPIC_API_KEY from <repo>/.env.prototype.
import Anthropic from "@anthropic-ai/sdk";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { judge, singleCall, staged, type Effort, type Model, type SourceInput } from "./pipeline.ts";
import { validate } from "./validate.ts";

process.loadEnvFile(new URL("../../.env.prototype", import.meta.url).pathname);

const SAMPLES: { id: string; role: string; file: string; oracleText: string }[] = [
  { id: "1-rich-text", role: "Senior Backend Engineer", file: "1-rich-text.txt", oracleText: "1-rich-text.txt" },
  // The PDF's text is known only because we made the PDF; production has no such oracle.
  { id: "2-pdf", role: "Product Analyst", file: "2-pdf.pdf", oracleText: "2-pdf-source.txt" },
  { id: "3-sparse-uk", role: "Middle Frontend Developer", file: "3-sparse-uk.txt", oracleText: "3-sparse-uk.txt" },
];

const OPUS: Model = "claude-opus-5-5";
const SONNET: Model = "claude-sonnet-5-5";
const HAIKU: Model = "claude-haiku-5-5";

// Same ids as offline.ts so the two runs line up. The judge is always Opus.
type Variant = { id: string; single?: Model; extract?: Model; compose?: Model };
const VARIANTS: Variant[] = [
  { id: "opus-single", single: OPUS },
  { id: "opus-staged", extract: OPUS, compose: OPUS },
  { id: "sonnet-single", single: SONNET },
  { id: "sonnet-staged", extract: SONNET, compose: SONNET },
  { id: "haiku-single", single: HAIKU },
  { id: "haiku-staged", extract: HAIKU, compose: HAIKU },
  { id: "haiku-extract+opus-compose", extract: HAIKU, compose: OPUS },
  { id: "haiku-extract+sonnet-compose", extract: HAIKU, compose: SONNET },
];

const EFFORT = (process.env.EFFORT ?? "medium") as Effort;
const REPEATS = Number(process.env.REPEATS ?? 1);
const client = new Anthropic({ timeout: 180_000, maxRetries: 2 });
const only = process.argv[2];
const dir = new URL("./samples/", import.meta.url);
const outDir = new URL("./results-api/", import.meta.url);
mkdirSync(outDir, { recursive: true });

for (const s of SAMPLES.filter((s) => !only || s.id === only)) {
  const src: SourceInput = s.file.endsWith(".pdf")
    ? { kind: "pdf", base64: readFileSync(new URL(s.file, dir)).toString("base64") }
    : { kind: "text", text: readFileSync(new URL(s.file, dir), "utf8") };
  const oracle = readFileSync(new URL(s.oracleText, dir), "utf8");

  const jobs = Array.from({ length: REPEATS }, (_, n) => VARIANTS.map((v) => ({ v, n }))).flat();
  const runs = await Promise.all(
    jobs.map(async ({ v, n }) => {
      const pipeline = REPEATS > 1 ? `${v.id} #${n + 1}` : v.id;
      try {
        const r = v.single
          ? await singleCall(client, src, s.role, EFFORT, v.single)
          : await staged(client, src, s.role, EFFORT, v.extract!, v.compose!);
        const issues = validate(r.cv, r.facts, oracle);
        const j = await judge(client, r.facts, r.cv, OPUS);
        return { pipeline, ok: true as const, ...r, issues, judge: j.findings, calls: [...r.calls, j.stats] };
      } catch (e) {
        return { pipeline, ok: false as const, error: String(e) };
      }
    }),
  );

  const out = { sample: s.id, role: s.role, model: "Anthropic API; judge always Opus", effort: EFFORT, source: oracle, runs };
  writeFileSync(new URL(`${s.id}.json`, outDir), JSON.stringify(out, null, 2));
  for (const r of runs) {
    if (!r.ok) { console.log(`${s.id} ${r.pipeline}: FAILED ${r.error}`); continue; }
    const gen = r.calls.filter((c) => c.label !== "judge");
    console.log(`${s.id} ${r.pipeline}: judge=${r.judge.length} reject=${r.issues.filter((i) => i.severity === "reject").length} questions=${r.cv.questions.length} gen $${gen.reduce((a, c) => a + c.costUsd, 0).toFixed(4)} ${(gen.reduce((a, c) => a + c.ms, 0) / 1000).toFixed(1)}s, judge $${r.calls.at(-1)!.costUsd.toFixed(4)}`);
  }
}
