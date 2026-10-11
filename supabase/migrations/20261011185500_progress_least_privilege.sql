-- Least-privilege fix for public.progress.
--
-- Supabase's default privileges grant ALL on newly created public tables to the
-- `authenticated` role. That happens at CREATE TABLE time, i.e. before migration
-- 20261011184000's explicit GRANT ran, so TRUNCATE, TRIGGER and REFERENCES leaked
-- through and the later narrow GRANT did not remove them.
--
-- TRUNCATE is the one that matters: RLS policies do NOT filter TRUNCATE, so any
-- authenticated role holding it could wipe every user's row regardless of the
-- user_id policies. PostgREST exposes no HTTP verb for TRUNCATE, so this is latent
-- rather than live -- but it is unnecessary surface and should not be there.
-- TRIGGER and REFERENCES both require DDL, which the anon/authenticated roles
-- cannot issue through PostgREST either.

revoke truncate, trigger, references on public.progress from authenticated;

-- Idempotent restatement of the intended grant, so the end state is unambiguous.
grant select, insert, update, delete on public.progress to authenticated;
