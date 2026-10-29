# AI CV Builder

Turns a person's existing CV or free-text background into a role-targeted CV draft, without inventing facts, and lets them refine it.

> Work in progress: this README grows with each slice of [Implementation](https://github.com/Tawr0n/ai-cv-builder/issues/26).

## Run it

Needs Docker and an [Anthropic API key](https://console.anthropic.com/).

```bash
cp .env.example .env   # then put your key into .env
docker compose up --build
```

Open <http://localhost:3000>. `docker compose up` starts `db` → `api` → `web`, each waiting until the previous one is healthy, and refuses to start without `ANTHROPIC_API_KEY`. Only the web app is published; it forwards `/api/*` to the API. The API documentation (Swagger UI) is at <http://localhost:3000/api/docs>.

## Develop and test

Needs Node 24 ([Volta](https://volta.sh/) picks the pinned version), pnpm via `corepack enable`, and Docker running.

```bash
pnpm install     # also builds packages/shared and generates the Prisma client
pnpm typecheck
pnpm lint        # oxlint + Prettier check; `pnpm format` fixes formatting
pnpm test        # API tests against a throwaway Postgres (Testcontainers)
```

`pnpm test` never calls the Anthropic API and needs no key: every test runs against a scripted fake of the model. CI runs the same four steps on every pull request.

## Layout

| Path                      | What                                                          |
| ------------------------- | ------------------------------------------------------------- |
| `apps/api`                | NestJS API: Prisma + Postgres, the Generation pipeline        |
| `apps/web`                | Next.js UI only; reaches the API through its `/api/*` rewrite |
| `packages/shared`         | zod schemas for the HTTP contract, used by both apps          |
| `docs/adr`, `GLOSSARY.md` | Decisions and domain language                                 |
| `docs/trade-offs.md`      | What was deliberately simplified, and what would remove it    |
