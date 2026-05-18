-- Teachers need to read attendance rows for their own classes so the
-- attendee list on the teacher live-class room page is populated correctly.
-- Previously only staff/admin could SELECT attendance; teachers got 0 rows.

CREATE POLICY "Teachers view attendance for their classes"
  ON public.live_class_attendance FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.live_classes lc
      WHERE lc.id = class_id
        AND lc.created_by = auth.uid()
    )
  );

-- Also allow teachers to read live_class_messages for their classes
-- (in case they were restricted — belt-and-suspenders).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'live_class_messages'
      AND policyname = 'Teachers view messages for their classes'
  ) THEN
    CREATE POLICY "Teachers view messages for their classes"
      ON public.live_class_messages FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.live_classes lc
          WHERE lc.id = class_id
            AND lc.created_by = auth.uid()
        )
      );
  END IF;
END $$;
