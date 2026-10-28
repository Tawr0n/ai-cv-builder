// PROTOTYPE, throwaway. Renders <dir>/*.json into one self-contained <dir>/report.html.
// Usage: tsx report.ts [results | results-api]   (default results)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const resDir = new URL(`./${process.argv[2] ?? "results"}/`, import.meta.url);
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const ids = (a: string[]) => `<span class=ids>${esc(a.join(","))}</span>`;

function renderRun(r: any): string {
  if (!r.ok) return `<div class=run><h3>${r.pipeline}</h3><pre class=bad>${esc(r.error)}</pre></div>`;
  const cv = r.cv;
  const cost = r.calls.reduce((a: number, c: any) => a + c.costUsd, 0);
  const genCost = r.calls.filter((c: any) => c.label !== "judge").reduce((a: number, c: any) => a + c.costUsd, 0);
  const genMs = r.calls.filter((c: any) => c.label !== "judge").reduce((a: number, c: any) => a + c.ms, 0);
  return `<div class=run>
  <h3>${r.pipeline}</h3>
  <p class=meta>generation $${genCost.toFixed(3)} · ${(genMs / 1000).toFixed(0)}s · with judge $${cost.toFixed(3)} · ${r.facts.length} facts</p>
  <h4>Validator (${r.issues.length})</h4>
  ${r.issues.length ? `<ul>${r.issues.map((i: any) => `<li class=${i.severity}><b>${esc(i.rule)}</b> ${esc(i.path)} <code>${esc(i.detail)}</code></li>`).join("")}</ul>` : "<p class=good>clean</p>"}
  <h4>Judge (${r.judge.length})</h4>
  ${r.judge.length ? `<ul>${r.judge.map((f: any) => `<li class=flag><b>${esc(f.severity)}</b> ${esc(f.path)}: ${esc(f.claim)}</li>`).join("")}</ul>` : "<p class=good>clean</p>"}
  <h4>Questions (${cv.questions.length})</h4>
  <ol>${cv.questions.map((q: any) => `<li>${esc(q.text)} <span class=ids>${esc(q.section)}${q.itemIndex ?? ""}${q.field ? "." + esc(q.field) : ""}</span></li>`).join("")}</ol>
  <h4>CV</h4>
  <div class=cv>
    <p><b>${esc(cv.contact.fullName) || "<i>no name</i>"}</b> · ${esc(cv.contact.email)} · ${esc(cv.contact.phone)} · ${esc(cv.contact.location)} ${esc(cv.contact.links.join(" "))}</p>
    <p>${esc(cv.summary.text)} ${ids(cv.summary.sourceFactIds)}</p>
    ${cv.experience.map((e: any) => `<p><b>${esc(e.title)}</b>, ${esc(e.organization)} · ${esc(e.startDate)}–${e.isCurrent ? "now" : esc(e.endDate)} ${ids(e.sourceFactIds)}</p><ul>${e.bullets.map((b: any) => `<li>${esc(b.text)} ${ids(b.sourceFactIds)}</li>`).join("")}</ul>`).join("")}
    ${cv.education.map((e: any) => `<p>🎓 ${esc(e.degree)} ${esc(e.field)}, ${esc(e.institution)} · ${esc(e.startDate)}–${esc(e.endDate)} ${ids(e.sourceFactIds)}</p>`).join("")}
    <p>${cv.skills.map((s: any) => esc(s.name)).join(" · ")}</p>
  </div>
  <details><summary>Facts</summary><ul>${r.facts.map((f: any) => `<li><span class=ids>${esc(f.id)}</span> ${esc(f.text)}</li>`).join("")}</ul></details>
</div>`;
}

const files = readdirSync(resDir).filter((f) => f.endsWith(".json")).sort();
const body = files.map((f) => {
  const d = JSON.parse(readFileSync(new URL(f, resDir), "utf8"));
  return `<section><h2>${esc(d.sample)} → ${esc(d.role)}</h2><p class=meta>${esc(d.model)}, effort ${esc(d.effort)}</p>
  <details><summary>Source</summary><pre>${esc(d.source)}</pre></details>
  <div class=cols>${d.runs.map(renderRun).join("")}</div></section>`;
}).join("");

writeFileSync(new URL("report.html", resDir), `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Generation pipeline prototype</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;margin:0 auto;max-width:1400px;padding:16px;color:#1d1d1f;background:#fff}
h2{border-top:2px solid #333;padding-top:12px}.meta{color:#666}
.cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
.run{border:1px solid #ddd;border-radius:8px;padding:12px}.cv{background:#fafafa;padding:8px;border-radius:6px}
.ids{color:#7a5af5;font-size:11px;font-family:ui-monospace,monospace}
.reject{color:#b00020}.flag{color:#a15c00}.good{color:#1a7f37}.bad{color:#b00020;white-space:pre-wrap}
pre{white-space:pre-wrap;background:#f4f4f4;padding:8px}
</style>
<h1>Generation pipeline prototype: single call vs staged</h1>
<p>PROTOTYPE, throwaway. Same Sources and Target roles through both pipelines. Validator = deterministic checks (red: reject, amber: flag). Judge = a separate Claude call looking for claims the cited Facts don't support.</p>
${body}`);
console.log(`wrote ${resDir.pathname}report.html`);
