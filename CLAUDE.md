# AskItUp — Agent Instructions

Product: **AskItUp** — *Ask your documents. Find the answers.*

This file is the concise operating manual for coding agents. Deeper conventions live in `SKILLS.md`. Status and backlog live in `PLAN.md`. Human setup lives in `README.md`. Next.js version-specific notes are in `AGENTS.md`.

## Stack

- Next.js App Router (see `AGENTS.md` before assuming older Next APIs)
- React + strict TypeScript
- Tailwind CSS v4
- Google Gemini (`@google/genai`) — embeddings **must** use `gemini-embedding-001` (3072 dims)
- Supabase Postgres + pgvector via **server-only** service-role client
- Zod validation, Vitest tests, Vercel deploy target

## Architecture (short)

1. `POST /api/documents/upload` — validate PDF → extract → chunk → persist document + `pending_chunks` → embed in batches → store `document_chunks` → status `ready`
2. `GET /api/documents/[documentId]` / `/documents/[documentId]` — reopen by UUID (no re-embed)
3. `POST /api/documents/ask` — embed question → `match_document_chunks` RPC → Gemini grounded JSON answer → filter citations
4. `POST /api/documents/[documentId]/retry` — resume missing embeddings from `pending_chunks`

Shared limits and budgets: `src/lib/config/limits.ts` + Supabase RPCs in `supabase/migrations/`.

## Critical rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `GEMINI_API_KEY` to the client (`NEXT_PUBLIC_*` forbidden for secrets).
- Keep embedding model `gemini-embedding-001` and dimension **3072**. Do not mix embedding spaces.
- A document UUID is an identifier, not auth. This MVP is a **public-demo** access model.
- Do not delete successfully stored chunks because a later batch failed; mark `failed` and allow retry.
- Do not return raw Gemini/Supabase errors to the browser; use `AppError` + `jsonError`.
- Treat PDF text as untrusted (prompt-injection resistant prompts only).
- Prefer incremental fixes over rewrites. Update README/PLAN/CLAUDE/SKILLS when behavior changes.
- No destructive Supabase resets, credential rotation, or production deploys without explicit approval.

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Environment

See `.env.example`. Required: `GEMINI_API_KEY`, `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`, `GEMINI_GENERATION_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`.

## Database

Apply `supabase/migrations/001_askitup_schema.sql` (fresh) or `002_upgrade_existing.sql` + RPC sections from `001` (existing). Do not invent alternate retrieval RPCs if `match_document_chunks` works.

## Security / ops

- Anonymous demo: rate limits + shared chunk/Gemini budgets are mandatory abuse controls.
- Document routes and `/api/*` are `no-store` (via `src/proxy.ts` + API headers).
- Vercel `maxDuration` for upload/ask/retry is 60s — large PDFs may still hit platform limits; resumability mitigates partial failure.
- Next.js 16 uses `proxy.ts` (not deprecated `middleware.ts`) and `cacheComponents`; avoid incompatible route segment configs (`runtime`, `dynamic`).
