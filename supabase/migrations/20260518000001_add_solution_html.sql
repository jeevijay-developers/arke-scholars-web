ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS solution_html text,
  ADD COLUMN IF NOT EXISTS match_answer  text;
