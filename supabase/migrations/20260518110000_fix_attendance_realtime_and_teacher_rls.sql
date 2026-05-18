-- 1. Add live_class_attendance to realtime publication so teacher dashboard
--    receives INSERT/UPDATE events when students join.
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_class_attendance;

-- REPLICA IDENTITY FULL lets Supabase send the full OLD row on UPDATE/DELETE,
-- which is required for postgres_changes subscriptions with filters.
ALTER TABLE public.live_class_attendance REPLICA IDENTITY FULL;

-- 2. Allow teachers to SELECT attendance rows for classes they own.
--    Previously only staff/admin could read all rows; teachers saw 0 attendees.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_class_attendance'
      AND policyname = 'Teachers view attendance for their classes'
  ) THEN
    CREATE POLICY "Teachers view attendance for their classes"
      ON public.live_class_attendance FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.live_classes lc
          WHERE lc.id = class_id
            AND lc.created_by = auth.uid()
        )
      );
  END IF;
END $$;
