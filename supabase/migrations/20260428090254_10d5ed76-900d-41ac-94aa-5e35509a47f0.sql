ALTER TABLE public.educator_applications
ADD COLUMN IF NOT EXISTS credentials_sent_at TIMESTAMPTZ NULL;