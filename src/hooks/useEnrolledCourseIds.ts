import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export const useEnrolledCourseIds = () => {
  const { user } = useAuth();
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEnrolledCourseIds(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("enrollments")
      .select("course_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .then(({ data }) => {
        setEnrolledCourseIds(new Set((data ?? []).map((e) => e.course_id)));
        setLoading(false);
      });
  }, [user]);

  return { enrolledCourseIds, loading };
};
