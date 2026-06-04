-- Null out orphaned test_ids (pointing to deleted tests) so the FK can be added.
UPDATE public.test_attempts
SET test_id = NULL
WHERE test_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.tests t WHERE t.id = test_attempts.test_id);

-- Add FK so PostgREST resolves the tests() join used by the analytics page.
-- ON DELETE SET NULL: deleting a test leaves the attempt intact with test_id = NULL.
ALTER TABLE public.test_attempts
  ADD CONSTRAINT test_attempts_test_id_fkey
  FOREIGN KEY (test_id) REFERENCES public.tests(id) ON DELETE SET NULL;
