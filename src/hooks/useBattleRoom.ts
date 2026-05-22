import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BattleQuestion = {
  id: string;
  question_text: string;
  options: string[];
  difficulty?: string;
  subject?: string;
  topic?: string;
};

export type AnswerFeedback = {
  questionId: string;
  isCorrect: boolean;
  pointsEarned: number;
  correctOptionIndex: number;
  selectedOptionIndex: number | null;
};

export type PlayerScore = {
  playerId: string;
  score: number;
  questionsAnswered: number;
};

export type BattleRoomState = {
  questions: BattleQuestion[];
  currentIndex: number;
  timeLeft: number;
  myScore: PlayerScore | null;
  opponentScore: PlayerScore | null;
  feedbackMap: Record<string, AnswerFeedback>;
  battle: {
    id: string;
    player1_id: string;
    player2_id: string | null;
    status: string;
    winner_id: string | null;
    question_ids: string[];
  } | null;
  phase: "loading" | "battling" | "finished";
  submitting: boolean;
  error: string | null;
};

const QUESTION_SECONDS = 30;

export function useBattleRoom(battleId: string | null) {
  const [state, setState] = useState<BattleRoomState>({
    questions: [],
    currentIndex: 0,
    timeLeft: QUESTION_SECONDS,
    myScore: null,
    opponentScore: null,
    feedbackMap: {},
    battle: null,
    phase: "loading",
    submitting: false,
    error: null,
  });

  const timerRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const submittingRef = useRef(false); // guard double-submit on timeout
  const myUserIdRef = useRef<string | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(
    (onTimeout: () => void) => {
      stopTimer();
      setState((s) => ({ ...s, timeLeft: QUESTION_SECONDS }));
      let left = QUESTION_SECONDS;
      timerRef.current = window.setInterval(() => {
        left -= 1;
        setState((s) => ({ ...s, timeLeft: left }));
        if (left <= 0) {
          stopTimer();
          onTimeout();
        }
      }, 1000);
    },
    [stopTimer],
  );

  const submitAnswer = useCallback(
    async (questionId: string, selectedOptionIndex: number | null, secondsTaken: number) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      stopTimer();
      setState((s) => ({ ...s, submitting: true }));

      try {
        const { data, error } = await supabase.functions.invoke<{
          isCorrect: boolean;
          pointsEarned: number;
          correctOptionIndex: number;
        }>("submit-battle-answer", {
          body: { battleId, questionId, selectedOptionIndex, secondsTaken },
        });

        if (error || !data) throw new Error(error?.message ?? "Submit failed");

        const feedback: AnswerFeedback = {
          questionId,
          isCorrect: data.isCorrect,
          pointsEarned: data.pointsEarned,
          correctOptionIndex: data.correctOptionIndex,
          selectedOptionIndex,
        };

        setState((s) => ({
          ...s,
          feedbackMap: { ...s.feedbackMap, [questionId]: feedback },
          submitting: false,
        }));

        // Check if this was the last question
        setState((s) => {
          const isLast = s.currentIndex >= s.questions.length - 1;
          if (isLast) {
            return { ...s, phase: "finished" };
          }
          return s;
        });

        // Advance to next question after brief feedback delay
        await new Promise((res) => setTimeout(res, 1200));

        setState((s) => {
          const next = s.currentIndex + 1;
          if (next >= s.questions.length) return { ...s, phase: "finished" };
          return { ...s, currentIndex: next };
        });
      } catch (err) {
        setState((s) => ({ ...s, submitting: false, error: (err as Error).message }));
      } finally {
        submittingRef.current = false;
      }
    },
    [battleId, stopTimer],
  );

  // Reset timer each time the current question changes
  const currentIndex = state.currentIndex;
  const questionsLength = state.questions.length;
  useEffect(() => {
    if (state.phase !== "battling" || questionsLength === 0) return;

    const questionId = state.questions[currentIndex]?.id;
    if (!questionId) return;

    let secondsTaken = 0;
    const questionStartTime = Date.now();

    const handleTimeout = () => {
      const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
      submitAnswer(questionId, null, elapsed);
    };

    startTimer(handleTimeout);

    return stopTimer;
  }, [currentIndex, state.phase, questionsLength]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger complete-battle when local player finishes all questions
  useEffect(() => {
    if (state.phase !== "finished" || !battleId) return;

    (async () => {
      await supabase.functions.invoke("complete-battle", { body: { battleId } });
    })();
  }, [state.phase, battleId]);

  // Load battle + questions + subscribe to realtime
  useEffect(() => {
    if (!battleId) return;
    let cancelled = false;

    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      myUserIdRef.current = userId;

      const { data: battle } = await supabase
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .single();

      if (cancelled || !battle) return;

      if (battle.status === "completed") {
        setState((s) => ({ ...s, battle: battle as BattleRoomState["battle"], phase: "finished" }));
        return;
      }

      // Fetch questions in battle order
      let questions: BattleQuestion[] = [];
      if (battle.question_ids?.length) {
        const { data: qs } = await supabase
          .from("compete_questions")
          .select("id, question_text, options, difficulty, subject, topic")
          .in("id", battle.question_ids);

        const byId = new Map((qs ?? []).map((q) => [q.id, q]));
        questions = battle.question_ids
          .map((id: string) => byId.get(id))
          .filter(Boolean) as BattleQuestion[];
      }

      // Fetch existing scores
      const { data: scores } = await supabase
        .from("battle_scores")
        .select("player_id, score, questions_answered")
        .eq("battle_id", battleId);

      const toPlayerScore = (pid: string): PlayerScore | null => {
        const row = scores?.find((s: { player_id: string }) => s.player_id === pid);
        return row ? { playerId: pid, score: row.score, questionsAnswered: row.questions_answered } : null;
      };

      const opponentId =
        userId === battle.player1_id ? battle.player2_id : battle.player1_id;

      if (cancelled) return;

      // Determine which question to resume from (skip already answered)
      const { data: myAnswers } = await supabase
        .from("battle_answers")
        .select("question_id, is_correct, points_earned, selected_option_index, seconds_taken")
        .eq("battle_id", battleId)
        .eq("player_id", userId ?? "");

      const answeredIds = new Set((myAnswers ?? []).map((a: { question_id: string }) => a.question_id));
      const resumeIndex = questions.findIndex((q) => !answeredIds.has(q.id));
      const feedbackMap: Record<string, AnswerFeedback> = {};
      for (const a of myAnswers ?? []) {
        feedbackMap[a.question_id] = {
          questionId: a.question_id,
          isCorrect: a.is_correct,
          pointsEarned: a.points_earned,
          correctOptionIndex: -1, // will be filled server-side on new answers
          selectedOptionIndex: a.selected_option_index,
        };
      }

      setState({
        questions,
        currentIndex: resumeIndex === -1 ? questions.length : resumeIndex,
        timeLeft: QUESTION_SECONDS,
        myScore: toPlayerScore(userId ?? ""),
        opponentScore: toPlayerScore(opponentId ?? ""),
        feedbackMap,
        battle: battle as BattleRoomState["battle"],
        phase: resumeIndex === -1 ? "finished" : "battling",
        submitting: false,
        error: null,
      });

      // Realtime: watch battles row for completion
      const channel = supabase
        .channel(`battle-room:${battleId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "battles",
            filter: `id=eq.${battleId}`,
          },
          (payload) => {
            const updated = payload.new as BattleRoomState["battle"];
            setState((s) => ({ ...s, battle: updated }));
            if (updated?.status === "completed") {
              setState((s) => ({ ...s, phase: "finished" }));
            }
          },
        )
        // Realtime: watch battle_scores for opponent's live progress
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "battle_scores",
            filter: `battle_id=eq.${battleId}`,
          },
          (payload) => {
            const row = payload.new as { player_id: string; score: number; questions_answered: number };
            const uid = myUserIdRef.current;
            setState((s) => {
              if (row.player_id === uid) {
                return {
                  ...s,
                  myScore: { playerId: row.player_id, score: row.score, questionsAnswered: row.questions_answered },
                };
              } else {
                return {
                  ...s,
                  opponentScore: { playerId: row.player_id, score: row.score, questionsAnswered: row.questions_answered },
                };
              }
            });
          },
        )
        .subscribe();

      channelRef.current = channel;
    };

    load();

    return () => {
      cancelled = true;
      stopTimer();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [battleId, stopTimer]);

  const handleAnswer = useCallback(
    (selectedOptionIndex: number) => {
      if (submittingRef.current || state.phase !== "battling") return;
      const question = state.questions[state.currentIndex];
      if (!question) return;
      const secondsTaken = QUESTION_SECONDS - state.timeLeft;
      submitAnswer(question.id, selectedOptionIndex, secondsTaken);
    },
    [state, submitAnswer],
  );

  return { state, handleAnswer };
}
