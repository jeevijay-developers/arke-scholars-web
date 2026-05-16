-- Templates for recurring live classes
CREATE TABLE public.live_class_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  target_exam TEXT,
  educator_name TEXT,
  educator_avatar TEXT,
  teacher_id UUID,
  meeting_url TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  max_participants INTEGER,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.live_class_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage live class templates"
ON public.live_class_templates
FOR ALL TO authenticated
USING (is_admin_or_super(auth.uid()))
WITH CHECK (is_admin_or_super(auth.uid()));

CREATE TRIGGER update_live_class_templates_updated_at
BEFORE UPDATE ON public.live_class_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cancellation reason on live classes
ALTER TABLE public.live_classes
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cancelled_by UUID;