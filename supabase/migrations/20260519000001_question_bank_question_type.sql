-- Unify question_bank with the rest of the question pipeline by giving it the
-- same question_type column that tests / test_questions / parse-docx already use.
-- Existing rows default to 'scq' which matches the legacy BankQuestion shape.
ALTER TABLE public.question_bank
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'scq';
