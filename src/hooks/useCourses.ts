import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CourseRow = {
  id: string;
  slug: string;
  name: string;
  internal_name: string;
  description: string | null;
  thumbnail_url: string | null;
  rating: number | null;
  badge: string | null;
  is_featured: boolean;
  is_active: boolean;
  is_course_free: boolean;
  mrp: number;
  sale_price: number;
  discount_percent: number | null;
  show_price_with_gst: boolean;
  target: string;
  class: string;
  language: string;
  priority: number;
  tags: string[] | null;
  assigned_teacher_id: string | null;
  what_youll_learn: string[] | null;
  requirements: string[] | null;
  course_end_date: string | null;
  max_usage_days: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export const useCourses = (target?: string, classFilter?: string) => {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase
        .from("courses")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: true });

      if (target && target !== "All") q = q.eq("target", target);
      if (classFilter && classFilter !== "All") q = q.eq("class", classFilter);

      const { data } = await q;
      setCourses((data ?? []) as CourseRow[]);
      setLoading(false);
    };
    load();
  }, [target, classFilter]);

  return { courses, loading };
};
