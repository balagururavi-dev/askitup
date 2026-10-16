# AskItUp Implementation Plan

Last updated: 2026-10-16

## Current architecture

Next.js App Router MVP with:

- PDF upload → extract/clean/chunk → Gemini embeddings (`gemini-embedding-001`, 3072-d) → Supabase `documents` / `document_chunks`
- Question answering via `match_document_chunks` + Gemini grounded JSON answers
- Document reopen by UUID (`/documents/[documentId]` + GET API)
- Shared usage budgets / rate limits (DB RPCs + app fallbacks)
- Soft pastel light/dark UI with theme toggle

## Completed (verified in this pass unless noted)

| Item | Status |
|------|--------|
| Repository audit + baseline tooling | Verified earlier; re-run at end of pass |
| Central limits module | Implemented |
| Typed `AppError` + Gemini classification/retry | Implemented |
| PDF validation (magic bytes, size, encrypted heuristic) | Implemented + unit tests |
| Upload lifecycle with `pending_chunks` + resumable retry | Implemented |
| Ask flow with similarity filter + citation allow-list | Implemented |
| Document GET + retry APIs | Implemented |
| Remove `test-*` debug API routes + agent debug logs | Implemented |
| Public-demo privacy copy + robots disallow for documents | Implemented |
| Theme system (light/dark/system) | Implemented |
| `.env.example`, SQL migrations, CLAUDE/SKILLS/PLAN/README | Implemented |
| Unit tests expansion | Implemented (run results recorded below after verification) |

## Outstanding / priorities

1. **P0 — Apply Supabase migrations** on the real project (manual): run `001` or `002` + RPCs. Until then, budget/rate RPCs fall back softly; new status columns required for full lifecycle.
2. **P0 — Confirm generation model** in `.env.local` matches a model enabled on the Gemini project.
3. **P1 — End-to-end browser test** against live Supabase/Gemini (upload → copy ID → reopen → ask → unsupported question).
4. **P1 — Integration tests** with mocked Supabase client for capacity reservation + upsert idempotency.
5. **P2 — Document deletion UI** with confirmation (service-role delete by UUID is possible but not productized).
6. **P2 — Background processing** if Vercel timeouts become common (currently synchronous ≤60s with resume).
7. **P2 — Auth / private documents** if leaving public-demo model.

## Known limitations & debt

- Anonymous UUID access ≠ privacy.
- Free Gemini quota can pause the whole shared demo; budgets are conservative, not guarantees.
- No OCR for scanned/image-only PDFs.
- Original PDF bytes are not stored; resume relies on `pending_chunks`.
- Synchronous processing may hit Vercel execution limits on dense PDFs.
- No automated E2E suite wired to CI yet.
- `@supabase/ssr` removed (unused); only service-role server access remains.

## Reliability / security / performance work

- Atomic chunk capacity + Gemini daily budget RPCs (require migration apply).
- IP-hashed rate limits for upload/ask.
- Security headers middleware; `no-store` on document/API paths.
- Embedding dimension hard-check (3072).
- Prompt treats document text as untrusted.

## Deployment readiness

- Scripts: `dev`, `lint`, `typecheck`, `test`, `build`
- Needs: env vars, Supabase SQL, Gemini quota awareness, `NEXT_PUBLIC_SITE_URL`
- Do **not** mark production-ready until migrations are applied and an E2E upload/ask succeeds on the target environment.

## Verification log

| Check | Result | Notes |
|-------|--------|-------|
| `npm run lint` | PASS | 2026-10-16 |
| `npm run typecheck` | PASS | 2026-10-16 |
| `npm test` | PASS | 8 files / 18 tests |
| `npm run build` | PASS | Next 16.4.1; document route partial prerender |
| Live upload/ask E2E | Not run in this agent pass | Requires Supabase migration apply + Gemini quota |
