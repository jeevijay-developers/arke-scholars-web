import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Exam = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const FALLBACK_EXAMS = ["JEE Main", "JEE Advanced", "NEET", "Boards", "Foundation"];

/** Fetch active exams. If the table is missing or RLS blocks, returns fallback list. */
export const useExams = (opts: { includeInactive?: boolean } = {}) => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    let query = (supabase as any).from("exams").select("*").order("sort_order").order("name");
    if (!opts.includeInactive) query = query.eq("is_active", true);
    const { data, error } = await query;
    if (error) {
      setError(error.message);
      setExams([]);
    } else {
      setExams((data ?? []) as Exam[]);
    }
    setLoading(false);
  }, [opts.includeInactive]);

  useEffect(() => { load(); }, [load]);

  const examNames = exams.length
    ? exams.map((e) => e.name)
    : FALLBACK_EXAMS;

  return { exams, examNames, loading, error, reload: load };
};
