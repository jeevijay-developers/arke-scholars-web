-- Fix RLS on papers and questions tables so admin/super_admin users can insert rows.
-- The original migration (20260516000002) may not have been applied to the live DB,
-- or the policies were dropped. This migration is idempotent: it drops and recreates.

-- Ensure RLS is enabled
ALTER TABLE public.papers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if present (so we can recreate cleanly)
DROP POLICY IF EXISTS "papers_service_all"   ON public.papers;
DROP POLICY IF EXISTS "papers_auth_all"      ON public.papers;
DROP POLICY IF EXISTS "questions_service_all" ON public.questions;
DROP POLICY IF EXISTS "questions_auth_all"   ON public.questions;

-- Service role: full access (used by edge functions like parse-docx)
CREATE POLICY "papers_service_all"
  ON public.papers FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "questions_service_all"
  ON public.questions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Authenticated users: full access
-- Admin routes are already guarded by ProtectedAdminRoute on the frontend.
CREATE POLICY "papers_auth_all"
  ON public.papers FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "questions_auth_all"
  ON public.questions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
