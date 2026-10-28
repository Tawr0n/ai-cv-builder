## Git workflow

- Code reaches `main` only through a pull request. Never commit or push to `main` directly.
- Branches: `<type>/<short-kebab-description>`, where `<type>` is a Conventional Commits type, e.g. `feat/auth`, `docs/cv-document-model`. Exception: throwaway `research/<name>` branches from `/wayfinder` are pushed but never merged.
- Commits: [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<optional scope>): <imperative subject>`. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `build`, `ci`.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for Tawr0n/ai-cv-builder, using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
