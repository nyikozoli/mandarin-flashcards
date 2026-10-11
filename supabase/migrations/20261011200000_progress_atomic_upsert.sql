-- Make upsert_progress a true compare-and-set.
--
-- The version in 20261011190500 read updated_at and then wrote in a separate statement. Two
-- devices holding the same expected timestamp could both pass the check, and the later write
-- won silently. Two first uploads raced the other way: both saw no row, the second insert hit
-- the primary key and surfaced as "Sync failed" instead of a conflict.
--
-- Now each write is a single conditional statement:
--   * first upload: INSERT ... ON CONFLICT DO NOTHING, so a concurrent first upload simply
--     does not apply and the caller gets the conflict path;
--   * later uploads: UPDATE ... WHERE updated_at = p_expected. Under READ COMMITTED the second
--     of two concurrent updates waits for the first, re-checks the WHERE against the new row,
--     finds updated_at has moved, and updates nothing.
--
-- Same signature, return type and security model (security invoker, RLS applies, auth.uid()
-- instead of a client-supplied id), so the client needs no change.
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

  -- First upload. Does nothing if a row exists, including one inserted a moment ago by
  -- another device.
  insert into public.progress as p (user_id, app, version, data)
  values (v_uid, p_app, p_version, p_data)
  on conflict (user_id) do nothing
  returning p.updated_at into v_new;

  if v_new is not null then
    return query select true, v_new;
    return;
  end if;

  -- Existing row: write only if it is still the one the caller last saw.
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

  -- Diverged: report the timestamp that is actually there, so the client can show both copies.
  select p.updated_at into v_cur from public.progress p where p.user_id = v_uid;
  return query select false, v_cur;
end;
$$;

-- create or replace keeps existing privileges; restated so the end state is unambiguous.
revoke all on function public.upsert_progress(text, integer, jsonb, timestamptz) from public, anon;
grant execute on function public.upsert_progress(text, integer, jsonb, timestamptz) to authenticated;
