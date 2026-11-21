# ADR-0007: Ranked organization search with PostgreSQL trigrams

- **Status:** Accepted
- **Date:** 2026-11-21
- **Supersedes:** None

## Context

Organization search must remain a member-only, tenant-scoped read while scaling
past demo-sized data. The previous implementation used Prisma `contains` filters
and recency ordering across task titles/descriptions, project names/keys, and
member names/emails. Those predicates did not have specialized indexes and did
not expose relevance or pagination metadata.

## Decision

- Enable the PostgreSQL `pg_trgm` extension and create GIN indexes for task,
  project, and user search fields.
- Keep substring matching as the public behavior, but escape `%`, `_`, and `\`
  so query text is treated literally.
- Rank matches by exact match, prefix match, `similarity()`, and a stable
  timestamp/id tie-breaker.
- Keep search inside PostgreSQL and the existing organization endpoint rather
  than adding a separate search service.
- Preserve grouped task/project/people results and add `limit`, `offset`,
  `pagination.counts`, and `pagination.hasMore`.

## Consequences

### Positive

- Search ordering is deterministic and more relevant than recency alone.
- Trigram indexes support escaped `ILIKE` predicates at larger table sizes.
- Tenant isolation, archived exclusion, authentication, and membership checks
  remain in the same request path.
- The API gains counts and pagination without changing the grouped shape used
  by the web search palette.

### Negative / trade-offs

- The migration requires a PostgreSQL deployment that permits `pg_trgm`.
- Raw SQL is used because Prisma does not model trigram ranking or the required
  expression indexes directly.
- Offset pagination is simple but can drift if rows are inserted while paging;
  this is acceptable for a grouped search palette.
- The query planner may choose the tenant B-tree instead of a trigram index
  when the organization predicate is more selective. Both preserve tenant
  scoping; `EXPLAIN` should be rechecked when table statistics change.

### Follow-ups

- Add per-group cursors if a standalone full search page is introduced.
- Re-evaluate `tsvector` or a dedicated search service for language-aware
  ranking, synonyms, or cross-organization federation.
- Monitor planner behavior after production data volume grows.

## Alternatives considered

| Alternative | Why not chosen |
| --- | --- |
| PostgreSQL `tsvector` | Better for language-aware full documents, but heavier for short partial-name/key lookups and would require generated columns or triggers. |
| Dedicated search service | Adds infrastructure, synchronization, and access-control complexity before the product needs federation or advanced relevance. |
| Existing `contains` filters | Preserves behavior but has no relevance ranking and weaker index support. |

## Verification

`apps/api/tests/search.test.ts` covers ranked ordering, stable pagination
metadata, archived exclusion, tenant isolation, people search, and literal
wildcard handling. A rolled-back 100,000-task `EXPLAIN` fixture used
`Task_title_trgm_idx` for the task substring predicate.
