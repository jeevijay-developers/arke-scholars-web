-- Backfill: copy all existing test_questions into question_bank and
-- link them back via bank_question_id. Questions already linked are skipped.

CREATE TEMP TABLE _tq_bank_map AS
SELECT
  tq.id                                         AS tq_id,
  gen_random_uuid()                             AS bank_id,
  COALESCE(t.created_by, auth.uid())            AS created_by,
  COALESCE(NULLIF(tq.subject, ''), 'General')  AS subject,
  tq.topic,
  COALESCE(tq.difficulty, 'medium')             AS difficulty,
  CASE
    WHEN tq.question_type = 'mcq-single' THEN 'scq'
    ELSE COALESCE(tq.question_type, 'scq')
  END                                           AS question_type,
  tq.question_text,
  tq.question_image_url,
  tq.options,
  tq.correct_answer,
  tq.explanation,
  COALESCE(tq.marks_correct, 4)                AS marks_correct,
  COALESCE(tq.marks_wrong, -1)                 AS marks_wrong
FROM public.test_questions tq
JOIN public.tests t ON t.id = tq.test_id
WHERE tq.bank_question_id IS NULL;

INSERT INTO public.question_bank (
  id, created_by, subject, topic, difficulty, question_type,
  question_text, question_image_url, options, correct_answer,
  explanation, marks_correct, marks_wrong, tags, is_public
)
SELECT
  bank_id, created_by, subject, topic, difficulty, question_type,
  question_text, question_image_url, options, correct_answer,
  explanation, marks_correct, marks_wrong, '{}'::text[], true
FROM _tq_bank_map;

UPDATE public.test_questions tq
SET bank_question_id = m.bank_id
FROM _tq_bank_map m
WHERE tq.id = m.tq_id;

DROP TABLE _tq_bank_map;
