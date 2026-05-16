-- Add payment_id FK to enrollments so we can distinguish paid from free
ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS payment_id uuid REFERENCES public.payments(id);

-- Index for the gating query in get-video-url
CREATE INDEX IF NOT EXISTS enrollments_payment_id_idx
  ON public.enrollments (payment_id)
  WHERE payment_id IS NOT NULL;
