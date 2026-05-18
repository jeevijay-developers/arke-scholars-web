import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type QuestionType =
  | "scq"
  | "mcq"
  | "integer"
  | "match_column"
  | "assertion_reasoning";

export type MatchEntry = { key: string; value: string };

// options shape is polymorphic by question_type:
//   scq | mcq | assertion_reasoning  →  { id: number; text: string }[]
//   integer                           →  []
//   match_column                      →  { col1: MatchEntry[]; col2: MatchEntry[] }
//
// correct_answer is also polymorphic:
//   scq | mcq | assertion_reasoning  →  number[]    (1-indexed option numbers)
//   integer                           →  number
//   match_column                      →  string     (e.g. "A-P, B-Q, C-R, D-S")
export type BankOptions =
  | { id: number; text: string }[]
  | { col1: MatchEntry[]; col2: MatchEntry[] };

export type BankCorrectAnswer = number | number[] | string;

export type BankQuestion = {
  id: string;
  created_by: string | null;
  subject: string;
  topic: string | null;
  difficulty: string;
  question_type: QuestionType;
  question_text: string;
  question_image_url: string | null;
  options: BankOptions;
  correct_answer: BankCorrectAnswer;
  explanation: string | null;
  marks_correct: number;
  marks_wrong: number;
  tags: string[];
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type BankFilters = {
  subject?: string;
  difficulty?: string;
  search?: string;
};

export const QUESTION_BANK_KEY = ["question-bank"] as const;

const fetchBank = async (filters: BankFilters) => {
  let q = supabase
    .from("question_bank")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (filters.subject && filters.subject !== "All") q = q.eq("subject", filters.subject);
  if (filters.difficulty && filters.difficulty !== "All")
    q = q.eq("difficulty", filters.difficulty.toLowerCase());
  if (filters.search) q = q.ilike("question_text", `%${filters.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as BankQuestion[];
};

export const useQuestionBank = (filters: BankFilters = {}) => {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: [...QUESTION_BANK_KEY, filters.subject ?? "All", filters.difficulty ?? "All", filters.search ?? ""],
    queryFn: () => fetchBank(filters),
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  return {
    questions: data ?? [],
    loading: isLoading,
    reload: () => qc.invalidateQueries({ queryKey: QUESTION_BANK_KEY }),
    refetch,
  };
};
