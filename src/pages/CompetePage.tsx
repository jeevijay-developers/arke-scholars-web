import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CompeteLobby from "@/components/compete/CompeteLobby";
import CompeteSearching from "@/components/compete/CompeteSearching";
import CompeteCountdown from "@/components/compete/CompeteCountdown";
import CompeteMatchView from "@/components/compete/CompeteMatch";
import CompeteResult from "@/components/compete/CompeteResult";
import { useCompeteRating } from "@/hooks/useCompeteRating";
import { useCompeteMatch } from "@/hooks/useCompeteMatch";
import { useCompeteTopics } from "@/hooks/useCompeteTopics";
import { useExams } from "@/hooks/useExams";
import { useAuth } from "@/context/AuthContext";

type Phase = "lobby" | "searching" | "countdown" | "match" | "result";
const STORAGE_KEY = "compete:active_match_id";
const BOT_TIMEOUT_MS = 15_000;

const FOUNDATION_CLASSES = ["8", "9", "10"];
const FOUNDATION_EXAM = "Foundation";
const ADVANCED_EXAMS = ["JEE", "NEET"];

function getExamsForClass(classLevel: string, allExams: string[]): string[] {
  if (FOUNDATION_CLASSES.includes(classLevel)) {
    return allExams.filter((e) => e === FOUNDATION_EXAM);
  }
  return allExams.filter((e) => ADVANCED_EXAMS.includes(e));
}

const CompetePage = () => {
  const { user } = useAuth();
  const { rating, refresh } = useCompeteRating();
  const { examNames: exams } = useExams();

  const [phase, setPhase] = useState<Phase>("lobby");
  const [classLevel, setClassLevel] = useState("11");
  const [targetExam, setTargetExam] = useState("JEE");
  const [subject, setSubject] = useState("Physics");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  const pollTimer = useRef<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const realtimeChannel = useRef<any>(null);

  // Capture searching params for the auto-bot fallback closure
  const searchParamsRef = useRef({ subject, selectedTopics, classLevel, targetExam });
  useEffect(() => {
    searchParamsRef.current = { subject, selectedTopics, classLevel, targetExam };
  }, [subject, selectedTopics, classLevel, targetExam]);

  const { match, questions, answers } = useCompeteMatch(matchId);
  const { topics: availableTopics, loading: loadingTopics } = useCompeteTopics(subject, classLevel, targetExam);

  // Pre-fill class + exam from user profile on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("class_level, target_exam")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.class_level) setClassLevel(data.class_level);
        if (data?.target_exam) setTargetExam(data.target_exam);
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume: on mount, look for stored match id and check if it's still active
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    (async () => {
      const { data } = await supabase
        .from("compete_matches")
        .select("id,status,player1_id,player2_id")
        .eq("id", stored)
        .maybeSingle();
      if (!data) { localStorage.removeItem(STORAGE_KEY); return; }
      if (data.player1_id !== user.id && data.player2_id !== user.id) { localStorage.removeItem(STORAGE_KEY); return; }
      if (data.status === "active") {
        setMatchId(stored);
        setPhase("match");
        toast.info("Resumed your match");
      } else if (data.status === "pending") {
        setMatchId(stored);
        setPhase("searching");
        toast.info("Resumed your match");
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    })();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist active match id
  useEffect(() => {
    if (matchId && (phase === "countdown" || phase === "match" || phase === "searching")) {
      localStorage.setItem(STORAGE_KEY, matchId);
    } else if (phase === "lobby" || phase === "result") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [matchId, phase]);

  // Auto-advance phase based on match status + countdown
  useEffect(() => {
    if (!match) return;
    const countdownActive = match.countdown_until && new Date(match.countdown_until).getTime() > Date.now();
    if (match.status === "active" && countdownActive) {
      if (phase !== "countdown") setPhase("countdown");
      const ms = new Date(match.countdown_until!).getTime() - Date.now();
      const t = window.setTimeout(() => setPhase("match"), ms + 50);
      return () => window.clearTimeout(t);
    }
    if (match.status === "active" && !countdownActive && phase !== "match") setPhase("match");
    if (match.status === "finished" && phase !== "result") {
      setPhase("result");
      refresh();
    }
    if (match.status === "pending" && phase === "lobby") setPhase("searching");
  }, [match?.status, match?.countdown_until]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Searching lifecycle ─────────────────────────────────────────────────────

  const stopSearching = () => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
    if (realtimeChannel.current) {
      supabase.removeChannel(realtimeChannel.current);
      realtimeChannel.current = null;
    }
  };

  const startSearching = () => {
    stopSearching();

    // Realtime: fires instantly when opponent sets match_id on our queue row
    const ch = supabase
      .channel(`queue_watch_${user!.id}_${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "compete_queue", filter: `user_id=eq.${user!.id}` },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const mid = payload.new?.match_id;
          if (mid) {
            stopSearching();
            setMatchId(mid);
          }
        },
      )
      .subscribe();
    realtimeChannel.current = ch;

    // Resilience poll + auto-bot after BOT_TIMEOUT_MS
    let elapsed = 0;
    pollTimer.current = window.setInterval(async () => {
      elapsed += BOT_TIMEOUT_MS;

      // Poll edge function as fallback in case realtime missed the update
      try {
        const { data } = await supabase.functions.invoke("compete-matchmake", { body: { action: "poll" } });
        if (data?.status === "matched" && data.match_id) {
          stopSearching();
          setMatchId(data.match_id);
          return;
        }
      } catch { /* ignore poll errors */ }

      // Auto-bot after timeout — silently match without disclosing bot
      stopSearching();
      const { subject: s, selectedTopics: t, classLevel: cl, targetExam: te } = searchParamsRef.current;
      await supabase.functions.invoke("compete-matchmake", { body: { action: "cancel" } }).catch(() => {});
      try {
        const { data: bd, error: be } = await supabase.functions.invoke("compete-matchmake", {
          body: { action: "bot", subject: s, topics: t, classLevel: cl, targetExam: te },
        });
        if (be) throw be;
        if (bd?.match_id) setMatchId(bd.match_id);
        else throw new Error("No match created");
      } catch (e: any) {
        toast.error(e?.message || "Failed to start match");
        setPhase("lobby");
      }
    }, BOT_TIMEOUT_MS);
  };

  useEffect(() => () => stopSearching(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!matchId || !roomCode) return;
    if (match?.status === "active") setRoomCode(null);
  }, [match?.status, matchId, roomCode]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleClassLevel = (c: string) => {
    setClassLevel(c);
    setSelectedTopics([]);
    const validExams = getExamsForClass(c, exams);
    if (!validExams.includes(targetExam)) {
      setTargetExam(validExams.length === 1 ? validExams[0] : "");
    }
  };

  const handleQuickMatch = async () => {
    if (!user) return toast.error("Please sign in");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("compete-matchmake", {
        body: { action: "find", subject, topics: selectedTopics, classLevel, targetExam },
      });
      if (error) throw error;
      if (data.status === "matched") {
        setMatchId(data.match_id);
        setPhase("searching");
      } else {
        setPhase("searching");
        startSearching();
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to start match");
      setPhase("lobby");
    } finally { setBusy(false); }
  };

  const handleCreateRoom = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("compete-create-room", {
        body: { subject, topics: selectedTopics, classLevel, targetExam },
      });
      if (error) throw error;
      setMatchId(data.match_id);
      setRoomCode(data.room_code);
      setPhase("searching");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create room");
    } finally { setBusy(false); }
  };

  const handleJoinRoom = async (code: string) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("compete-join-room", {
        body: { room_code: code },
      });
      if (error) throw error;
      setMatchId(data.match_id);
    } catch (e: any) {
      toast.error(e?.message || "Failed to join room");
    } finally { setBusy(false); }
  };

  const handleCancel = async () => {
    stopSearching();
    try { await supabase.functions.invoke("compete-matchmake", { body: { action: "cancel" } }); } catch {}
    setMatchId(null);
    setRoomCode(null);
    setJoinCode("");
    setPhase("lobby");
  };

  const handleQuit = async () => {
    if (!matchId || !user) return;
    try {
      const opponentId = match?.player1_id === user.id ? match?.player2_id : match?.player1_id;
      await supabase
        .from("compete_matches")
        .update({ status: "finished", winner_id: opponentId ?? null, finished_at: new Date().toISOString() })
        .eq("id", matchId);
    } catch {}
    localStorage.removeItem(STORAGE_KEY);
    setMatchId(null);
    setRoomCode(null);
    setPhase("lobby");
    toast.info("You quit the match.");
  };

  const handlePlayAgain = () => {
    setMatchId(null);
    setRoomCode(null);
    setPhase("lobby");
    refresh();
  };

  return (
    <div className="pb-20 lg:pb-0 min-h-[calc(100vh-57px)] grid-texture" style={{ background: "hsl(var(--navy))" }}>
      <div className="p-4 lg:p-6 min-h-[calc(100vh-57px)] flex items-start lg:items-center justify-center">
        <div className="w-full max-w-2xl">
          {phase === "lobby" && (
            <CompeteLobby
              rating={rating}
              classLevel={classLevel}
              targetExam={targetExam}
              subject={subject}
              selectedTopics={selectedTopics}
              availableTopics={availableTopics}
              loadingTopics={loadingTopics}
              onClassLevel={handleClassLevel}
              onTargetExam={setTargetExam}
              onSubject={setSubject}
              onTopicsChange={setSelectedTopics}
              onQuickMatch={handleQuickMatch}
              onCreateRoom={handleCreateRoom}
              onJoinRoom={handleJoinRoom}
              joinCode={joinCode}
              onJoinCodeChange={setJoinCode}
              busy={busy}
              exams={getExamsForClass(classLevel, exams)}
            />
          )}
          {phase === "searching" && (
            <CompeteSearching
              roomCode={roomCode}
              onCancel={handleCancel}
            />
          )}
          {phase === "countdown" && match && (
            <CompeteCountdown match={match} />
          )}
          {phase === "match" && match && (
            <CompeteMatchView match={match} questions={questions} answers={answers} onQuit={handleQuit} />
          )}
          {phase === "result" && match && (
            <CompeteResult match={match} questions={questions} answers={answers} onPlayAgain={handlePlayAgain} onLobby={handlePlayAgain} />
          )}
        </div>
      </div>
    </div>
  );
};

export default CompetePage;
