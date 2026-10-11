-- Limit cloud sync to an allow-list of accounts.
--
-- Closed sign-ups already stop new accounts. This is a second lock on the data itself: an
-- account that exists by mistake (re-opened sign-ups, an invite, an admin slip) still cannot
-- read or write progress unless its id is in public.sync_allowlist.
--
-- The list lives in the database rather than as literal ids in this file, so the public repo
-- carries no account identifiers. Add an account later from the SQL editor:
--   insert into public.sync_allowlist (user_id) values ('<auth.users id>');

create table public.sync_allowlist (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

comment on table public.sync_allowlist is
  'Accounts allowed to use cloud sync. Not reachable through the API; edit it from the SQL editor.';

-- No policies and no grants: anon and authenticated cannot see or change the list.
alter table public.sync_allowlist enable row level security;
revoke all on public.sync_allowlist from public, anon, authenticated;

-- security definer so the policies below can consult the list without the caller holding any
-- privilege on it. It answers only for the caller's own id and takes no arguments, so it
-- cannot be used to probe other accounts.
create function public.is_sync_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.sync_allowlist a where a.user_id = (select auth.uid()));
$$;

revoke all on function public.is_sync_user() from public, anon;
grant execute on function public.is_sync_user() to authenticated;

-- Restrictive: ANDed with the existing per-user policies, so a row needs both
-- "it is yours" and "you are on the list".
create policy progress_allowlisted on public.progress
  as restrictive
  for all to authenticated
  using ((select public.is_sync_user()))
  with check ((select public.is_sync_user()));

-- Same compare-and-set as 20261011200000, plus an early, readable refusal. Without it an
-- unlisted account would hit the row-level-security error (HTTP 403), which the client reads
-- as an expired session. P0001 surfaces as HTTP 400 with this message.
create or replace function public.upsert_progress(
  p_app      text,
  p_version  integer,
  p_data     jsonb,
  p_expected timestamptz
)
returns table(applied boolean, server_updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_new timestamptz;
  v_cur timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if not public.is_sync_user() then
    raise exception 'This account is not enabled for cloud sync.' using errcode = 'P0001';
  end if;

  insert into public.progress as p (user_id, app, version, data)
  values (v_uid, p_app, p_version, p_data)
  on conflict (user_id) do nothing
  returning p.updated_at into v_new;

  if v_new is not null then
    return query select true, v_new;
    return;
  end if;

  if p_expected is not null then
    update public.progress p
       set app = p_app, version = p_version, data = p_data
     where p.user_id = v_uid
       and p.updated_at = p_expected
    returning p.updated_at into v_new;

    if v_new is not null then
      return query select true, v_new;
      return;
    end if;
  end if;

  select p.updated_at into v_cur from public.progress p where p.user_id = v_uid;
  return query select false, v_cur;
end;
$$;

revoke all on function public.upsert_progress(text, integer, jsonb, timestamptz) from public, anon;
grant execute on function public.upsert_progress(text, integer, jsonb, timestamptz) to authenticated;

-- Enroll the accounts that have signed in at least once (sign-ups are closed, so these are the
-- intended users). Unconfirmed accounts, such as an address that requested a link and never
-- used it, stay off the list.
do $$
declare n int;
begin
  insert into public.sync_allowlist (user_id)
  select u.id from auth.users u where u.email_confirmed_at is not null
  on conflict do nothing;
  get diagnostics n = row_count;
  raise notice 'sync_allowlist: enrolled % account(s)', n;
end;
$$;
