import { useEffect, useRef, useState } from "react";
import { Crown, Timer, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { CompeteMatch, CompeteQuestion, CompeteAnswer } from "@/hooks/useCompeteMatch";
import { toast } from "sonner";
import LatexRenderer from "@/components/LatexRenderer";

const QUESTION_TIME_MS = 30_000;

type Props = {
  match: CompeteMatch;
  questions: CompeteQuestion[];
  answers: CompeteAnswer[];
  onQuit?: () => void;
};

const CompeteMatchView = ({ match, questions, answers, onQuit }: Props) => {
  const { user } = useAuth();
  const isP1 = user?.id === match.player1_id;
  const myId = user?.id ?? "";

  // Each player progresses independently — track my own question index locally
  const [myQIndex, setMyQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_MS);
  const [waitingForOpponent, setWaitingForOpponent] = useState(false);
  const submittedRef = useRef<Set<number>>(new Set());
  // Track when each question started (set when we advance to it)
  const questionStartRef = useRef<number>(Date.now());

  const question = questions[myQIndex];
  const totalQ = match.total_questions;

  // On mount, resume from however many answers I've already submitted
  useEffect(() => {
    const myAnswers = answers.filter((a) => a.user_id === myId);
    if (myAnswers.length > 0) {
      const maxAnswered = Math.max(...myAnswers.map((a) => a.question_index));
      const resumeIndex = maxAnswered + 1;
      if (resumeIndex < totalQ) {
        submittedRef.current = new Set(myAnswers.map((a) => a.question_index));
        setMyQIndex(resumeIndex);
        setWaitingForOpponent(false);
      } else {
        // Already answered all — show waiting screen
        setMyQIndex(totalQ);
        setWaitingForOpponent(true);
        submittedRef.current = new Set(myAnswers.map((a) => a.question_index));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // Reset timer and selection whenever my question index advances
  useEffect(() => {
    setSelected(null);
    setTimeLeft(QUESTION_TIME_MS);
    questionStartRef.current = Date.now();
  }, [myQIndex]);

  // Tick timer
  useEffect(() => {
    if (waitingForOpponent || myQIndex >= totalQ) return;
    const id = setInterval(() => {
      const elapsed = Date.now() - questionStartRef.current;
      const left = Math.max(0, QUESTION_TIME_MS - elapsed);
      setTimeLeft(left);
      if (left <= 0 && !submittedRef.current.has(myQIndex)) {
        submitAnswer(null); // auto-skip on timeout
      }
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myQIndex, waitingForOpponent]);

  // Scores and names
  const myScore = isP1 ? match.player1_score : match.player2_score;
  const oppScore = isP1 ? match.player2_score : match.player1_score;
  const myName = isP1 ? match.player1_name : match.player2_name;
  const myAvatar = isP1 ? match.player1_avatar : match.player2_avatar;
  const oppName = isP1 ? (match.player2_name || (match.is_bot ? "Bot" : "Opponent")) : match.player1_name;
  const oppAvatar = isP1 ? match.player2_avatar : match.player1_avatar;

  // Count opponent's answered questions (for their progress indicator)
  const oppAnswerCount = answers.filter((a) => a.user_id !== myId && a.user_id !== "00000000-0000-0000-0000-000000000000").length
    || answers.filter((a) => a.user_id === "00000000-0000-0000-0000-000000000000").length;

  const submitAnswer = async (idx: number | null) => {
    if (submittedRef.current.has(myQIndex) || submitting) return;
    submittedRef.current.add(myQIndex);
    setSubmitting(true);
    setSelected(idx);
    const elapsed = Math.min(QUESTION_TIME_MS, Date.now() - questionStartRef.current);

    try {
      const { error } = await supabase.functions.invoke("compete-submit-answer", {
        body: { match_id: match.id, question_index: myQIndex, selected_index: idx, time_taken_ms: elapsed },
      });
      if (error) {
        submittedRef.current.delete(myQIndex);
        toast.error("Submit failed: " + error.message);
        setSubmitting(false);
        return;
      }
    } catch (e: any) {
      submittedRef.current.delete(myQIndex);
      toast.error(e?.message || "Network error");
      setSubmitting(false);
      return;
    }

    setSubmitting(false);

    // Advance to next question immediately (don't wait for opponent)
    const nextIndex = myQIndex + 1;
    if (nextIndex < totalQ) {
      setMyQIndex(nextIndex);
    } else {
      // I finished all questions — wait for opponent + match.status to become "finished"
      setMyQIndex(totalQ);
      setWaitingForOpponent(true);
    }
  };

  const timerPct = (timeLeft / QUESTION_TIME_MS) * 100;
  const timerColor = timeLeft < 5000 ? "bg-destructive" : timeLeft < 15000 ? "bg-accent" : "bg-secondary";

  // Waiting for opponent to finish
  if (waitingForOpponent) {
    return (
      <div className="space-y-4 animate-fade-in-up">
        <div className="flex items-center justify-center gap-4 py-2">
          <PlayerCard name={myName ?? "You"} avatar={myAvatar} score={myScore} highlight isMe />
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Question</p>
            <p className="text-xl font-black text-white">{totalQ}<span className="text-white/40">/{totalQ}</span></p>
          </div>
          <PlayerCard name={oppName ?? "Opponent"} avatar={oppAvatar} score={oppScore} progress={oppAnswerCount} total={totalQ} />
        </div>
        <div className="max-w-xl mx-auto rounded-2xl bg-white/5 border border-white/10 p-10 text-center space-y-3">
          <div className="text-4xl">⏳</div>
          <p className="text-base font-bold text-white">You're done!</p>
          <p className="text-sm text-white/60">Waiting for opponent to finish the match...</p>
          <div className="w-full bg-white/10 rounded-full h-2 mt-3">
            <div
              className="bg-accent h-2 rounded-full transition-all duration-500"
              style={{ width: `${(oppAnswerCount / totalQ) * 100}%` }}
            />
          </div>
          <p className="text-xs text-white/40">{oppAnswerCount}/{totalQ} questions answered</p>
        </div>
        {onQuit && (
          <div className="max-w-xl mx-auto">
            {!confirmQuit ? (
              <button
                onClick={() => setConfirmQuit(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/50 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                <LogOut className="h-4 w-4" /> Quit Match
              </button>
            ) : (
              <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center space-y-3">
                <p className="text-sm font-bold text-white">Quit this match?</p>
                <p className="text-xs text-white/50">You'll forfeit and return to the lobby.</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => setConfirmQuit(false)}
                    className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onQuit}
                    className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-semibold text-white hover:bg-destructive/80 transition-all"
                  >
                    Yes, Quit
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!question) {
    return <div className="text-center text-white/70 py-10">Loading question...</div>;
  }

  const myAnsweredThisQ = submittedRef.current.has(myQIndex);

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Score header */}
      <div className="flex items-center justify-center gap-4 py-2">
        <PlayerCard name={myName ?? "You"} avatar={myAvatar} score={myScore} highlight isMe />
        <div className="text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">Question</p>
          <p className="text-xl font-black text-white">{myQIndex + 1}<span className="text-white/40">/{totalQ}</span></p>
        </div>
        <PlayerCard name={oppName ?? "Opponent"} avatar={oppAvatar} score={oppScore} progress={oppAnswerCount} total={totalQ} />
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
        <LatexRenderer
          html={question.question_text}
          className="text-base font-semibold text-white leading-relaxed [&_img]:max-w-full [&_img]:max-h-64 [&_img]:rounded-lg [&_img]:mt-2 [&_img]:block"
        />
      </div>

      {/* Options */}
      <div className="max-w-xl mx-auto grid gap-2">
        {(question.options as string[]).map((opt, i) => {
          const isSelected = selected === i;
          const locked = myAnsweredThisQ || submitting;
          return (
            <button
              key={i}
              disabled={locked}
              onClick={() => submitAnswer(i)}
              className={`w-full rounded-xl border-2 px-4 py-3 text-left text-sm font-semibold transition-all ${
                isSelected
                  ? "border-primary bg-primary/20 text-white"
                  : "border-white/10 bg-white/5 text-white hover:border-white/30 hover:bg-white/10"
              } ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
            >
              <div className="flex items-start gap-3">
                <span className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-xs font-black">
                  {String.fromCharCode(65 + i)}
                </span>
                <LatexRenderer
                  html={opt}
                  className="flex-1 text-white [&_img]:max-h-32 [&_img]:max-w-full [&_img]:rounded [&_img]:mt-1"
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Quit */}
      {onQuit && (
        <div className="max-w-xl mx-auto">
          {!confirmQuit ? (
            <button
              onClick={() => setConfirmQuit(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/50 hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <LogOut className="h-4 w-4" /> Quit Match
            </button>
          ) : (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-center space-y-3">
              <p className="text-sm font-bold text-white">Quit this match?</p>
              <p className="text-xs text-white/50">You'll forfeit and return to the lobby.</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setConfirmQuit(false)}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={onQuit}
                  className="rounded-lg bg-destructive px-4 py-1.5 text-xs font-semibold text-white hover:bg-destructive/80 transition-all"
                >
                  Yes, Quit
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PlayerCard = ({
  name, avatar, score, highlight, isMe, progress, total,
}: {
  name: string;
  avatar?: string | null;
  score: number;
  highlight?: boolean;
  isMe?: boolean;
  progress?: number;
  total?: number;
}) => {
  const initials = (name || "?").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="text-center">
      <div className="relative">
        {highlight && <Crown className="h-3 w-3 text-accent absolute -top-2 left-1/2 -translate-x-1/2" />}
        <div className={`h-12 w-12 rounded-full border-2 ${isMe ? "border-accent" : "border-white/20"} overflow-hidden mx-auto flex items-center justify-center bg-gradient-to-br ${isMe ? "from-primary to-accent" : "from-secondary to-primary"}`}>
          {avatar ? (
            <img src={avatar} alt={name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-black text-white">{initials}</span>
          )}
        </div>
      </div>
      <p className="text-[11px] font-bold text-white mt-1 max-w-[80px] truncate">{name}</p>
      <p className="text-base font-black text-accent">{Math.round(score)}</p>
      {progress !== undefined && total !== undefined && (
        <p className="text-[10px] text-white/40">{progress}/{total} done</p>
      )}
    </div>
  );
};

export default CompeteMatchView;
