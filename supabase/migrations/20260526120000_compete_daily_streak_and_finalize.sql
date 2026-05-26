-- Track the last calendar date (UTC) when the user played, for daily streak calculation
ALTER TABLE public.compete_ratings
  ADD COLUMN IF NOT EXISTS last_streak_date date;

-- Atomic match finalization lock.
-- Returns TRUE if this call successfully claimed finalization (status active→finishing).
-- Returns FALSE if another concurrent call already claimed it.
CREATE OR REPLACE FUNCTION public.try_finalize_match(p_match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE compete_matches
  SET status = 'finishing'
  WHERE id = p_match_id AND status = 'active';
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$$;
