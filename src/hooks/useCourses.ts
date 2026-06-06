import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CourseRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  subject: string;
  educator_name: string;
  thumbnail_url: string | null;
  rating: number;
  total_lessons: number;
  duration_hours: number;
  badge: string | null;
  price: number;
  original_price: number | null;
  discount_percent: number | null;
  target_exam: string | null;
  is_published: boolean;
  total_enrolled: number | null;
};

export const useCourses = (targetExam?: string, subject?: string, level?: string) => {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase
        .from("courses")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (targetExam && targetExam !== "All") {
        // Match exact label ("JEE Main") AND short prefix ("JEE") for legacy data.
        const prefix = targetExam.split(" ")[0];
        const filter =
          prefix !== targetExam
            ? `target_exam.eq.${targetExam},target_exam.eq.${prefix}`
            : `target_exam.eq.${targetExam}`;
        q = q.or(filter);
      }
      if (subject && subject !== "All") q = q.eq("subject", subject);
      if (level && level !== "All") q = q.eq("level", level);

      const { data } = await q;
      setCourses((data ?? []) as CourseRow[]);
      setLoading(false);
    };
    load();
  }, [targetExam, subject, level]);

  return { courses, loading };
};
