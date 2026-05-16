ALTER TABLE public.live_classes
ADD CONSTRAINT live_classes_course_id_fkey
FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE SET NULL;