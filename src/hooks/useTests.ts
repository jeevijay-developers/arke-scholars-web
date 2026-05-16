import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TestRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  test_type: string;
  exam_pattern: string;
  subjects: string[];
  duration_minutes: number;
  total_questions: number;
  total_marks: number;
  is_published: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

export const useTests = (testType?: string) => {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      let q = supabase.from("tests").select("*").eq("is_published", true).order("created_at", { ascending: false });
      if (testType && testType !== "all") q = q.eq("test_type", testType);
      const { data } = await q;
      setTests((data ?? []) as TestRow[]);
      setLoading(false);
    };
    load();
  }, [testType]);

  return { tests, loading };
};
