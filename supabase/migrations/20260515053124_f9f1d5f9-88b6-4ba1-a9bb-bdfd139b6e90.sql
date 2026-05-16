
CREATE TABLE public.mentor_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mentor_id UUID NOT NULL,
  student_id UUID NOT NULL,
  rating INTEGER NOT NULL,
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT mentor_reviews_rating_range CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT mentor_reviews_unique_student_mentor UNIQUE (mentor_id, student_id)
);

CREATE INDEX idx_mentor_reviews_mentor ON public.mentor_reviews(mentor_id);
CREATE INDEX idx_mentor_reviews_student ON public.mentor_reviews(student_id);

ALTER TABLE public.mentor_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view mentor reviews"
ON public.mentor_reviews FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Students insert own review for assigned mentor"
ON public.mentor_reviews FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = student_id
  AND EXISTS (
    SELECT 1 FROM public.mentor_student_assignments a
    WHERE a.mentor_id = mentor_reviews.mentor_id
      AND a.student_id = auth.uid()
      AND a.removed_at IS NULL
  )
);

CREATE POLICY "Students update own review"
ON public.mentor_reviews FOR UPDATE TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students delete own review"
ON public.mentor_reviews FOR DELETE TO authenticated
USING (auth.uid() = student_id);

CREATE POLICY "Admins manage all mentor reviews"
ON public.mentor_reviews FOR ALL TO authenticated
USING (is_admin_or_super(auth.uid()))
WITH CHECK (is_admin_or_super(auth.uid()));

CREATE TRIGGER update_mentor_reviews_updated_at
BEFORE UPDATE ON public.mentor_reviews
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.mentor_reviews;
ALTER TABLE public.mentor_reviews REPLICA IDENTITY FULL;
