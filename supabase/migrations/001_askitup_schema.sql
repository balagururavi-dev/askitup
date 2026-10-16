-- AskItUp schema: documents, chunks, vector search, usage controls
-- Safe to run on a fresh project. For existing DBs, prefer 002_upgrade_*.sql.

create extension if not exists vector;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  total_pages integer not null check (total_pages >= 0),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'ready', 'failed')),
  stage text not null default 'queued'
    check (stage in ('queued', 'extracting', 'chunking', 'embedding', 'storing', 'ready', 'failed')),
  chunk_count integer not null default 0 check (chunk_count >= 0),
  completed_chunks integer not null default 0 check (completed_chunks >= 0),
  pending_chunks jsonb,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists documents_status_idx on public.documents (status);
create index if not exists documents_created_at_idx on public.documents (created_at desc);

-- ---------------------------------------------------------------------------
-- Chunks + embeddings (gemini-embedding-001 => 3072 dims)
-- ---------------------------------------------------------------------------
create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_key text not null,
  page_number integer not null check (page_number >= 1),
  content text not null,
  embedding extensions.vector(3072) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_key)
);

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);

-- Optional IVFFlat / HNSW indexes can be added later once row counts justify them.

-- ---------------------------------------------------------------------------
-- Semantic retrieval RPC (document-scoped)
-- ---------------------------------------------------------------------------
create or replace function public.match_document_chunks(
  query_embedding extensions.vector(3072),
  target_document_id uuid,
  match_count integer default 5
)
returns table (
  chunk_id uuid,
  chunk_key text,
  page_number integer,
  content text,
  similarity double precision
)
language sql
stable
as $$
  select
    dc.id as chunk_id,
    dc.chunk_key,
    dc.page_number,
    dc.content,
    (1 - (dc.embedding <=> query_embedding))::double precision as similarity
  from public.document_chunks dc
  where dc.document_id = target_document_id
  order by dc.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

-- ---------------------------------------------------------------------------
-- Shared usage accounting
-- ---------------------------------------------------------------------------
create table if not exists public.usage_daily (
  day date primary key,
  units_used integer not null default 0 check (units_used >= 0),
  updated_at timestamptz not null default now()
);

create table if not exists public.rate_limit_buckets (
  client_key text not null,
  action text not null,
  window_start timestamptz not null,
  count integer not null default 0 check (count >= 0),
  primary key (client_key, action, window_start)
);

create table if not exists public.chunk_capacity_lock (
  id integer primary key check (id = 1),
  note text not null default 'singleton row for advisory capacity checks'
);

insert into public.chunk_capacity_lock (id)
values (1)
on conflict (id) do nothing;

create or replace function public.reserve_chunk_capacity(
  p_needed integer,
  p_max_chunks integer
)
returns table (allowed boolean, current_count integer, remaining integer)
language plpgsql
as $$
declare
  v_count integer;
begin
  if p_needed is null or p_needed <= 0 then
    return query select false, 0, 0;
    return;
  end if;

  -- Serialize capacity checks across concurrent uploads.
  perform 1 from public.chunk_capacity_lock where id = 1 for update;

  select count(*)::integer into v_count from public.document_chunks;

  if v_count + p_needed > p_max_chunks then
    return query select false, v_count, greatest(p_max_chunks - v_count, 0);
    return;
  end if;

  return query select true, v_count, p_max_chunks - v_count - p_needed;
end;
$$;

create or replace function public.reserve_gemini_budget(
  p_day date,
  p_units integer,
  p_max_units integer
)
returns table (allowed boolean, reservation_id uuid, remaining integer)
language plpgsql
as $$
declare
  v_used integer;
  v_id uuid := gen_random_uuid();
begin
  if p_units is null or p_units <= 0 then
    return query select false, v_id, 0;
    return;
  end if;

  insert into public.usage_daily (day, units_used)
  values (p_day, 0)
  on conflict (day) do nothing;

  select units_used into v_used
  from public.usage_daily
  where day = p_day
  for update;

  if v_used + p_units > p_max_units then
    return query select false, v_id, greatest(p_max_units - v_used, 0);
    return;
  end if;

  update public.usage_daily
  set units_used = v_used + p_units,
      updated_at = now()
  where day = p_day;

  return query select true, v_id, p_max_units - v_used - p_units;
end;
$$;

create or replace function public.check_rate_limit(
  p_client_key text,
  p_action text,
  p_limit integer,
  p_window_seconds integer default 3600
)
returns table (allowed boolean, current_count integer)
language plpgsql
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_buckets (client_key, action, window_start, count)
  values (p_client_key, p_action, v_window_start, 1)
  on conflict (client_key, action, window_start)
  do update set count = public.rate_limit_buckets.count + 1
  returning count into v_count;

  return query select (v_count <= p_limit), v_count;
end;
$$;

-- Anonymous public-demo model: no RLS policies that grant anon access.
-- The Next.js server uses the service role key exclusively.
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.usage_daily enable row level security;
alter table public.rate_limit_buckets enable row level security;
