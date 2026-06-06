-- Phase 5 · V7: Fix mutable search_path on SECURITY DEFINER functions.
-- ALTER FUNCTION ... SET search_path = public prevents search-path
-- hijacking attacks without requiring a full function rewrite.
-- Fixes the 12 functions flagged by the Supabase security advisor.

ALTER FUNCTION public.enqueue_email              SET search_path = public;
ALTER FUNCTION public.read_email_batch           SET search_path = public;
ALTER FUNCTION public.delete_email               SET search_path = public;
ALTER FUNCTION public.move_to_dlq                SET search_path = public;
ALTER FUNCTION public.get_course_enrolled_count  SET search_path = public;
ALTER FUNCTION public.finalize_match             SET search_path = public;
ALTER FUNCTION public.try_claim_opponent         SET search_path = public;
ALTER FUNCTION public.increment_player1_score    SET search_path = public;
ALTER FUNCTION public.increment_player2_score    SET search_path = public;
ALTER FUNCTION public.increment_player1_answers  SET search_path = public;
ALTER FUNCTION public.increment_player2_answers  SET search_path = public;
ALTER FUNCTION public.update_compete_ratings_updated_at SET search_path = public;
