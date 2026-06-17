-- PENDING REVIEW — not yet applied to the database.
-- Auto-deletes abandoned phone-OTP signups (auth.users that requested an OTP but
-- never verified it, never signed in, have no email, older than 24h). Deleting from
-- auth.users cascades to profiles and user_roles. Apply only after explicit sign-off,
-- since it schedules a recurring mass-deletion of accounts.

CREATE OR REPLACE FUNCTION public.cleanup_stale_unverified_signups()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  deleted_count integer;
BEGIN
  WITH del AS (
    DELETE FROM auth.users u
    WHERE u.phone IS NOT NULL
      AND u.email IS NULL
      AND u.phone_confirmed_at IS NULL
      AND u.last_sign_in_at IS NULL
      AND u.created_at < now() - interval '24 hours'
    RETURNING u.id
  )
  SELECT count(*) INTO deleted_count FROM del;
  RETURN deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_unverified_signups() FROM PUBLIC, anon, authenticated;

-- Run daily at 02:00 UTC.
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-stale-unverified-signups');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-stale-unverified-signups',
  '0 2 * * *',
  $$SELECT public.cleanup_stale_unverified_signups();$$
);
