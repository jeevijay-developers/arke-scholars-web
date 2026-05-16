import { useEffect, useMemo, useRef, useState } from "react";
import { Crown, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { CompeteMatch, CompeteQuestion, CompeteAnswer } from "@/hooks/useCompeteMatch";
import { toast } from "sonner";
import MathRenderer from "@/components/MathRenderer";

const QUESTION_TIME_MS = 30_000;

type Props = {
  match: CompeteMatch;
  questions: CompeteQuestion[];
  answers: CompeteAnswer[];
};

const CompeteMatchView = ({ match, questions, answers }: Props) => {
  const { user } = useAuth();
  const isP1 = user?.id === match.player1_id;
  const myId = user?.id ?? "";

  const qIndex = match.current_question_index;
  const question = questions[qIndex];

  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS);
  const submittedRef = useRef<Set<number>>(new Set());

  // Anchor question start time to server's current_question_started_at so
  // refreshes/reconnects resume with the correct remaining time.
  const startedAt = match.current_question_started_at
    ? new Date(match.current_question_started_at).getTime()
    : Date.now();

  // Reset selection when question advances
  useEffect(() => {
    setSelected(null);
  }, [qIndex]);

  // Tick timer based on server start
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const left = Math.max(0, QUESTION_TIME_MS - elapsed);
      setTimeLeft(left);
      if (left <= 0 && !submittedRef.current.has(qIndex)) {
        submitAnswer(null);
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qIndex, startedAt]);

  const myAnswered = answers.some((a) => a.user_id === myId && a.question_index === qIndex);
  const oppAnswered = answers.some((a) => a.user_id !== myId && a.question_index === qIndex);
  // After reload, mark submitted so we don't re-submit on timeout
  useEffect(() => {
    if (myAnswered) submittedRef.current.add(qIndex);
  }, [myAnswered, qIndex]);

  const myScore = isP1 ? match.player1_score : match.player2_score;
  const oppScore = isP1 ? match.player2_score : match.player1_score;
  const myName = isP1 ? match.player1_name : match.player2_name;
  const oppName = isP1 ? (match.player2_name || (match.is_bot ? "Bot" : "Opponent")) : match.player1_name;

  const submitAnswer = async (idx: number | null) => {
    if (submittedRef.current.has(qIndex) || submitting) return;
    submittedRef.current.add(qIndex);
    setSubmitting(true);
    setSelected(idx);
    const elapsed = Math.min(QUESTION_TIME_MS, Date.now() - startedAt);
    try {
      const { error } = await supabase.functions.invoke("compete-submit-answer", {
        body: { match_id: match.id, question_index: qIndex, selected_index: idx, time_taken_ms: elapsed },
      });
      if (error) {
        submittedRef.current.delete(qIndex);
        toast.error("Submit failed: " + error.message);
      }
    } catch (e: any) {
      submittedRef.current.delete(qIndex);
      toast.error(e?.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const timerPct = (timeLeft / QUESTION_TIME_MS) * 100;
  const timerColor = timeLeft < 5000 ? "bg-destructive" : timeLeft < 15000 ? "bg-accent" : "bg-secondary";

  if (!question) {
    return <div className="text-center text-white/70 py-10">Loading question...</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Score header */}
      <div className="flex items-center justify-center gap-4 py-2">
        <PlayerCard name={myName ?? "You"} score={myScore} highlight isMe />
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Question</p>
          <p className="text-xl font-black text-white">{qIndex + 1}<span className="text-white/40">/{match.total_questions}</span></p>
        </div>
        <PlayerCard name={oppName ?? "Opponent"} score={oppScore} answered={oppAnswered} />
      </div>

      {/* Timer */}
      <div className="max-w-xl mx-auto">
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div className={`h-full ${timerColor} transition-all duration-200`} style={{ width: `${timerPct}%` }} />
        </div>
        <div className="flex items-center justify-center gap-1 mt-1.5 text-xs text-white/70">
          <Timer className="h-3 w-3" /> {Math.ceil(timeLeft / 1000)}s
        </div>
      </div>

      {/* Question */}
      <div className="max-w-xl mx-auto rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="text-base font-bold text-white leading-relaxed [&_p]:m-0"><MathRenderer content={question.question_text} /></div>
      </div>

      {/* Options */}
      <div className="max-w-xl mx-auto grid gap-2">
        {question.options.map((opt, i) => {
          const isSelected = selected === i;
          const locked = myAnswered || submitting;
          return (
            <button
              key={i}
              disabled={locked}
              onClick={() => submitAnswer(i)}
              className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-all ${
                isSelected
                  ? "border-primary bg-primary/20 text-white"
                  : "border-white/10 bg-white/5 text-white hover:border-white/30 hover:bg-white/10"
              } ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-black mr-2 align-middle">{String.fromCharCode(65 + i)}</span>
              <span className="inline [&_p]:inline [&_p]:m-0"><MathRenderer inline content={opt} /></span>
            </button>
          );
        })}
      </div>

      {myAnswered && !oppAnswered && (
        <p className="text-center text-xs text-white/60">Waiting for opponent...</p>
      )}
    </div>
  );
};

const PlayerCard = ({ name, score, highlight, answered, isMe }: { name: string; score: number; highlight?: boolean; answered?: boolean; isMe?: boolean }) => {
  const initials = (name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="text-center">
      <div className="relative">
        {highlight && <Crown className="h-3 w-3 text-accent absolute -top-2 left-1/2 -translate-x-1/2" />}
        <div className={`h-12 w-12 rounded-full bg-gradient-to-br ${isMe ? "from-primary to-accent" : "from-secondary to-primary"} border-2 ${answered ? "border-secondary animate-pulse" : "border-white/20"} flex items-center justify-center mx-auto`}>
          <span className="text-sm font-black text-white">{initials}</span>
        </div>
      </div>
      <p className="text-[11px] font-bold text-white mt-1 max-w-[80px] truncate">{name}</p>
      <p className="text-base font-black text-accent">{Math.round(score)}</p>
    </div>
  );
};

export default CompeteMatchView;
