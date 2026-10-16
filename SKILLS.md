# AskItUp Engineering Playbook

Project conventions for contributors and agents. This is **not** a Cursor/Claude native skill package—it documents how *this* repository works.

## Next.js App Router

- Prefer Server Components for data loading (`/documents/[documentId]`).
- Use Client Components only for interactive surfaces (upload, Q&A, theme).
- API routes live under `src/app/api/documents/*` with `runtime = "nodejs"` for PDF work.
- Read `AGENTS.md` before assuming Next.js 13/14 APIs; this app tracks Next 16.

## TypeScript & React

- Strict TypeScript; avoid `any`.
- Validate external input with Zod (`src/lib/validation/schemas.ts`).
- UUID helpers safe for client bundles: `src/lib/validation/uuid.ts`.
- Shared UI errors: `AppError` + `toPublicError`.

## Supabase

- Only `getSupabaseAdmin()` / `supabaseAdmin` from `src/lib/supabase/admin.ts`.
- Mark secret modules with `import "server-only"`.
- Tables: `documents`, `document_chunks`, `usage_daily`, `rate_limit_buckets`.
- Retrieval: RPC `match_document_chunks(query_embedding, target_document_id, match_count)`.
- Capacity/budget: `reserve_chunk_capacity`, `reserve_gemini_budget`, `check_rate_limit`.
- Schema changes: add a versioned SQL file under `supabase/migrations/`; never silent prod resets.
- Changing embedding dimensions requires reprocessing **all** stored vectors.

## Gemini

- Embeddings: hard-require `gemini-embedding-001`, `outputDimensionality: 3072`.
- Document task type `RETRIEVAL_DOCUMENT`; questions use `RETRIEVAL_QUERY`.
- Generation model via `GEMINI_GENERATION_MODEL` (default `gemini-2.5-flash`).
- Classify failures in `src/lib/errors/gemini.ts`; backoff with jitter; do not retry hard daily quota.
- Mock Gemini in unit/integration tests; do not burn quota in CI.

## PDF → chunks → citations

- Validate magic bytes + size server-side (`validate-pdf.ts`). Limits in `limits.ts`.
- Extract with `pdf-parse`; no OCR in MVP.
- Clean → chunk (~2000 chars, 300 overlap). Larger chunks reduce embedding calls; smaller improve locality.
- Persist `pending_chunks` JSON for resumable embedding after partial failure.
- Upsert chunks on `(document_id, chunk_key)` to stay idempotent.
- Citations must be filtered to retrieved `chunk_key`s only.

## API validation & errors

- Return `{ error, code, retryable }` (optional `document` on partial upload failure).
- Useful codes: `VALIDATION`, `PAYLOAD_TOO_LARGE`, `QUOTA_EXHAUSTED`, `NOT_FOUND`, etc.
- Log codes/stages server-side; never log full document text or secrets.

## UI / theme / a11y

- Soft pastel tokens in `globals.css`; light/dark via `next-themes` (`class` strategy).
- Brand-first landing (`HomeWorkspace`); document workspace (`QaWorkspace`).
- Keyboard-accessible theme control; `aria-live` for processing/errors; visible focus.
- Respect `prefers-reduced-motion`.
- Do not index `/documents/*` (robots + page metadata).

## Testing

- Vitest: `npm test` (alias `@` via `vitest.config.ts`).
- Cover validation, chunking, Gemini classification, citation filtering, schemas.
- Prefer mocked network for Gemini/Supabase in automated tests.

## Security & privacy

- Public-demo model: possession of UUID grants ask access—state this in UI/docs.
- Rate-limit uploads/questions by hashed IP.
- Enforce global chunk cap before expensive embedding.
- No client-side secret keys; PDF not stored after processing in current MVP.

## Performance & deploy

- Keep heavy libs server-external (`pdf-parse`).
- Upload/ask/retry `maxDuration = 60` — document Vercel limits honestly.
- Production checklist in `README.md` / `PLAN.md`.
