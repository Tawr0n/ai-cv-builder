# Claude API capabilities for CV generation

Research for [#2](https://github.com/Tawr0n/ai-cv-builder/issues/2). Researched 2026-10-28.

## Sources

| Tag | Source |
| --- | --- |
| [SO] | Structured outputs — https://platform.claude.com/docs/en/build-with-claude/structured-outputs |
| [PDF] | PDF support — https://platform.claude.com/docs/en/build-with-claude/pdf-support |
| [CIT] | Citations — https://platform.claude.com/docs/en/build-with-claude/citations |
| [TS] | TypeScript SDK — https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript (repo: https://github.com/anthropics/anthropic-sdk-typescript) |
| [ERR] | Errors — https://platform.claude.com/docs/en/api/errors |
| [SKILL] | Anthropic `claude-api` skill reference bundled with Claude Code (model table cached 2026-10-06; tool-use concepts; error-code table). Used for model IDs/pricing and model-specific API rules. Pricing page to re-check before submission: https://platform.claude.com/docs/en/about-claude/pricing |

---

## 1. Structured output: tool use vs native structured outputs

**Two mechanisms, both constrained decoding** [SO]:

- **JSON outputs** — `output_config: { format: { type: "json_schema", ... } }`. The response's text block is valid JSON that matches the schema; "you don't need `JSON.parse()` error handling, retries for schema violations, or checks for missing required fields" — with exceptions below.
- **Strict tool use** — `strict: true` on a tool definition guarantees the tool name and `input` validate against `input_schema`. This is for *calling functions*, not for getting a JSON answer.

**Tool use is the wrong vehicle on current models.** The old "force a tool call to get JSON" trick needs `tool_choice: {type: "any" | "tool"}`, which **returns a 400 on Claude Opus 5.5 and Claude Sonnet 5.5** (also Fable 5.1). With `tool_choice: auto` there is no guarantee a call happens at all [SKILL: tool-use-concepts]. Use `output_config.format`.

**TypeScript helper** [SO]:

```ts
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
const res = await client.messages.parse({
  model, max_tokens, messages,
  output_config: { format: zodOutputFormat(CvSchema) },
});
res.parsed_output; // typed + validated against the ORIGINAL zod schema
```

`jsonSchemaOutputFormat` (from `@anthropic-ai/sdk/helpers/json-schema`) exists for plain JSON Schema but **does not validate** the response [SO].

**Schema subset** [SO]. Supported: object/array/string/integer/number/boolean/null, `enum` (primitives only), `const`, `anyOf`, `allOf` (not with `$ref`), internal `$ref`/`$defs`, `required`, `default`, `additionalProperties: false` (required on every object), string formats (`date`, `date-time`, `email`, `uri`, `uuid`, …), array `minItems` 0 or 1.
Not supported (400): recursive schemas, external `$ref`, `minimum`/`maximum`/`multipleOf`, `minLength`/`maxLength`, array constraints beyond `minItems` 0/1, complex enum members. Regex `pattern` is partial (no backreferences/lookaround/`\b`).
The SDK helpers by default move unsupported constraints into field descriptions; `zodOutputFormat` then validates them client-side [SO].

First request with a new schema pays a one-time compilation cost; compiled schemas are cached 24 h [SKILL].

**What we still must validate / handle** [SO]:

1. `stop_reason === "refusal"` — HTTP 200, billed, output may not match the schema.
2. `stop_reason === "max_tokens"` — output may be truncated/invalid.
3. Constraints the API stripped (lengths, min/max) — `zodOutputFormat` throws on violation; treat as a retryable generation failure.
4. Enum/const **casing may change** ("Conversation Topic 3" vs "Conversation topic 3") with a normal stop reason — compare case-insensitively or avoid enums whose values differ only by case.
5. Property order: required first, then optional.
6. **Semantics** — the schema guarantees shape and types, not truth. Fact-grounding is entirely our job (see §3 and #7).

## 2. PDF input

**Native document block** [PDF]: `{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }` (also `url` or Files API `file_id`). Place it before the text block.

| Limit | Value [PDF] |
| --- | --- |
| Request size | 32 MB (whole request, incl. other content) |
| Pages | 600 per request (100 when the context window is under 1M; all current Opus/Sonnet/Haiku 5.5 are 1M [SKILL]) |
| Format | Standard PDF, **no password/encryption** |

**How it works** [PDF]: every page is converted to an image *and* its text is extracted; Claude gets both. Cost = text tokens (typically 1,500–3,000 per page) + image tokens per page (vision pricing). No extra PDF fee. `count_tokens` can estimate.

**Scanned PDFs**: because each page is sent as an image, Claude can read image-only pages via vision [PDF]. But **citations cannot point into scanned pages** — "PDFs that are scans of documents and do not contain extractable text are not citable" [CIT].

**Native vs extracting text ourselves:**

| | Native document block | Our own extraction (e.g. `unpdf`/`pdf-parse`) |
| --- | --- | --- |
| Scanned / image-only CV | Works (vision) | Empty text — needs OCR |
| Multi-column / table layouts | Model sees the layout image | Reading order often scrambled |
| Token cost per page | Higher (text + image) | Text only |
| A verbatim "source text" we can store and diff against | No (we don't get the extracted text back) | Yes |
| Dependencies | None | Extra lib, OCR for scans |

A CV is 1–3 pages, so the cost difference is cents at most.

## 3. Citations / grounding

[CIT]: set `citations: { enabled: true }` on document blocks (all or none). The response splits into text blocks; cited blocks carry `citations[]` with `cited_text` + location: `char_location` (plain text, 0-indexed chars), `page_location` (PDF, 1-indexed pages), `content_block_location` (custom-content documents, 0-indexed block ranges). PDFs and plain text are chunked by sentence; **custom content documents** use our blocks as-is (good for "one fact per block"). Citations are guaranteed to be valid pointers into the provided documents; `cited_text` doesn't count toward output tokens. All active models support it. Text only — no image citations.

**Blocker: citations and structured outputs are incompatible.** Enabling citations on any document while sending `output_config.format` returns a **400** [CIT][SO]. We can have schema-valid JSON *or* citations in one call, not both.

**Implication:** API citations don't fit a JSON-producing generation step. Grounding has to be designed into our schema instead (e.g. a fact-extraction step that assigns IDs, then every generated bullet carries `sourceFactIds`, which the server verifies exist). Citations remain usable for a free-text "explain where this came from" step if we ever want one.

## 4. Model choice and cost

Current models [SKILL, cached 2026-10-06] — use the exact IDs, no date suffixes:

| Model | ID | Context / max out | Input $/MTok | Output $/MTok |
| --- | --- | --- | --- | --- |
| Claude Opus 5.5 | `claude-opus-5-5` | 1M / 128K | 4.00 | 20.00 |
| Claude Sonnet 5.5 | `claude-sonnet-5-5` | 1M / 128K | 2.00 | 10.00 |
| Claude Haiku 5.5 | `claude-haiku-5-5` | 1M / 128K | 0.10 (≤100K prompt) | 0.50 |
| Claude Fable 5.1 | `claude-fable-5-1` | 1M / 128K | 10.00 | 50.00 |

**Workload estimate** (one generation): 2-page PDF ≈ 6–10K input tokens (text + page images) + ~1–2K prompt/schema; output CV JSON + questions ≈ 2–4K tokens plus thinking.
Opus 5.5 ≈ $0.05–0.12; Sonnet 5.5 ≈ half; Haiku 5.5 ≈ < $0.01. All negligible for a demo.

**Model-specific API rules that shape code** [SKILL]:

- **Opus 5.5**: thinking is always on (`thinking: {type: "disabled"}` → 400); control depth with `output_config.effort` — **default is `medium`**, set it explicitly. No `temperature`/`top_p`/`top_k` (400). No assistant prefill (400). Forced `tool_choice` → 400.
- **Sonnet 5.5**: same tool_choice/prefill/sampling restrictions; thinking off only via `{type: "between_tools"}`.
- **API version `2026-10-21`** (sent by TS SDK ≥ 1.0.0 [TS]) rejects `temperature`/`top_p`/`top_k` on *every* model — there is no deterministic sampling knob.
- **Refusals**: `stop_reason: "refusal"` (HTTP 200) with `stop_details.category`. For Opus 5.5 the server-side fallback (`fallbacks: "default"` + beta `server-side-fallback-2026-07-01`, via `client.beta.messages`) re-routes refused requests; Haiku 5.5 has no server-side fallback. Unlikely to trigger on CVs, but must be handled as a failure state.

**Latency**: not benchmarked here. Opus with thinking on a ~10K-token input is typically tens of seconds, which fits an async job with progress, not a synchronous request. Lowering `effort` is the first latency/cost lever, before switching model [SKILL].

## 5. TypeScript SDK behaviour (`@anthropic-ai/sdk`)

From [TS] unless noted:

- **Runtimes**: Node 20 LTS+, TS ≥ 5.0. Browser use disabled by default (keep the key server-side — consistent with "Next.js UI only").
- **Timeout**: default **10 min**; for large non-streaming `max_tokens` it scales up to 60 min (`3600 * maxTokens / 128000` s, floor 600 s). The SDK **throws** if a non-streaming request is *expected* to exceed ~10 min, unless `stream: true` or an explicit `timeout`. Timeout → `APIConnectionTimeoutError`. Units are **milliseconds** (`timeout: 20_000`), client-level or per-request.
- **Retries**: automatic, **2 by default**, short exponential backoff, for connection errors, 408, 409, 429 and ≥500 (incl. 529 overloaded). Timeouts are retried too, so wall-clock can reach `timeout × (maxRetries + 1)` [SKILL]. Configure with `maxRetries` (client or per-request).
- **Error classes** (all extend `Anthropic.APIError`, with `.status`, `.headers`):

  | Status | Class | API error type [ERR][SKILL] | Retry? |
  | --- | --- | --- | --- |
  | 400 | `BadRequestError` | `invalid_request_error` (bad params, unsupported schema, encrypted PDF, prefill, forced tool_choice) | No |
  | 401 | `AuthenticationError` | `authentication_error` | No |
  | 403 | `PermissionDeniedError` | `permission_error` | No |
  | 404 | `NotFoundError` | `not_found_error` (bad model ID) | No |
  | 413 | (`APIError`, status 413) | `request_too_large` (>32 MB) | No |
  | 429 | `RateLimitError` | `rate_limit_error` (honour `retry-after`) | Yes |
  | 500 | `InternalServerError` | `api_error` | Yes |
  | 529 | `InternalServerError` (status 529) | `overloaded_error` | Yes |
  | — | `APIConnectionError` / `APIConnectionTimeoutError` | network / timeout | Yes |

  Catch most-specific first; don't string-match messages [SKILL].
- **Request ID**: every response has `_request_id` (from the `request-id` header) — log it.
- **Streaming**: `client.messages.stream({...})` with `.on("text", …)` and `await stream.finalMessage()`; or `messages.create({ stream: true })` for a raw async iterable. Cancel with `break` or `stream.controller.abort()`. Streaming is recommended for long requests; idle connections can be dropped by networks.
- **Logging**: `ANTHROPIC_LOG` / `logLevel`; `debug` logs full bodies (CV PII) — never in production.
- **Credentials**: if both `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` are set the API returns 401 [SKILL/ERR] — compose should set only the key.

---

## Recommendation for our pipeline

1. **Model**: `claude-opus-5-5` from an `ANTHROPIC_MODEL` env var (default), `output_config.effort` set explicitly (`medium`, tune later). Sonnet 5.5 is the cheaper drop-in if latency/cost matters; that's a config change, not code.
2. **Structured output**: `client.messages.parse` + `zodOutputFormat(schema)` with zod schemas from `packages/shared`, kept inside the supported subset (no recursion; avoid relying on min/max/length — the helper enforces them client-side, which turns violations into retries). No tool use for JSON.
3. **Grounding**: no API citations (incompatible with JSON output). Two-step design for #7: (a) *extract* — source (PDF document block or free text) → structured facts with stable IDs; (b) *generate* — facts + target role → CV JSON whose every item references `sourceFactIds`, plus `questions[]` for gaps. Server-side checks that every referenced ID exists; missing facts become questions, never text.
4. **PDF**: send the PDF natively as a base64 `document` block (handles scans and layouts, no OCR dependency). Our own limits well below the API's: e.g. ≤ 10 MB, ≤ 10 pages, reject encrypted PDFs up front. Keep the original bytes so a retry can resend them. Files API is unnecessary for one-shot jobs.
5. **SDK config**: one injectable `Anthropic` client in NestJS; explicit `timeout` (e.g. 120 s) and `maxRetries: 2`; non-streaming `parse` with `max_tokens` ≈ 16K is fine inside a background job (streaming only if we want token-level progress). Map errors to job states: 429/5xx/529/connection → retryable (SDK retries first, job retry after); 400/401/403/404/413 → permanent failure; `refusal` / `max_tokens` / zod validation failure → generation failure (retry once, then fail with a user-facing message). Log `_request_id`.
6. **Testing**: no temperature control exists, so tests must fake the client at our own port (a `CvGenerator` interface), not assert on live outputs.

## Open questions / not verified

- Whether `messages.parse` composes with the beta server-side refusal fallback (`client.beta.messages` + `fallbacks`) — check the SDK before enabling it.
- Real latency of Opus 5.5 at `medium` effort on a 2-page CV — measure once with a live key.
- Image-token cost per PDF page at CV resolution — measure with `count_tokens`.
