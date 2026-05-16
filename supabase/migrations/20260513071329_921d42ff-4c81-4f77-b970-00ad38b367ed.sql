-- Add slug column to live_classes
ALTER TABLE public.live_classes ADD COLUMN IF NOT EXISTS slug TEXT;

-- Slugify helper
CREATE OR REPLACE FUNCTION public.slugify_text(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s TEXT;
BEGIN
  s := lower(coalesce(input, ''));
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := regexp_replace(s, '(^-+|-+$)', '', 'g');
  IF s = '' THEN s := 'class'; END IF;
  RETURN s;
END;
$$;

-- Trigger to auto-generate slug
CREATE OR REPLACE FUNCTION public.set_live_class_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' OR (TG_OP = 'UPDATE' AND NEW.title IS DISTINCT FROM OLD.title AND (NEW.slug = OLD.slug)) THEN
    NEW.slug := public.slugify_text(NEW.title) || '-' || substr(NEW.id::text, 1, 6);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_live_class_slug ON public.live_classes;
CREATE TRIGGER trg_set_live_class_slug
BEFORE INSERT OR UPDATE OF title ON public.live_classes
FOR EACH ROW EXECUTE FUNCTION public.set_live_class_slug();

-- Backfill existing rows
UPDATE public.live_classes
SET slug = public.slugify_text(title) || '-' || substr(id::text, 1, 6)
WHERE slug IS NULL OR slug = '';

-- Make NOT NULL and unique
ALTER TABLE public.live_classes ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS live_classes_slug_unique ON public.live_classes(slug);