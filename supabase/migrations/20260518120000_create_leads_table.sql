-- Enquiry leads from the Arke Scholars landing page
-- Captures: name, phone, city, board, medium submitted via the EnquiryForm

CREATE TABLE IF NOT EXISTS public.leads (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT        NOT NULL,
  phone      TEXT        NOT NULL,
  city       TEXT        NOT NULL,
  board      TEXT        NOT NULL,
  medium     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_created_at ON public.leads(created_at DESC);
CREATE INDEX idx_leads_phone      ON public.leads(phone);

-- RLS: anyone (including anonymous visitors) can INSERT a lead
-- Only admin / staff can read them
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
  ON public.leads FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view leads"
  ON public.leads FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
  );
