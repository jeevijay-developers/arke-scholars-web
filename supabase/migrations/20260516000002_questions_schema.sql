-- papers: one uploaded exam paper per row
CREATE TABLE public.papers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL,
  subject     text        NOT NULL,
  exam_date   date,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

-- question_type enum
DO $$ BEGIN
  CREATE TYPE public.question_type AS ENUM (
    'scq',
    'mcq',
    'integer',
    'match_column',
    'assertion_reasoning'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- questions: individual parsed questions belonging to a paper
CREATE TABLE public.questions (
  id              uuid                  PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id        uuid                  NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  question_number int,
  type            public.question_type  NOT NULL DEFAULT 'scq',
  stem_html       text,

  -- SCQ / MCQ
  option_1        text,
  option_2        text,
  option_3        text,
  option_4        text,
  correct_options int[],

  -- Integer type
  correct_integer numeric,

  -- Match the column
  match_col1      jsonb,   -- [{key: 'a', value: '...'}, ...]
  match_col2      jsonb,   -- [{key: 'P', value: '...'}, ...]

  -- Assertion-Reasoning
  assertion_text  text,
  reason_text     text,

  -- Metadata
  images          text[],
  has_latex       boolean NOT NULL DEFAULT false,
  needs_review    boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_questions_paper_id ON public.questions(paper_id);
CREATE INDEX idx_questions_type     ON public.questions(type);
CREATE INDEX idx_questions_needs_review ON public.questions(needs_review) WHERE needs_review = true;

-- RLS
ALTER TABLE public.papers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Service role: full access (used by edge functions)
CREATE POLICY "papers_service_all"
  ON public.papers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "questions_service_all"
  ON public.questions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users (admin routes are already guarded by ProtectedAdminRoute)
CREATE POLICY "papers_auth_all"
  ON public.papers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "questions_auth_all"
  ON public.questions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
