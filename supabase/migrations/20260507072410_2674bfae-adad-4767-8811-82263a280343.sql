ALTER TABLE public.compete_questions
  ADD COLUMN IF NOT EXISTS target_exam TEXT,
  ADD COLUMN IF NOT EXISTS class_level TEXT;
CREATE INDEX IF NOT EXISTS idx_compete_questions_target_exam ON public.compete_questions(target_exam);
CREATE INDEX IF NOT EXISTS idx_compete_questions_class_level ON public.compete_questions(class_level);
CREATE INDEX IF NOT EXISTS idx_compete_questions_subject ON public.compete_questions(subject);
CREATE INDEX IF NOT EXISTS idx_compete_questions_difficulty ON public.compete_questions(difficulty);