// PROTOTYPE, throwaway. Deterministic checks on a CV draft: pure functions, no I/O.
// This is the part that would lift into the real generation module.
import type { CvDraft, Fact } from "./pipeline.ts";

export type Issue = {
  path: string;
  rule: "unknown-fact-id" | "no-citation" | "number-not-in-facts" | "name-not-in-facts" | "skill-not-in-facts" | "quote-not-in-source";
  detail: string;
  severity: "reject" | "flag";
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Numbers as written ("2 million", "40", "8", "2023"), ignoring 1-digit list noise is not safe: keep all.
const numbersIn = (s: string) => (s.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(",", "."));

export function validate(cv: CvDraft, facts: Fact[], sourceText: string | null): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(facts.map((f) => [f.id, f]));

  // Facts themselves: is the quote really in the Source? Only checkable for text sources.
  if (sourceText !== null) {
    const src = norm(sourceText);
    for (const f of facts) {
      if (!src.includes(norm(f.quote))) issues.push({ path: `facts.${f.id}`, rule: "quote-not-in-source", detail: f.quote, severity: "flag" });
    }
  }

  const cited = (path: string, ids: string[], needCitation: boolean): string => {
    if (needCitation && ids.length === 0) issues.push({ path, rule: "no-citation", detail: "", severity: "reject" });
    for (const id of ids) if (!byId.has(id)) issues.push({ path, rule: "unknown-fact-id", detail: id, severity: "reject" });
    return norm(ids.map((id) => byId.get(id)?.text ?? "").join(" | "));
  };

  const numbersGrounded = (path: string, text: string, factText: string) => {
    const factNums = new Set(numbersIn(factText));
    for (const n of numbersIn(text)) if (!factNums.has(n)) issues.push({ path, rule: "number-not-in-facts", detail: n, severity: "flag" });
  };

  const nameGrounded = (path: string, name: string, factText: string) => {
    if (name && !factText.includes(norm(name))) issues.push({ path, rule: "name-not-in-facts", detail: name, severity: "flag" });
  };

  const c = cv.contact;
  const contactFacts = cited("contact", c.sourceFactIds, Boolean(c.fullName || c.email));
  for (const v of [c.fullName, c.email, c.phone ?? "", ...c.links]) nameGrounded("contact", v, contactFacts);

  numbersGrounded("summary", cv.summary.text, cited("summary", cv.summary.sourceFactIds, true));

  cv.experience.forEach((e, i) => {
    const p = `experience[${i}]`;
    const ft = cited(p, e.sourceFactIds, true);
    nameGrounded(p, e.organization, ft);
    for (const d of [e.startDate, e.endDate]) if (d) numbersGrounded(p, d.slice(0, 4), ft);
    e.bullets.forEach((b, j) => {
      const bp = `${p}.bullets[${j}]`;
      numbersGrounded(bp, b.text, cited(bp, b.sourceFactIds, true));
    });
  });

  cv.education.forEach((e, i) => {
    const p = `education[${i}]`;
    const ft = cited(p, e.sourceFactIds, true);
    nameGrounded(p, e.institution, ft);
    for (const d of [e.startDate, e.endDate]) if (d) numbersGrounded(p, d.slice(0, 4), ft);
  });

  cv.skills.forEach((s, i) => {
    const p = `skills[${i}]`;
    const ft = cited(p, s.sourceFactIds, true);
    if (!ft.includes(norm(s.name))) issues.push({ path: p, rule: "skill-not-in-facts", detail: s.name, severity: "flag" });
  });

  return issues;
}
