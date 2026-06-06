-- Add class_level to tests so admins can target tests at a specific grade.
-- Supported values: 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12', '12 Pass'
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS class_level text;

CREATE INDEX IF NOT EXISTS idx_tests_class_level ON public.tests(class_level);
