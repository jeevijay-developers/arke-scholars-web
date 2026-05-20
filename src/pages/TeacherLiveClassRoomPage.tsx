import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, Users, Loader2, Play, Square, Video, Circle } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";
import LiveBadge from "@/components/LiveBadge";
import AgoraVideoRoom from "@/components/AgoraVideoRoom";

type ClassRow = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  educator_name: string;
  status: string;
  meeting_url: string | null;
  recording_url: string | null;
  starts_at: string;
  ends_at: string | null;
  created_by: string | null;
  description: string | null;
};

type Message = {
  id: string;
  user_id: string;
  display_name: string;
  is_teacher: boolean;
  message: string;
  created_at: string;
};

type Attendee = {
  user_id: string;
  status: string;
  joined_at: string | null;
  display_name?: string;
};

const TeacherLiveClassRoomPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const storeUser = useAppStore((s) => s.user);
  const navigate = useNavigate();

  const [cls, setCls] = useState<ClassRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [recordingActive, setRecordingActive] = useState(false);
  const [recordingIds, setRecordingIds] = useState<{ resourceId: string; sid: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const teacherDisplay = useMemo(
    () => storeUser?.full_name || (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "Teacher",
    [storeUser?.full_name, user?.user_metadata, user?.email],
  );

  useEffect(() => {
    if (!slug || !user) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data, error } = await supabase.from("live_classes").select("*").eq("slug", slug).maybeSingle();
      if (error || !data) {
        toast.error("Class not found");
        navigate("/teacher/live-classes");
        return;
      }
      if (data.created_by !== null && data.created_by !== undefined && data.created_by !== user.id) {
        toast.error("You are not the host of this class");
        navigate("/teacher/live-classes");
        return;
      }
      if (cancelled) return;
      setCls(data as ClassRow);
      const id = data.id;

      const refreshAttendees = async () => {
        const { data: rows, error: attErr } = await supabase
          .from("live_class_attendance")
          .select("user_id, status, joined_at")
          .eq("class_id", id);
        if (attErr) console.error("[Attendees] fetch failed:", attErr.message);

        const ids = (rows ?? []).map((r) => r.user_id);
        let names: Record<string, string> = {};
        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", ids);
          // Fall back to "Student" if profile row missing or full_name is blank
          names = Object.fromEntries(
            (profs ?? []).map((p) => [p.user_id, p.full_name?.trim() || "Student"]),
          );
        }
        if (!cancelled) {
          setAttendees(
            (rows ?? []).map((r) => ({
              ...r,
              display_name: names[r.user_id] || "Student",
            })) as Attendee[],
          );
        }
      };

      const { data: msgs } = await supabase
        .from("live_class_messages")
        .select("*")
        .eq("class_id", id)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((msgs ?? []) as Message[]);

      await refreshAttendees();
      if (!cancelled) setLoading(false);

      channel = supabase
        .channel(`teacher-class-${id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "live_class_messages", filter: `class_id=eq.${id}` },
          (payload) => {
            const incoming = payload.new as Message;
            // Deduplicate: skip if a real row with this id already exists (optimistic already replaced it)
            setMessages((prev) =>
              prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
            );
          },
        )
        .on(
          "postgres_changes",
          // Listen to all events (INSERT, UPDATE, DELETE) on attendance
          { event: "*", schema: "public", table: "live_class_attendance", filter: `class_id=eq.${id}` },
          () => refreshAttendees(),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "live_classes", filter: `id=eq.${id}` },
          (payload) => {
            setCls((prev) => (prev ? { ...prev, ...(payload.new as ClassRow) } : prev));
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [slug, user, navigate]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!user || !cls || !text.trim()) return;
    const trimmed = text.trim();
    setText("");

    // Optimistic insert — show immediately, deduplicated when realtime event arrives
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      user_id: user.id,
      display_name: teacherDisplay,
      is_teacher: true,
      message: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase.from("live_class_messages").insert({
      class_id: cls.id,
      user_id: user.id,
      display_name: teacherDisplay,
      is_teacher: true,
      message: trimmed,
    }).select().single();

    if (error) {
      toast.error(error.message);
      // Roll back the optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setText(trimmed);
      return;
    }
    // Replace optimistic with real row (has the DB-generated id)
    if (data) {
      setMessages((prev) => prev.map((m) => m.id === optimisticId ? (data as Message) : m));
    }
  };

  // const toggleRecording = async () => {
  //   // TODO: Wire up Agora Cloud Recording once credentials are available.
  //   // Requires: AGORA_CUSTOMER_ID, AGORA_CUSTOMER_SECRET (from console.agora.io → RESTful API)
  //   // and a cloud storage bucket (S3/GCS/Supabase Storage S3-compatible).
  //   // Edge function: supabase/functions/agora-recording/index.ts
  //   // On stop: save returned recording URL to live_classes.recording_url
  //   if (isRecording) {
  //     setIsRecording(false);
  //     toast.info("Recording stopped (cloud recording not yet configured)");
  //   } else {
  //     setIsRecording(true);
  //     toast.info("Recording started (cloud recording not yet configured)");
  //   }
  // };

  const startClass = async () => {
    if (!cls) return;
    setBusy(true);
    const { error } = await supabase.from("live_classes").update({ status: "live" }).eq("id", cls.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Class is now live");
  };

  const endClass = async () => {
    if (!cls) return;
    setBusy(true);
    const { error } = await supabase
      .from("live_classes")
      .update({ status: "completed", ends_at: new Date().toISOString() })
      .eq("id", cls.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Class ended");
    navigate("/teacher/dashboard");
  };

  const startRecording = async () => {
    if (!cls) return;
    setBusy(true);
    try {
      const isDev = import.meta.env.DEV;
      const url = isDev
        ? "/api/agora-cloud-recording"
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agora-cloud-recording`;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (!isDev) {
        headers["apikey"] = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        headers["Authorization"] = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "start",
          channelName: cls.id,
          classId: cls.id,
          uid: user?.id || "teacher",
        }),
      });

      const data = await res.json() as { success?: boolean; resourceId?: string; sid?: string; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to start recording");
      }

      setRecordingActive(true);
      setRecordingIds({
        resourceId: data.resourceId || "",
        sid: data.sid || "",
      });
      toast.success("Recording started");
    } catch (e) {
      console.error("[Recording] Start error:", e);
      toast.error(e instanceof Error ? e.message : "Failed to start recording");
    } finally {
      setBusy(false);
    }
  };

  const stopRecording = async () => {
    if (!cls || !recordingIds) return;
    setBusy(true);
    try {
      const isDev = import.meta.env.DEV;
      const url = isDev
        ? "/api/agora-cloud-recording"
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agora-cloud-recording`;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (!isDev) {
        headers["apikey"] = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
        headers["Authorization"] = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "stop",
          channelName: cls.id,
          classId: cls.id,
          uid: user?.id || "teacher",
          resourceId: recordingIds.resourceId,
          sid: recordingIds.sid,
        }),
      });

      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to stop recording");
      }

      setRecordingActive(false);
      setRecordingIds(null);
      toast.success("Recording saved and will appear in playback");
    } catch (e) {
      console.error("[Recording] Stop error:", e);
      toast.error(e instanceof Error ? e.message : "Failed to stop recording");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }
  if (!cls) return null;

  const isLive = cls.status === "live";
  const isCompleted = cls.status === "completed";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-gradient-to-r from-[hsl(var(--navy))] to-[hsl(var(--navy2))] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/teacher/live-classes" className="text-primary-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-sm font-bold text-primary-foreground truncate">{cls.title}</p>
            <p className="text-[10px] text-primary-foreground/70">{cls.subject} — Hosting as {teacherDisplay}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isLive && <LiveBadge />}
          {recordingActive && (
            <div className="flex items-center gap-1.5 rounded-full bg-red-500 px-2 py-0.5">
              <Circle className="h-2 w-2 fill-current text-white animate-pulse" />
              <span className="text-xs font-bold text-white">REC</span>
            </div>
          )}
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary-foreground/80 hover:text-primary-foreground"
          >
            <Users className="h-3 w-3" /> {attendees.length}
          </button>
          {!isLive && !isCompleted && (
            <button
              onClick={startClass}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Play className="h-3.5 w-3.5" /> Start class
            </button>
          )}
          {isLive && (
            <>
              {!recordingActive ? (
                <button
                  onClick={startRecording}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
                >
                  <Circle className="h-3 w-3" /> Record
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
                >
                  <Square className="h-3.5 w-3.5" /> Stop rec
                </button>
              )}
              <button
                onClick={endClass}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Square className="h-3.5 w-3.5" /> End class
              </button>
            </>
          )}
          {isCompleted && (
            <span className="rounded-lg bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">Completed</span>
          )}
        </div>
      </div>

      {/* Attendees / details drawer (shown when toggled) */}
      {showDetails && (
        <div className="shrink-0 border-b border-border bg-card px-4 py-3 space-y-3">
          <div>
            <p className="text-xs font-bold text-foreground mb-1 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" /> Attendees ({attendees.length})
            </p>
            {attendees.length === 0 ? (
              <p className="text-xs text-muted-foreground">No students have joined yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {attendees.map((a) => (
                  <li key={a.user_id} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs">
                    <span className="font-medium text-foreground">{a.display_name}</span>
                    {a.joined_at && (
                      <span className="text-muted-foreground">
                        · {new Date(a.joined_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Main body — same split-pane layout as student page */}
      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        {/* Video area — fills remaining height like student page */}
        <div className="relative flex-1 min-h-0 bg-[#0a0a0a]">
          {isLive ? (
            <div className="absolute inset-0">
              <AgoraVideoRoom channelName={cls.id} role="host" />
            </div>
          ) : isCompleted && cls.recording_url ? (
            <iframe
              src={cls.recording_url}
              title={cls.title}
              allow="fullscreen"
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 px-4 text-center">
              <Video className="h-10 w-10 mb-2 opacity-60" />
              <p className="text-sm">Click "Start class" to begin your live stream.</p>
              <p className="text-xs mt-1 opacity-60">Students will connect automatically when you go live.</p>
            </div>
          )}
        </div>

        {/* Chat sidebar */}
        <aside className="flex flex-col min-h-0 h-[45vh] md:h-auto md:w-[300px] lg:w-[340px] border-t md:border-t-0 md:border-l border-border bg-card">
          <div className="shrink-0 px-4 py-3 border-b border-border">
            <p className="text-sm font-bold text-foreground">Live chat</p>
            <p className="text-[10px] text-muted-foreground">{messages.length} messages — you appear as TEACHER</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No messages yet.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className="flex items-start gap-2">
                  <div className={`h-7 w-7 shrink-0 rounded-full text-[10px] font-bold flex items-center justify-center ${m.is_teacher ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                    {m.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground">
                      {m.display_name}
                      {m.is_teacher && <span className="ml-1 text-[9px] font-bold text-primary">TEACHER</span>}
                    </p>
                    <p className="text-xs text-foreground break-words">{m.message}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="shrink-0 p-3 border-t border-border flex gap-2 bg-card"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message students..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
            />
            <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
};

export default TeacherLiveClassRoomPage;
