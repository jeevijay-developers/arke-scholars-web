import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CompeteMatch = {
  id: string;
  player1_id: string;
  player2_id: string | null;
  player1_name: string | null;
  player2_name: string | null;
  player1_avatar: string | null;
  player2_avatar: string | null;
  player1_score: number;
  player2_score: number;
  player1_rating_before: number | null;
  player2_rating_before: number | null;
  player1_rating_after: number | null;
  player2_rating_after: number | null;
  subject: string;
  topic: string;
  question_ids: string[];
  current_question_index: number;
  total_questions: number;
  status: string;
  is_bot: boolean;
  is_private: boolean;
  room_code: string | null;
  winner_id: string | null;
  started_at: string | null;
  finished_at: string | null;
  countdown_until: string | null;
  current_question_started_at: string | null;
};

export type CompeteQuestion = {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
};

export type CompeteAnswer = {
  match_id: string;
  user_id: string;
  question_index: number;
  selected_index: number | null;
  is_correct: boolean;
  points: number;
  time_taken_ms: number;
};

export const useCompeteMatch = (matchId: string | null) => {
  const [match, setMatch] = useState<CompeteMatch | null>(null);
  const [questions, setQuestions] = useState<CompeteQuestion[]>([]);
  const [answers, setAnswers] = useState<CompeteAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedQuestionsFor = useRef<string | null>(null);

  useEffect(() => {
    if (!matchId) return;
    let cancelled = false;

    const load = async () => {
      const { data: m } = await supabase.from("compete_matches").select("*").eq("id", matchId).maybeSingle();
      if (cancelled) return;
      setMatch(m as unknown as CompeteMatch);

      if (m && loadedQuestionsFor.current !== matchId && (m as any).question_ids?.length) {
        loadedQuestionsFor.current = matchId;
        const { data: qs } = await supabase
          .from("compete_questions")
          .select("id, question_text, options, correct_index, explanation")
          .in("id", (m as any).question_ids);
        // Re-order to match question_ids order
        const byId = new Map((qs ?? []).map((q) => [q.id, q]));
        const ordered = (m as any).question_ids.map((id: string) => byId.get(id)).filter(Boolean) as CompeteQuestion[];
        setQuestions(ordered);
      }

      const { data: ans } = await supabase.from("compete_match_answers").select("*").eq("match_id", matchId);
      setAnswers((ans ?? []) as unknown as CompeteAnswer[]);
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel(`compete-match-${matchId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "compete_matches", filter: `id=eq.${matchId}` }, (payload) => {
        setMatch(payload.new as unknown as CompeteMatch);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "compete_match_answers", filter: `match_id=eq.${matchId}` }, (payload) => {
        setAnswers((prev) => [...prev, payload.new as unknown as CompeteAnswer]);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  return { match, questions, answers, loading };
};
