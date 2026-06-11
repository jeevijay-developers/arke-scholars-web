import { useMemo, useState } from "react";
import { Crown, RotateCw, Home, TrendingUp, TrendingDown, Check, X, Share2, Flame, Zap, Target } from "lucide-react";
import { CompeteMatch, CompeteQuestion, CompeteAnswer } from "@/hooks/useCompeteMatch";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import MathRenderer from "@/components/MathRenderer";

type Props = {
  match: CompeteMatch;
  questions: CompeteQuestion[];
  answers: CompeteAnswer[];
  onPlayAgain: () => void;
  onLobby: () => void;
};

const CompeteResult = ({ match, questions, answers, onPlayAgain, onLobby }: Props) => {
  const { user } = useAuth();
  const isP1 = user?.id === match.player1_id;
  const myId = user?.id ?? "";
  const oppId = isP1 ? match.player2_id : match.player1_id;
  const myScore = isP1 ? match.player1_score : match.player2_score;
  const oppScore = isP1 ? match.player2_score : match.player1_score;
  const myBefore = isP1 ? match.player1_rating_before : match.player2_rating_before;
  const myAfter = isP1 ? match.player1_rating_after : match.player2_rating_after;
  const myName = isP1 ? match.player1_name : match.player2_name;
  const oppName = isP1
    ? (match.player2_name || (match.is_bot ? "Bot" : "Opponent"))
    : match.player1_name;

  const won = match.winner_id && match.winner_id === user?.id;
  const draw = match.winner_id === null;
  const delta = (myAfter ?? 0) - (myBefore ?? 0);
  const title = draw ? "Draw!" : won ? "Victory!" : "Defeated";
  const titleColor = draw ? "text-white" : won ? "text-accent" : "text-destructive";

  const [tab, setTab] = useState<"summary" | "review">("summary");

  const myAnswers = useMemo(
    () => answers.filter((a) => a.user_id === myId).sort((a, b) => a.question_index - b.question_index),
    [answers, myId],
  );
  const oppAnswers = useMemo(
    () => answers.filter((a) => a.user_id !== myId).sort((a, b) => a.question_index - b.question_index),
    [answers, myId],
  );

  const correctCount = myAnswers.filter((a) => a.is_correct).length;
  const accuracy = myAnswers.length ? Math.round((correctCount / myAnswers.length) * 100) : 0;
  const avgTimeS = myAnswers.length
    ? Math.round((myAnswers.reduce((s, a) => s + a.time_taken_ms, 0) / myAnswers.length) / 100) / 10
    : 0;
  const fastest = myAnswers.filter((a) => a.is_correct).reduce((min, a) => a.time_taken_ms < min ? a.time_taken_ms : min, Infinity);

  const handleShare = async () => {
    const text = `🏆 I just ${won ? "won" : draw ? "drew" : "played"} a Compete match on Arke!\n${myName}: ${Math.round(myScore)} vs ${oppName}: ${Math.round(oppScore)}\nAccuracy ${accuracy}% · ${match.subject}`;
    if ((navigator as any).share) {
      try {
        await (navigator as any).share({ title: "Arke Compete", text });
        return;
      } catch { /* fallback below */ }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Score card copied to clipboard");
    } catch {
      toast.error("Could not share");
    }
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto py-6 animate-fade-in-up">
      {/* Hero */}
      <div className="text-center">
        <Crown className={`h-12 w-12 mx-auto ${won ? "text-accent" : "text-white/30"}`} />
        <h2 className={`text-3xl font-black font-display ${titleColor}`}>{title}</h2>
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto mt-4">
          <div className={`rounded-xl border-2 p-4 ${won ? "border-accent bg-accent/10" : "border-white/10 bg-white/5"}`}>
            <p className="text-xs font-bold text-white/60 truncate">{myName}</p>
            <p className="text-3xl font-black text-white mt-1">{Math.round(myScore)}</p>
          </div>
          <div className={`rounded-xl border-2 p-4 ${!won && !draw ? "border-destructive bg-destructive/10" : "border-white/10 bg-white/5"}`}>
            <p className="text-xs font-bold text-white/60 truncate">{oppName}</p>
            <p className="text-3xl font-black text-white mt-1">{Math.round(oppScore)}</p>
          </div>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl mx-auto">
        <Stat icon={<Target className="h-4 w-4 text-accent" />} label="Accuracy" value={`${accuracy}%`} />
        <Stat icon={<Check className="h-4 w-4 text-secondary" />} label="Correct" value={`${correctCount}/${myAnswers.length}`} />
        <Stat icon={<Zap className="h-4 w-4 text-primary" />} label="Avg time" value={`${avgTimeS}s`} />
        <Stat icon={<Flame className="h-4 w-4 text-primary" />} label="Fastest" value={Number.isFinite(fastest) ? `${(fastest / 1000).toFixed(1)}s` : "—"} />
      </div>

      {/* ELO summary */}
      {!match.is_bot && myAfter != null && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 flex items-center justify-center gap-2 text-sm max-w-md mx-auto">
          {delta >= 0 ? <TrendingUp className="h-4 w-4 text-secondary" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
          <span className="text-white/70">Rating</span>
          <span className="font-black text-white">{myBefore}</span>
          <span className="text-white/40">→</span>
          <span className="font-black text-white">{myAfter}</span>
          <span className={`font-bold ${delta >= 0 ? "text-secondary" : "text-destructive"}`}>({delta >= 0 ? "+" : ""}{delta})</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex justify-center gap-1 bg-white/5 rounded-lg p-1 max-w-xs mx-auto">
        <TabBtn active={tab === "summary"} onClick={() => setTab("summary")}>Summary</TabBtn>
        <TabBtn active={tab === "review"} onClick={() => setTab("review")}>Review ({questions.length})</TabBtn>
      </div>

      {tab === "summary" && (
        <div className="rounded-xl bg-white/5 border border-white/10 p-3 max-w-2xl mx-auto">
          <p className="text-xs uppercase tracking-wider text-white/50 font-bold mb-3">Question-by-question</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/70 font-bold w-16 shrink-0 text-right">You</span>
              <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${match.total_questions}, minmax(0, 1fr))` }}>
                {Array.from({ length: match.total_questions }).map((_, i) => {
                  const mine = myAnswers.find((a) => a.question_index === i);
                  return <Pip key={i} ok={mine?.is_correct} answered={!!mine} />;
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-white/70 font-bold w-16 shrink-0 text-right truncate">{oppName}</span>
              <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${match.total_questions}, minmax(0, 1fr))` }}>
                {Array.from({ length: match.total_questions }).map((_, i) => {
                  const opp = oppAnswers.find((a) => a.question_index === i);
                  return <Pip key={i} ok={opp?.is_correct} answered={!!opp} />;
                })}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0" />
              <div className="flex-1 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${match.total_questions}, minmax(0, 1fr))` }}>
                {Array.from({ length: match.total_questions }).map((_, i) => (
                  <p key={i} className="text-[9px] text-center text-white/40">{i + 1}</p>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-white/50">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-secondary" /> Correct</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-destructive" /> Incorrect</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded bg-white/20" /> Unanswered</span>
          </div>
        </div>
      )}

      {tab === "review" && (
        <div className="space-y-3 max-w-2xl mx-auto">
          {questions.map((q, i) => {
            const mine = myAnswers.find((a) => a.question_index === i);
            const opp = oppAnswers.find((a) => a.question_index === i);
            return (
              <div key={q.id} className="rounded-xl bg-white/5 border border-white/10 p-3 text-left">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-black text-white/60">Q{i + 1}</p>
                  <div className="flex items-center gap-2 text-[10px]">
                    <Badge ok={mine?.is_correct} label={mine ? `You ${(mine.time_taken_ms / 1000).toFixed(1)}s · ${Math.round(mine.points)}pt` : "Skipped"} />
                    <Badge ok={opp?.is_correct} label={opp ? `Opp ${(opp.time_taken_ms / 1000).toFixed(1)}s` : "—"} />
                  </div>
                </div>
                <div className="text-sm text-white mb-2 [&_p]:m-0"><MathRenderer content={q.question_text} /></div>
                <div className="grid gap-1.5">
                  {q.options.map((opt, oi) => {
                    const isCorrect = oi === q.correct_index;
                    const youPicked = mine?.selected_index === oi;
                    const oppPicked = opp?.selected_index === oi;
                    return (
                      <div
                        key={oi}
                        className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${isCorrect
                            ? "bg-secondary/15 border border-secondary/40 text-white"
                            : youPicked
                              ? "bg-destructive/15 border border-destructive/40 text-white"
                              : "bg-white/5 border border-white/10 text-white/80"
                          }`}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] font-black mr-2 align-middle">{String.fromCharCode(65 + oi)}</span>
                          <span className="inline [&_p]:inline [&_p]:m-0"><MathRenderer inline content={opt} /></span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] font-bold">
                          {youPicked && <span className="px-1.5 py-0.5 rounded bg-white/15">YOU</span>}
                          {oppPicked && <span className="px-1.5 py-0.5 rounded bg-white/15">OPP</span>}
                          {isCorrect && <Check className="h-3 w-3 text-secondary" />}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {q.explanation && (
                  <div className="text-[11px] text-white/60 mt-2 italic [&_p]:m-0">💡 <span className="inline [&_p]:inline"><MathRenderer inline content={q.explanation} /></span></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-2xl mx-auto">
        <button onClick={onPlayAgain} className="rounded-lg bg-[#F97415] px-4 py-3 text-sm font-black text-primary-foreground hover:opacity-90 inline-flex items-center justify-center gap-1">
          <RotateCw className="h-4 w-4" /> Play Again
        </button>
        <button onClick={onLobby} className="rounded-lg bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15 inline-flex items-center justify-center gap-1">
          <Home className="h-4 w-4" /> Lobby
        </button>
        <button onClick={handleShare} className="rounded-lg bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/15 inline-flex items-center justify-center gap-1">
          <Share2 className="h-4 w-4" /> Share
        </button>
      </div>
    </div>
  );
};

const Stat = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-center">
    <div className="flex items-center justify-center gap-1">{icon}<span className="text-base font-black text-white">{value}</span></div>
    <p className="text-[10px] uppercase tracking-wider text-white/50 font-bold mt-0.5">{label}</p>
  </div>
);

const TabBtn = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${active ? "bg-primary text-primary-foreground" : "text-white/70 hover:text-white"}`}>{children}</button>
);

const Pip = ({ ok, answered, small }: { ok?: boolean; answered: boolean; small?: boolean }) => {
  const cls = !answered ? "bg-white/10" : ok ? "bg-secondary" : "bg-destructive";
  return <div className={`rounded ${small ? "h-2.5" : "h-4"} w-full ${cls}`} />;
};

const Badge = ({ ok, label }: { ok?: boolean; label: string }) => (
  <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-bold ${ok ? "bg-secondary/20 text-secondary" : ok === false ? "bg-destructive/20 text-destructive" : "bg-white/10 text-white/60"}`}>
    {ok ? <Check className="h-3 w-3" /> : ok === false ? <X className="h-3 w-3" /> : null}
    {label}
  </span>
);


export default CompeteResult;
