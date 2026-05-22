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

const CompetePage = () => {
  const { user } = useAuth();
  const { rating, refresh } = useCompeteRating();
  const { examNames: exams } = useExams();

  const [phase, setPhase] = useState<Phase>("lobby");
  const [classLevel, setClassLevel] = useState("11");
  const [targetExam, setTargetExam] = useState("JEE Main");
  const [subject, setSubject] = useState("Physics");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const pollTimer = useRef<number | null>(null);

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

  const startPolling = () => {
    stopPolling();
    pollTimer.current = window.setInterval(async () => {
      try {
        const { data } = await supabase.functions.invoke("compete-matchmake", { body: { action: "poll" } });
        if (data?.status === "matched" && data.match_id) {
          setMatchId(data.match_id);
          stopPolling();
        }
      } catch { /* ignore */ }
    }, 3000);
  };
  const stopPolling = () => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  };
  useEffect(() => () => stopPolling(), []);

  useEffect(() => {
    if (!matchId || !roomCode) return;
    if (match?.status === "active") setRoomCode(null);
  }, [match?.status, matchId, roomCode]);

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
        startPolling();
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to start match");
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

  const handlePracticeBot = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("compete-matchmake", {
        body: { action: "bot", subject, topics: selectedTopics, classLevel, targetExam },
      });
      if (error) throw error;
      setMatchId(data.match_id);
    } catch (e: any) {
      toast.error(e?.message || "Failed to start bot match");
    } finally { setBusy(false); }
  };

  const handleCancel = async () => {
    stopPolling();
    try { await supabase.functions.invoke("compete-matchmake", { body: { action: "cancel" } }); } catch {}
    setMatchId(null);
    setRoomCode(null);
    setJoinCode("");
    setPhase("lobby");
  };

  const handleBotFallback = async () => {
    stopPolling();
    await handlePracticeBot();
  };

  const handleQuit = async () => {
    if (!matchId || !user) return;
    try {
      const opponentId = match?.player1_id === user.id ? match?.player2_id : match?.player1_id;
      await supabase
        .from("compete_matches")
        .update({
          status: "finished",
          winner_id: opponentId ?? null,
          finished_at: new Date().toISOString(),
        })
        .eq("id", matchId);
    } catch {}
    localStorage.removeItem(STORAGE_KEY);
    setMatchId(null);
    setRoomCode(null);
    setPhase("lobby");
    toast.info("You forfeited the match.");
  };

  const handlePlayAgain = () => {
    setMatchId(null);
    setRoomCode(null);
    setPhase("lobby");
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
            onClassLevel={setClassLevel}
            onTargetExam={setTargetExam}
            onSubject={setSubject}
            onTopicsChange={setSelectedTopics}
            onQuickMatch={handleQuickMatch}
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onPracticeBot={handlePracticeBot}
            joinCode={joinCode}
            onJoinCodeChange={setJoinCode}
            busy={busy}
            exams={exams}
          />
        )}
        {phase === "searching" && (
          <CompeteSearching
            roomCode={roomCode}
            onCancel={handleCancel}
            onBotFallback={handleBotFallback}
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
