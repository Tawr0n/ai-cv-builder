# Background jobs and progress delivery in NestJS

Research for [#3](https://github.com/Tawr0n/ai-cv-builder/issues/3). Researched on 2026-10-28.

**Question:** how should long-running CV generation run in the background in a NestJS app, so that it survives page reloads and process restarts, without adding infrastructure we don't need? How should progress reach the browser, given that Next.js proxies `/api/*` to NestJS via `rewrites`?

**Context:** NestJS API in `apps/api`, Next.js UI in `apps/web`, PostgreSQL + Prisma, `docker compose up`, roughly 8 hours of implementation budget.

## TL;DR

- **Queue: use pg-boss** (12.38.0). It needs no new container and is mature. Retries with exponential backoff, recovery of jobs stuck after a crash, and `SKIP LOCKED` concurrency are all built in. It can enqueue inside a Prisma transaction.
- **Progress: keep it in our own `Generation` row**, because pg-boss has no progress API. **Deliver it by polling** `GET /api/generations/:id` every 1–2 s.
- **SSE through Next.js `rewrites` does stream, but only if two conditions hold** (tested on Next 16.4.3):
  1. The response must carry `Cache-Control: no-transform`. Otherwise Next's built-in gzip buffers every event until the stream ends.
  2. Bytes must flow at least every 30 s. Otherwise Next's default 30 s proxy idle timeout silently cuts the connection.
- SSE works under those conditions, but it adds failure modes that polling doesn't have, and it saves nothing at our scale.

## Current versions and maintenance (npm registry, 2026-10-28)

| Package | Latest | Released | Notes |
|---|---|---|---|
| `pg-boss` | 12.38.0 | 2026-10-13 | `engines.node >= 22.12.0`; PostgreSQL 13+; MIT; one maintainer (README: "maintained by one person"); repo pushed 2026-10-27, 4.1k stars |
| `bullmq` | 6.5.0 | 2026-10-26 | v6.0.0 (2026-07-30) added a PostgreSQL backend alongside Redis; repo pushed 2026-10-28, 9.5k stars |
| `@nestjs/bullmq` | 12.0.0 | 2026-08-27 | peer `bullmq ^3–^6`, `@nestjs/* ^10–^12` |
| `@nestjs/core` | 12.3.2 | 2026-10-27 | |
| `next` | 16.4.3 | 2026-10-23 | |
| `prisma` | `latest` tag = **8.0.0-rc.28** | | npm `latest` points at a release candidate; last stable is 7.10.1 (`prev` tag). Pin 7.x explicitly. |

Sources: `https://registry.npmjs.org/<pkg>`, `gh api repos/timgit/pg-boss`, `gh api repos/taskforcesh/bullmq/releases`.

## Options compared

| | **pg-boss** | **BullMQ + Redis** | **BullMQ on Postgres backend** | **Hand-rolled job table + `SKIP LOCKED`** | **In-process + status in DB** |
|---|---|---|---|---|---|
| Retries / backoff | `retryLimit` (default 2), `retryDelay`, `retryBackoff` (exponential), `retryDelayMax` | `attempts` + `backoff: fixed \| exponential \| custom`, `jitter` (no retries by default) | same API as Redis | write it yourself | write it yourself |
| Stuck-job recovery after crash | `expireInSeconds` (default 15 min) and optional `heartbeatSeconds` (≥10). The monitor (every 60 s) re-queues to `retry` while `retry_count < retry_limit`, otherwise `failed` | lock renewal; stalled jobs moved back to wait, failed after `maxStalledCount` (default 1); check every 30 s | not documented on the Postgres page | write it yourself (`locked_until` column + sweep) | startup sweep that marks `running` rows failed/requeued; no retry of in-flight work unless you build it |
| Concurrency | `FOR UPDATE SKIP LOCKED`; `localConcurrency` per process; `groupConcurrency` across nodes | `concurrency` per worker | same API | `SKIP LOCKED` (Postgres docs: suitable "with multiple consumers accessing a queue-like table") | whatever you allow in-process |
| docker-compose cost | **none** (uses existing Postgres; creates `pgboss` schema) | **+1 service** (Redis 6.2+) plus healthcheck and volume | none, but needs an explicit `runMigrations()` step | none | none |
| NestJS integration | no official module; a ~30-line provider (`onModuleInit` → `start()`, `onModuleDestroy` → `stop()`) | official `@nestjs/bullmq` (`@Processor`, `WorkerHost`, `job.updateProgress`, `@OnQueueEvent`) | `@nestjs/bullmq` docs only describe Redis | plain service | plain service |
| Progress | none (`touch()` is heartbeat only; `update()` only on not-yet-active jobs) | `job.updateProgress()` + `QueueEvents` | not documented | own column | own column |
| Enqueue atomically with domain write | yes: `boss.send(..., { db: fromPrisma(tx) })` (Prisma 7+, `@prisma/adapter-pg`) | no (separate store) | possible in theory, not documented with Prisma | yes | yes |
| Testability | real Postgres (already in our test plan); handler is a plain function | needs Redis in tests too | real Postgres | real Postgres; but more of our own code to test | easiest to unit-test, weakest guarantees |
| Maturity | 10+ years, Postgres-native | very mature on Redis | **~3 months old**; frequent `postgres:` fixes in 6.0.x–6.3.x; README calls Redis "the most battle-tested option" | as good as our code | n/a |

### Why the others lose

- **BullMQ + Redis** adds a container, a second stateful store, and a second healthcheck to `docker compose`, which is exactly the infrastructure the ticket wants to avoid. It has the nicest NestJS integration and built-in progress, but we would only use progress for one job type, and a DB column does the same.
- **BullMQ on Postgres** is interesting news, but it is three months old, it has no documented NestJS/Prisma story, and it needs explicit migrations. That makes it too fresh to bet a time-boxed deliverable on.
- **Hand-rolled `SKIP LOCKED`** is maybe 80–150 lines, but those lines cover retries, backoff, a stuck-job sweep and graceful shutdown. pg-boss has already written and tested them. That code would also need its own tests, which costs budget we don't have.
- **In-process (fire-and-forget promise + status column)** survives page reloads, because status lives in the DB. It does not survive process restarts unless we write a recovery sweep, and it has no retries. Cheapest to build, but it is the "cut reliability" option the map forbids.

## pg-boss details that matter for the spec

- **Crash recovery path** (verified in `dist/plans.js`, `failJobsBody`): jobs past expiry or heartbeat are deleted and re-inserted as `retry` when `retry_count < retry_limit`, else `failed`. Recovery latency is roughly `heartbeatSeconds` (or `expireInSeconds`) plus up to `monitorIntervalSeconds` (default 60 s).
- **Expiry also aborts the handler's signal**: "a handler that runs past `expireInSeconds` has its batch failed and its signals aborted". Pass that `AbortSignal` into the Anthropic SDK call so a timed-out attempt actually stops.
- **Handler throw → `fail()` → retry**. Because a crashed attempt is re-run, the handler must be idempotent: it overwrites the `Generation` result and does not append.
- **Graceful shutdown**: `offWork({ wait: true })` / `stop()` wait for current jobs. Wire this to Nest's `enableShutdownHooks()` so that `docker compose down` doesn't strand jobs. If it does strand one, expiry or heartbeat recovers it anyway.
- **Transactional enqueue**: create the `Generation` row and the job in one Prisma transaction via `fromPrisma(tx)`, so we never get a row with no job, or a job with no row. This needs Prisma 7+ with `@prisma/adapter-pg`.
- **Schema**: pg-boss keeps its tables in its own `pgboss` schema and migrates itself on `start()` (`migrate: true` by default). Prisma Migrate manages only the schema(s) in our datasource. We should confirm that `prisma migrate dev` ignores `pgboss` during the first slice; not yet verified.
- **Runtime**: needs Node ≥ 22.12, which constrains the Docker base image (e.g. `node:22` or `node:24`).

## Progress delivery

### What the frameworks provide

- **NestJS SSE**: `@Sse()` handler returning `Observable<MessageEvent>`. If `id` isn't set, Nest assigns an incrementing one. Client disconnect unsubscribes the Observable. `@SseSignal()` gives an `AbortSignal`. Headers set via `@Header()` are sent on `@Sse()` routes. Source: https://docs.nestjs.com/techniques/server-sent-events
- **Next.js `rewrites` docs** say nothing about streaming, buffering, compression or timeouts. Source: https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites (lastUpdated 2026-09-28).

### What Next.js actually does (source, `next@16.4.3`)

- `dist/server/lib/router-server.js` applies the `compression` middleware to **every** response when `config.compress !== false` (the default). This happens before the external rewrite is proxied, so proxied responses get gzipped too.
- `dist/server/lib/router-utils/proxy-request.js` proxies with `httpxy` and `proxyTimeout: proxyTimeout || 30000`. The value comes from `config.experimental.proxyTimeout`. In `httpxy` this is `proxyReq.setTimeout(...)`, which is an **idle** socket timeout that destroys the upstream request.

### Experiment (Next 16.4.3, `next build && next start`, Node 24)

Setup: an upstream Node SSE server emits one event per second, with `Content-Type: text/event-stream` and flushed headers. Next rewrites `/api/:path*` to it. A client logs the arrival time of each chunk.

| Case | Result |
|---|---|
| A. No `Accept-Encoding` | events arrive at 0 s, 1 s, 2 s, 3 s, so streaming works |
| B. `Accept-Encoding: gzip, deflate, br` (what every browser sends) | `content-encoding: gzip`; 10 B header at 0 s, then **all four events at 3 s** when the stream ends. **Fully buffered.** |
| C. As B, upstream sends `Cache-Control: no-cache, no-transform` | not compressed; events at 0/1/2/3 s, so streaming works |
| D. As C, 35 s gap between events | connection **closed at 31 s** with no error event (the client sees a drop, `EventSource` would reconnect) |
| E. As D, plus `: ping` comment every 10 s | survives; events at 0, 1, 36, 37 s, so streaming works |

**Answer: yes, SSE through `rewrites` buffers by default** in any real browser, because of gzip. It works if NestJS sends `Cache-Control: no-transform` (or `compress: false` is set in `next.config`) **and** heartbeats more often than every 30 s (or `experimental.proxyTimeout` is raised). The experiment scripts are not committed; they were throwaway files in a scratch dir.

### Recommendation: polling

- `GET /api/generations/:id` returns `{ status, step, error?, resultUrl? }` from the `Generation` row. The UI polls it every 1–2 s while the status is non-terminal (e.g. TanStack Query `refetchInterval` returning `false` once the status is terminal).
- Why polling wins here:
  - It survives reloads and restarts trivially, because the state lives in the DB.
  - It needs no proxy workarounds and no LISTEN/NOTIFY fan-out if the worker runs in a different process from the API.
  - It's trivially testable with Supertest.
  - A generation takes tens of seconds, so a 1–2 s delay in progress updates doesn't matter.
- SSE stays a possible later upgrade. If someone adds it, the two conditions above are mandatory, and the SSE endpoint should still read from the same `Generation` row, so polling remains the fallback.

## Implications for other tickets

1. **Any request through the Next proxy that is silent for more than 30 s is cut.** This includes a synchronous LLM call or a slow PDF render behind `/api/*`. That alone rules out doing generation inside the request, and it matters for PDF generation if it is done on demand. The limit can be raised via `experimental.proxyTimeout`.
2. **gzip buffers any streamed response through `rewrites`**, not only SSE (for example, a streamed LLM response). Set `Cache-Control: no-transform` on such endpoints.
3. **pg-boss requires Node ≥ 22.12**, which constrains the Docker base image for `apps/api`.
4. **npm `prisma@latest` is currently an 8.0 release candidate.** Pin `prisma`/`@prisma/client` to 7.x. pg-boss's `fromPrisma` adapter needs 7+ with `@prisma/adapter-pg`.
5. **Docker topology:** the pg-boss worker can run in the same NestJS process as the API, so compose needs only `db`, `api` and `web`. A separate worker container (same image, different entrypoint) is possible later without code changes, because pg-boss coordinates through Postgres.

## Sources

- pg-boss README (npm): https://www.npmjs.com/package/pg-boss
- pg-boss jobs API: https://pgboss.io/api/jobs
- pg-boss workers API: https://pgboss.io/api/workers
- pg-boss constructor/supervision: https://pgboss.io/api/constructor
- pg-boss adapters (Prisma): https://pgboss.io/api/adapters
- pg-boss source `dist/plans.js` (`failJobsByTimeout`, `failJobsBody`), tarball `pg-boss-12.38.0.tgz`
- BullMQ overview: https://docs.bullmq.io/
- BullMQ PostgreSQL backend: https://docs.bullmq.io/guide/postgresql
- BullMQ stalled jobs: https://docs.bullmq.io/guide/jobs/stalled
- BullMQ retries: https://docs.bullmq.io/guide/retrying-failing-jobs
- BullMQ releases (v6.0.0 Postgres backend, later `postgres:` fixes): https://github.com/taskforcesh/bullmq/releases
- NestJS queues: https://docs.nestjs.com/techniques/queues
- NestJS SSE: https://docs.nestjs.com/techniques/server-sent-events
- Next.js rewrites: https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites
- Next.js source `next@16.4.3`: `dist/server/lib/router-server.js`, `dist/server/lib/router-utils/proxy-request.js`, `dist/compiled/httpxy`
- PostgreSQL `SELECT … FOR UPDATE SKIP LOCKED`: https://www.postgresql.org/docs/current/sql-select.html
