-- Progress sync for the Mandarin HSK flashcards app.
-- One row per user holding the whole transferable progress snapshot as jsonb.
-- The payload is progressSnapshot() minus the DEVICE_ONLY keys (voice, badVoices,
-- voicesTested, warmup) -- the same shape exportText() already produces.
-- Measured worst case (all 598 words known plus a year of activity) is ~46 KB.

create table public.progress (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  app        text not null default 'mandarin-hsk-flashcards',
  version    int  not null default 1,
  data       jsonb not null,
  updated_at timestamptz not null default now(),

  -- Mirrors what parseImport() enforces on the client: must be an object with a
  -- status map. Stops a buggy client from blanking a row into something unusable.
  constraint progress_shape check (jsonb_typeof(data) = 'object' and data ? 'status'),
  -- 1 MB ceiling against a ~46 KB worst case.
  constraint progress_size  check (octet_length(data::text) < 1048576)
);

comment on table public.progress is
  'Per-user flashcard progress snapshot. Whole-blob last-write-wins; updated_at is the tiebreaker.';
comment on column public.progress.version is
  'Snapshot format version, promoted out of the jsonb so format changes are queryable.';

-- updated_at is the last-write-wins tiebreaker between devices, so it must come
-- from one clock. Set here, never trusted from the client.
create function public.progress_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger progress_touch_updated_at
  before insert or update on public.progress
  for each row
  execute function public.progress_touch_updated_at();

alter table public.progress enable row level security;
alter table public.progress force row level security;

-- (select auth.uid()) rather than bare auth.uid(): the wrapped form is evaluated
-- once per query instead of per row. Immaterial at one PK-indexed row per user,
-- but free and correct.
--
-- Every policy is `to authenticated` and there is deliberately no `anon` policy:
-- the anon key ships inside a public static bundle, so RLS is the only thing
-- standing between the internet and this data.
create policy progress_select_own on public.progress
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy progress_insert_own on public.progress
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- update needs both clauses: `using` gates which existing row may be touched,
-- `with check` gates the new value. Without the latter a user could reassign user_id.
create policy progress_update_own on public.progress
  for update to authenticated
  using      ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy progress_delete_own on public.progress
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Grants are necessary but not sufficient; RLS applies on top.
revoke all on public.progress from public, anon;
grant select, insert, update, delete on public.progress to authenticated;
