ALTER TABLE public.compete_matches
  ADD COLUMN IF NOT EXISTS current_question_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS countdown_until TIMESTAMPTZ;