CREATE TABLE public.course_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, user_id)
);

CREATE INDEX idx_course_reviews_course ON public.course_reviews(course_id, created_at DESC);

ALTER TABLE public.course_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews are viewable by everyone"
  ON public.course_reviews FOR SELECT USING (true);

CREATE POLICY "Enrolled users can create their reviews"
  ON public.course_reviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = auth.uid() AND e.course_id = course_reviews.course_id AND e.is_active = true
    )
  );

CREATE POLICY "Users can update their own review"
  ON public.course_reviews FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own review"
  ON public.course_reviews FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_course_reviews_updated_at
  BEFORE UPDATE ON public.course_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to keep courses.rating in sync with average review rating
CREATE OR REPLACE FUNCTION public.refresh_course_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid;
  avg_rating numeric;
BEGIN
  cid := COALESCE(NEW.course_id, OLD.course_id);
  SELECT ROUND(AVG(rating)::numeric, 2) INTO avg_rating
  FROM public.course_reviews WHERE course_id = cid;
  UPDATE public.courses SET rating = COALESCE(avg_rating, 0), updated_at = now() WHERE id = cid;
  RETURN NULL;
END;
$$;

CREATE TRIGGER course_reviews_refresh_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.course_reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_course_rating();