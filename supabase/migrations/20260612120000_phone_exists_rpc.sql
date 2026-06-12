-- Pre-signup duplicate check.
--
-- The signup flow needs to tell, BEFORE sending an OTP, whether a phone number
-- already belongs to an account. profiles RLS only lets a user read their own
-- row (or staff/teacher/mentor read others), so an anonymous signup visitor
-- cannot query profiles directly. This security-definer function exposes only a
-- boolean (exists / not) — no profile data leaks — and is callable by anon.
--
-- Matches on the last 10 digits so the check is robust to how phone was stored.
-- profiles.phone is inconsistent across signup paths (bare "9352443837",
-- "919352443837", or "+919352443837"); normalising to trailing 10 digits makes
-- all of them match the same person regardless of caller format.

create or replace function public.phone_exists(p_phone text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where right(regexp_replace(phone, '\D', '', 'g'), 10)
        = right(regexp_replace(p_phone, '\D', '', 'g'), 10)
      and length(regexp_replace(p_phone, '\D', '', 'g')) >= 10
  );
$$;

revoke all on function public.phone_exists(text) from public;
grant execute on function public.phone_exists(text) to anon, authenticated;
