import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Crown, Loader2, RefreshCw, RotateCcw, Swords } from "lucide-react";
import { ResultCard } from "@/components/battle/ResultCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { AnswerFeedback, BattleQuestion } from "@/hooks/useBattleRoom";

type ProfileMini = { userId: string; fullName: string; avatarUrl: string | null };

type BattleData = {
  id: string;
  player1_id: string;
  player2_id: string | null;
  winner_id: string | null;
  status: string;
  question_ids: string[];
  class_level: string;
  target_exam: string;
  subject: string;
  topic: string;
};

export default function BattleResult() {
  const { battleId } = useParams<{ battleId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [battle, setBattle] = useState<BattleData | null>(null);
  const [myProfile, setMyProfile] = useState<ProfileMini | null>(null);
  const [opponentProfile, setOpponentProfile] = useState<ProfileMini | null>(null);
  const [myScore, setMyScore] = useState(0);
  const [opponentScore, setOpponentScore] = useState(0);
  const [questions, setQuestions] = useState<BattleQuestion[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, AnswerFeedback>>({});
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!battleId) return;

    (async () => {
      const { data: meData } = await supabase.auth.getUser();
      const myId = meData.user?.id ?? null;
      setMyUserId(myId);

      const { data: b } = await supabase
        .from("battles")
        .select("*")
        .eq("id", battleId)
        .single();

      if (!b) { setLoading(false); return; }
      setBattle(b as BattleData);

      const opponentId = b.player1_id === myId ? b.player2_id : b.player1_id;

      // Profiles
      const ids = [myId, opponentId].filter(Boolean) as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", ids);

      const byId = new Map(
        (profiles ?? []).map((p: { user_id: string; full_name: string; avatar_url: string | null }) => [p.user_id, p]),
      );
      const myP = byId.get(myId ?? "");
      const oppP = byId.get(opponentId ?? "");
      setMyProfile({ userId: myId ?? "", fullName: myP?.full_name ?? "You", avatarUrl: myP?.avatar_url ?? null });
      if (opponentId) {
        setOpponentProfile({ userId: opponentId, fullName: oppP?.full_name ?? "Opponent", avatarUrl: oppP?.avatar_url ?? null });
      }

      // Scores
      const { data: scores } = await supabase
        .from("battle_scores")
        .select("player_id, score")
        .eq("battle_id", battleId);

      setMyScore(scores?.find((s: { player_id: string }) => s.player_id === myId)?.score ?? 0);
      setOpponentScore(scores?.find((s: { player_id: string }) => s.player_id === opponentId)?.score ?? 0);

      // Questions
      if (b.question_ids?.length) {
        const { data: qs } = await supabase
          .from("compete_questions")
          .select("id, question_text, options, difficulty, subject, topic")
          .in("id", b.question_ids);

        const qById = new Map((qs ?? []).map((q) => [q.id, q]));
        setQuestions(b.question_ids.map((id: string) => qById.get(id)).filter(Boolean) as BattleQuestion[]);
      }

      // My answers for breakdown
      const { data: answers } = await supabase
        .from("battle_answers")
        .select("question_id, is_correct, points_earned, selected_option_index, seconds_taken")
        .eq("battle_id", battleId)
        .eq("player_id", myId ?? "");

      const fb: Record<string, AnswerFeedback> = {};
      for (const a of answers ?? []) {
        fb[a.question_id] = {
          questionId: a.question_id,
          isCorrect: a.is_correct,
          pointsEarned: a.points_earned,
          correctOptionIndex: -1,
          selectedOptionIndex: a.selected_option_index,
        };
      }
      setFeedbackMap(fb);
      setLoading(false);
    })();
  }, [battleId]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground py-24">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading results…
      </div>
    );
  }

  if (!battle) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        <p className="text-muted-foreground">Battle not found.</p>
        <Button className="mt-4" onClick={() => navigate("/battle")}>Back to Lobby</Button>
      </div>
    );
  }

  const isWinner = myUserId && battle.winner_id === myUserId;
  const isDraw = battle.winner_id === null;
  const isLoser = !isWinner && !isDraw;

  const resultLabel = isWinner ? "You Won!" : isDraw ? "It's a Draw!" : "You Lost";
  const resultColor = isWinner
    ? "text-emerald-600 dark:text-emerald-400"
    : isDraw
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      {/* Result banner */}
      <div className="text-center space-y-2">
        {isWinner && <Crown className="mx-auto h-12 w-12 text-amber-400" />}
        {!isWinner && <Swords className={cn("mx-auto h-12 w-12", isLoser ? "text-red-400" : "text-amber-400")} />}
        <h1 className={cn("text-3xl font-bold", resultColor)}>{resultLabel}</h1>
      </div>

      {/* Score comparison */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-around">
            {/* Me */}
            <div className="flex flex-col items-center gap-1">
              {myProfile?.avatarUrl ? (
                <img src={myProfile.avatarUrl} alt="you" className="h-12 w-12 rounded-full object-cover ring-2 ring-primary" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center ring-2 ring-primary text-lg font-bold">
                  {(myProfile?.fullName ?? "Y")[0]}
                </div>
              )}
              <span className="text-sm font-semibold truncate max-w-[90px]">{myProfile?.fullName ?? "You"}</span>
              <span className={cn("text-2xl font-bold tabular-nums", isWinner ? "text-emerald-600" : "")}>{myScore}</span>
            </div>

            <span className="text-lg font-bold text-muted-foreground">VS</span>

            {/* Opponent */}
            <div className="flex flex-col items-center gap-1">
              {opponentProfile?.avatarUrl ? (
                <img src={opponentProfile.avatarUrl} alt="opponent" className="h-12 w-12 rounded-full object-cover ring-2 ring-muted" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center ring-2 ring-muted text-lg font-bold">
                  {(opponentProfile?.fullName ?? "O")[0]}
                </div>
              )}
              <span className="text-sm font-semibold truncate max-w-[90px]">{opponentProfile?.fullName ?? "Opponent"}</span>
              <span className="text-2xl font-bold tabular-nums">{opponentScore}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          className="flex-1 gap-2"
          onClick={() =>
            navigate("/battle", {
              state: {
                prefill: {
                  classLevel: battle.class_level,
                  targetExam: battle.target_exam,
                  subject: battle.subject,
                  topic: battle.topic,
                },
              },
            })
          }
        >
          <RefreshCw className="h-4 w-4" />
          Play Again
        </Button>
        <Button variant="outline" className="flex-1 gap-2" onClick={() => navigate("/dashboard")}>
          <RotateCcw className="h-4 w-4" />
          Home
        </Button>
      </div>

      {/* Per-question breakdown */}
      <ResultCard questions={questions} feedbackMap={feedbackMap} />
    </div>
  );
}
