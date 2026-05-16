
-- 1) DELETE policies (super_admin only) for sensitive content
CREATE POLICY "Super admins can delete courses"
  ON public.courses FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete tests"
  ON public.tests FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete enquiries"
  ON public.enquiries FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete educator applications"
  ON public.educator_applications FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- 2) payments table (empty for now, super_admin only)
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  student_name text,
  plan text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'INR',
  gateway text NOT NULL DEFAULT 'razorpay',
  external_id text,
  status text NOT NULL DEFAULT 'success',
  refunded_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage payments"
  ON public.payments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) platform_settings (single row config)
CREATE TABLE public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1,
  site_name text NOT NULL DEFAULT 'Arke',
  maintenance_mode boolean NOT NULL DEFAULT false,
  open_registrations boolean NOT NULL DEFAULT true,
  admin_email_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT platform_settings_singleton CHECK (id = 1)
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read platform settings"
  ON public.platform_settings FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Super admins update platform settings"
  ON public.platform_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins insert platform settings"
  ON public.platform_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the singleton row
INSERT INTO public.platform_settings (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;
