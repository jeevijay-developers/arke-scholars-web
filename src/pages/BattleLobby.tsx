import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Swords, X } from "lucide-react";
import { FilterSelector } from "@/components/battle/FilterSelector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBattleMatchmaking } from "@/hooks/useBattleMatchmaking";

export default function BattleLobby() {
  const navigate = useNavigate();
  const { state, enterLobby, cancelLobby } = useBattleMatchmaking();

  // Navigate to battle room once matched
  useEffect(() => {
    if (state.phase === "active" && state.battleId) {
      navigate(`/battle/room/${state.battleId}`, { replace: true });
    }
  }, [state, navigate]);

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-2 text-2xl font-bold">
          <Swords className="h-7 w-7 text-primary" />
          SCQ Battle
        </div>
        <p className="text-sm text-muted-foreground">
          Challenge a student to a real-time 1v1 quiz battle
        </p>
      </div>

      {state.phase === "error" && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {state.message}
        </div>
      )}

      {/* Waiting for opponent screen */}
      {state.phase === "waiting" && state.battleId && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6">
            <div className="relative flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
              <div className="absolute inset-2 animate-ping rounded-full bg-primary/30 delay-150" />
              <Loader2 className="relative h-10 w-10 animate-spin text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold">Waiting for an opponent…</p>
              <p className="text-sm text-muted-foreground">
                Your lobby is open. Share this page or ask a friend to select the same filters!
              </p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={cancelLobby}>
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filter selection */}
      {(state.phase === "idle" || state.phase === "error") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Battle Filters</CardTitle>
            <CardDescription>
              Both players must choose the same Class, Exam, Subject, and Topic to be matched together.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FilterSelector
              onEnterLobby={enterLobby}
              busy={state.phase === "waiting" as unknown as boolean}
            />
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      {state.phase === "idle" && (
        <div className="rounded-xl border bg-muted/30 px-5 py-4 space-y-2 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">How it works</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Answer 10 questions as fast as you can</li>
            <li>Speed bonus: up to +58 pts for an instant correct answer</li>
            <li>Each question has a 30-second timer — unanswered = 0 pts</li>
            <li>Live scores update in real-time as you both play</li>
          </ul>
        </div>
      )}
    </div>
  );
}
