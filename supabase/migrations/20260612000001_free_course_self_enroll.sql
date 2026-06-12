-- Free-course auto-assignment support.
--
-- Students are auto-enrolled (client-side) into free courses that match their
-- profile's target_exam + class_level. The INSERT below previously allowed a
-- student to self-insert an enrollment for ANY course (auth.uid() = user_id),
-- which would let a client grant itself free access to a PAID course.
--
-- Tighten the self-insert policy so a student may only create their own
-- enrollment when the target course is free + active. Staff (admin /
-- super_admin) keep the ability to self-insert into any course (used by the
-- "staff demo enroll" path). The Razorpay verify-payment edge function inserts
-- with the service role and bypasses RLS, so paid enrollments are unaffected.

drop policy if exists "Users can create their own enrollments" on public.enrollments;

create policy "Users can create their own enrollments"
  on public.enrollments
  for insert
  with check (
    auth.uid() = user_id
    and (
      has_role(auth.uid(), 'admin'::app_role)
      or has_role(auth.uid(), 'super_admin'::app_role)
      or exists (
        select 1
        from public.courses c
        where c.id = enrollments.course_id
          and c.is_course_free = true
          and c.is_active = true
      )
    )
  );
