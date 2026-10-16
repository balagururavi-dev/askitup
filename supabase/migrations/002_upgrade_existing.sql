-- Upgrade helper for AskItUp databases that already have documents/document_chunks.
-- Review before running in the Supabase SQL editor. Does not drop data.
-- After this file, also ensure the RPCs from 001_askitup_schema.sql exist
-- (reserve_chunk_capacity, reserve_gemini_budget, check_rate_limit, match_document_chunks).

create extension if not exists vector;
create extension if not exists pgcrypto;

alter table public.documents
  add column if not exists status text,
  add column if not exists stage text,
  add column if not exists chunk_count integer,
  add column if not exists completed_chunks integer,
  add column if not exists pending_chunks jsonb,
  add column if not exists error_code text,
  add column if not exists error_message text,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.documents
set
  status = coalesce(status, 'ready'),
  stage = coalesce(stage, 'ready'),
  chunk_count = coalesce(chunk_count, 0),
  completed_chunks = coalesce(completed_chunks, 0),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now());

alter table public.documents
  alter column status set default 'queued',
  alter column stage set default 'queued',
  alter column chunk_count set default 0,
  alter column completed_chunks set default 0,
  alter column created_at set default now(),
  alter column updated_at set default now();

alter table public.documents
  alter column status set not null,
  alter column stage set not null,
  alter column chunk_count set not null,
  alter column completed_chunks set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documents_status_check'
  ) then
    alter table public.documents
      add constraint documents_status_check
      check (status in ('queued', 'processing', 'ready', 'failed'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'documents_stage_check'
  ) then
    alter table public.documents
      add constraint documents_stage_check
      check (stage in ('queued', 'extracting', 'chunking', 'embedding', 'storing', 'ready', 'failed'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'document_chunks_document_id_chunk_key_key'
  ) then
    alter table public.document_chunks
      add constraint document_chunks_document_id_chunk_key_key
      unique (document_id, chunk_key);
  end if;
exception
  when duplicate_object then null;
  when unique_violation then null;
end $$;

update public.documents d
set
  chunk_count = greatest(d.chunk_count, c.cnt),
  completed_chunks = greatest(d.completed_chunks, c.cnt),
  status = case when c.cnt > 0 then 'ready' else d.status end,
  stage = case when c.cnt > 0 then 'ready' else d.stage end
from (
  select document_id, count(*)::integer as cnt
  from public.document_chunks
  group by document_id
) c
where d.id = c.document_id;

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
