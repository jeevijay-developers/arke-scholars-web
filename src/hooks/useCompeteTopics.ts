import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useCompeteTopics = (subject: string, classLevel: string, targetExam: string) => {
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!subject) return;
    let cancelled = false;
    setLoading(true);
    setTopics([]);

    (async () => {
      const { data } = await supabase
        .from("compete_questions_public")
        .select("topic")
        .eq("subject", subject)
        .eq("is_active", true)
        .eq("class_level", classLevel || "11")
        .eq("target_exam", targetExam || "JEE");

      if (cancelled) return;

      // Deduplicate and sort
      const unique = [...new Set((data ?? []).map((r) => r.topic as string))].sort();

      // If nothing for this exact class+exam, fall back to any active questions for the subject
      if (unique.length === 0) {
        const { data: fallback } = await supabase
          .from("compete_questions_public")
          .select("topic")
          .eq("subject", subject)
          .eq("is_active", true);
        if (!cancelled) {
          setTopics([...new Set((fallback ?? []).map((r) => r.topic as string))].sort());
        }
      } else {
        setTopics(unique);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [subject, classLevel, targetExam]);

  return { topics, loading };
};
