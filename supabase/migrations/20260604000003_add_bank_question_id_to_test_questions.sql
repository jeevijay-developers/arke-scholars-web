-- Link each test_question back to the reusable question_bank entry it was sourced from.
-- NULL = question was created directly (not via the bank).
ALTER TABLE public.test_questions
  ADD COLUMN IF NOT EXISTS bank_question_id uuid
  REFERENCES public.question_bank(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_test_questions_bank ON public.test_questions(bank_question_id)
  WHERE bank_question_id IS NOT NULL;
