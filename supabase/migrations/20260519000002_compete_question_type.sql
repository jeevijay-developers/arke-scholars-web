-- Add question_type to compete_questions for the universal schema editor.
-- The compete game engine still uses options (text[]) and correct_index (int)
-- for SCQ questions; question_type records the intended type for display/editing.
ALTER TABLE public.compete_questions
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'scq';
