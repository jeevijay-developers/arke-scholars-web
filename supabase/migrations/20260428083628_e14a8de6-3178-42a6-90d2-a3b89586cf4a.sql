-- =========================================
-- 1. ENQUIRIES
-- =========================================
CREATE TABLE public.enquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'contact' CHECK (source IN ('contact','admission','mentorship','other')),
  region TEXT CHECK (region IN ('india','dubai')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','resolved','closed')),
  assigned_to UUID,
  staff_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an enquiry"
  ON public.enquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Staff can view enquiries"
  ON public.enquiries FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can update enquiries"
  ON public.enquiries FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_enquiries_updated_at
BEFORE UPDATE ON public.enquiries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_enquiries_status ON public.enquiries(status);
CREATE INDEX idx_enquiries_source ON public.enquiries(source);
CREATE INDEX idx_enquiries_created ON public.enquiries(created_at DESC);

-- Duplicate-check helper (allow new submission only after 24h)
CREATE OR REPLACE FUNCTION public.enquiry_recently_submitted(_email TEXT, _phone TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.enquiries
    WHERE (lower(email) = lower(_email) OR (phone IS NOT NULL AND phone = _phone))
      AND created_at > now() - INTERVAL '24 hours'
  )
$$;

-- =========================================
-- 2. COURSE RESOURCES
-- =========================================
CREATE TABLE public.course_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL,
  chapter_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  resource_type TEXT NOT NULL DEFAULT 'pdf' CHECK (resource_type IN ('pdf','notes','worksheet','solution','other')),
  file_url TEXT NOT NULL,
  file_size_bytes BIGINT,
  mime_type TEXT,
  is_published BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.course_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage all course resources"
  ON public.course_resources FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teachers manage resources of own courses"
  ON public.course_resources FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_resources.course_id AND c.created_by = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_resources.course_id AND c.created_by = auth.uid()));

CREATE POLICY "Anyone can view published resources of published courses"
  ON public.course_resources FOR SELECT
  TO anon, authenticated
  USING (
    is_published = true
    AND EXISTS (SELECT 1 FROM public.courses c WHERE c.id = course_resources.course_id AND c.is_published = true)
  );

CREATE TRIGGER update_course_resources_updated_at
BEFORE UPDATE ON public.course_resources
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_course_resources_course ON public.course_resources(course_id);
CREATE INDEX idx_course_resources_chapter ON public.course_resources(chapter_id);

-- Storage bucket for course resources (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-resources', 'course-resources', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
CREATE POLICY "Staff can read course resource files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'course-resources'
    AND (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Authenticated can read course resource files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'course-resources');

CREATE POLICY "Staff can upload course resource files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'course-resources'
    AND (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Staff can update course resource files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'course-resources'
    AND (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Staff can delete course resource files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'course-resources'
    AND (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  );

-- =========================================
-- 3. REPORTS
-- =========================================
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  reported_user_id UUID,
  reported_name TEXT NOT NULL,
  reported_role TEXT NOT NULL DEFAULT 'teacher' CHECK (reported_role IN ('teacher','mentor','staff','other')),
  category TEXT NOT NULL DEFAULT 'other' CHECK (category IN ('misconduct','inappropriate_content','no_show','payment','other')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','resolved','dismissed')),
  resolution_notes TEXT,
  handled_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can submit reports"
  ON public.reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporters view their own reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Staff view all reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff update reports"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'staff'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_reports_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_reports_status ON public.reports(status);
CREATE INDEX idx_reports_reporter ON public.reports(reporter_id);
CREATE INDEX idx_reports_created ON public.reports(created_at DESC);

-- Trigger: notify reporter when staff changes status
CREATE OR REPLACE FUNCTION public.notify_report_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, title, body, type, link)
    VALUES (
      NEW.reporter_id,
      'Update on your report',
      'Your report "' || NEW.subject || '" is now ' || NEW.status || '.',
      'report',
      '/notifications'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reports_notify_status
AFTER UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.notify_report_status_change();