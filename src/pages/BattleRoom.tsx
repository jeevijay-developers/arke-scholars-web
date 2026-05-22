import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { QuestionCard } from "@/components/battle/QuestionCard";
import { LiveScorePanel } from "@/components/battle/LiveScorePanel";
import { useBattleRoom } from "@/hooks/useBattleRoom";
import { supabase } from "@/integrations/supabase/client";

type ProfileMini = { userId: string; fullName: string; avatarUrl: string | null };

export default function BattleRoom() {
  const { battleId } = useParams<{ battleId: string }>();
  const navigate = useNavigate();
  const { state, handleAnswer } = useBattleRoom(battleId ?? null);

  const [myProfile, setMyProfile] = useState<ProfileMini | null>(null);
  const [opponentProfile, setOpponentProfile] = useState<ProfileMini | null>(null);

  // Load player profiles once battle is known
  useEffect(() => {
    if (!state.battle) return;

    const loadProfiles = async () => {
      const { data: me } = await supabase.auth.getUser();
      const myId = me.user?.id ?? "";

      const opponentId =
        state.battle!.player1_id === myId
          ? state.battle!.player2_id
          : state.battle!.player1_id;

      const ids = [myId, opponentId].filter(Boolean) as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", ids);

      const byId = new Map(
        (profiles ?? []).map((p: { user_id: string; full_name: string; avatar_url: string | null }) => [p.user_id, p]),
      );

      const myP = byId.get(myId);
      setMyProfile({ userId: myId, fullName: myP?.full_name ?? "You", avatarUrl: myP?.avatar_url ?? null });

      if (opponentId) {
        const oppP = byId.get(opponentId);
        setOpponentProfile({
          userId: opponentId,
          fullName: oppP?.full_name ?? "Opponent",
          avatarUrl: oppP?.avatar_url ?? null,
        });
      }
    };

    loadProfiles();
  }, [state.battle?.player1_id, state.battle?.player2_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate to results when battle finishes
  useEffect(() => {
    if (state.phase === "finished" && battleId) {
      // Small delay so the last feedback is visible
      const t = setTimeout(() => {
        navigate(`/battle/result/${battleId}`, { replace: true });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [state.phase, battleId, navigate]);

  if (state.phase === "loading") {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-muted-foreground py-24">
        <Loader2 className="h-6 w-6 animate-spin" />
        Loading battle…
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center text-destructive space-y-2">
        <p className="font-semibold">Something went wrong</p>
        <p className="text-sm">{state.error}</p>
      </div>
    );
  }

  const currentQuestion = state.questions[state.currentIndex];

  return (
    <div className="mx-auto max-w-xl px-4 py-6 space-y-5">
      {/* Live score panel */}
      <LiveScorePanel
        myScore={state.myScore}
        opponentScore={state.opponentScore}
        myName={myProfile?.fullName ?? "You"}
        myAvatar={myProfile?.avatarUrl ?? null}
        opponentName={opponentProfile?.fullName ?? "Opponent"}
        opponentAvatar={opponentProfile?.avatarUrl ?? null}
        totalQuestions={state.questions.length}
      />

      {/* Question */}
      {currentQuestion && state.phase === "battling" && (
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <QuestionCard
            question={currentQuestion}
            questionNumber={state.currentIndex + 1}
            totalQuestions={state.questions.length}
            timeLeft={state.timeLeft}
            feedback={state.feedbackMap[currentQuestion.id] ?? null}
            submitting={state.submitting}
            onAnswer={handleAnswer}
          />
        </div>
      )}

      {/* Transitioning to results */}
      {state.phase === "finished" && (
        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="font-medium">Battle complete — loading results…</p>
        </div>
      )}
    </div>
  );
}
