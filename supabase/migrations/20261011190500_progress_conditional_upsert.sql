-- Conditional upsert so a background push can never silently clobber another device.
--
-- Plain last-write-wins at the HTTP layer only protects the boot-time case: if device B
-- writes while device A is open and studying, A's next debounced save would overwrite B
-- with no prompt. This makes the write conditional on the caller having seen the current
-- row, so the loser of a race is told about it instead of winning by accident.
--
-- security invoker (the default, stated for clarity) so the RLS policies from migration
-- 20261011184000 still apply to every statement inside -- this function escalates nothing.
create function public.upsert_progress(
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
  v_cur timestamptz;
  v_new timestamptz;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select p.updated_at into v_cur from public.progress p where p.user_id = v_uid;

  if v_cur is null then
    -- No row yet: first upload. p_expected is irrelevant because there is nothing to lose.
    insert into public.progress as p (user_id, app, version, data)
    values (v_uid, p_app, p_version, p_data)
    returning p.updated_at into v_new;
    return query select true, v_new;
    return;
  end if;

  if p_expected is not null and v_cur = p_expected then
    -- Caller has seen the current row, so nothing has changed behind its back.
    update public.progress p
       set app = p_app, version = p_version, data = p_data
     where p.user_id = v_uid
    returning p.updated_at into v_new;
    return query select true, v_new;
    return;
  end if;

  -- Diverged: someone else wrote since this device last synced. Refuse and report the
  -- timestamp that is actually there, so the client can show both last-modified dates.
  return query select false, v_cur;
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default; undo that and allow only signed-in users.
revoke all on function public.upsert_progress(text, integer, jsonb, timestamptz) from public, anon;
grant execute on function public.upsert_progress(text, integer, jsonb, timestamptz) to authenticated;
