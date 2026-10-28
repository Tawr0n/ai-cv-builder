# CV content is one JSONB document, not normalized tables

CV content (contact, summary, experience, education, skills) is stored as a single `jsonb` column on `Cv`, validated by a shared zod schema; Facts live in a second `jsonb` column, while Source and Question stay relational tables. A CV is always read and written whole (the editor loads it, generation returns it as structured JSON, the PDF renders it), order inside lists matters, and nothing queries across CVs, so a document matches the access pattern; this holds regardless of the time budget.

## Considered options

- **Normalized tables** (`experience`, `bullet`, `education`, `skill`): gives database-enforced types and a real foreign key from a Question to the bullet it is about, but every save needs a diff of added/removed/changed/reordered rows plus a `position` column, every shape change needs a migration, and LLM output has to be split into rows and reassembled. It becomes the better choice only if one Experience must be shared by several CVs (a master profile with tailored CVs), or if CVs need searching across users — neither is in scope.
- **Everything in one JSON, Questions included**: every answered Question would rewrite the whole CV and bump its version, making answers conflict with unrelated manual edits.

## Consequences

- The database does not know the document's shape; the zod schema is the only structural guarantee, so it is applied on every write and every read. A cheap `CHECK (jsonb_typeof(content) = 'object')` guards against gross corruption. `pg_jsonschema` was rejected because it is not in the official `postgres` image.
- A Question's Anchor refers to an item by id, not by foreign key, so it can dangle; the Question's `obsolete` status covers that.
- Concurrent writes are guarded by an integer `version` on `Cv` (optimistic concurrency, `409` on a stale write) because a whole-document save would otherwise silently overwrite a parallel change.
