---
description: AskItUp product and architecture constraints
globs:
  - src/**/*
  - supabase/**/*
---

# AskItUp rules

- Embedding model must remain `gemini-embedding-001` with 3072 dimensions.
- Never expose service-role or Gemini keys to the client.
- Prefer incremental changes; reuse working PDF/chunk/RAG code.
- Document UUID ≠ authentication (public-demo model unless auth is added).
- Use `AppError` for API failures; no raw provider/DB errors to the browser.
- Update README.md / PLAN.md / CLAUDE.md / SKILLS.md when behavior changes.
- Do not add back `test-*` debug API routes.
