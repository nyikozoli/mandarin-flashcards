-- Refuse uploads from a copy of the app that is older than the stored progress.
--
-- progress.version holds the snapshot format. Format 2 adds per-skill progress (`skills`). A cached
-- format-1 copy (an installed phone app that has not picked up the update) would upload a snapshot
-- without `skills` and wipe recall and listening progress. upsert_progress now refuses any write whose
-- p_version is lower than the stored one, with a message telling the user to reload. A write at the
-- same or a newer format works as before, and a successful write stores its own version.
--
-- Same signature, return type and security model as 20261011210000.

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
  -- A copy of the app older than the stored data would drop the parts it does not know.
  if p_version < coalesce((select p.version from public.progress p where p.user_id = v_uid), 0) then
    raise exception 'This copy of the app is out of date. Reload it to get the update, then sync again.' using errcode = 'P0001';
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
