-- Phase 6: Remove dead columns.
-- profiles.plan — no subscription tiers exist; platform earns only by selling courses.
-- profiles.goal — merged into target_exam; goal column is now unused.
-- payments.plan — misnamed column; stores course name, not a subscription tier.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS plan;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS goal;
ALTER TABLE public.payments RENAME COLUMN plan TO course_name;
