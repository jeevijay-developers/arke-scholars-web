import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Users, Loader2, Play, Square, Video, MessageSquare, Send, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";
import LiveBadge from "@/components/LiveBadge";
import ZoomMeetingRoom from "@/components/ZoomMeetingRoom";

type ClassRow = {
  id: string;
  slug: string;
  title: string;
  subject: string;
  educator_name: string;
  status: string;
  zoom_meeting_id: string | null;
  zoom_meeting_password: string | null;
  recording_url: string | null;
  starts_at: string;
  ends_at: string | null;
  created_by: string | null;
  description: string | null;
};

type Attendee = {
  user_id: string;
  status: string;
  joined_at: string | null;
  display_name?: string;
};

type ChatMsg = {
  id: string;
  user_id: string;
  display_name: string;
  is_teacher: boolean;
  message: string;
  created_at: string;
};

const TeacherLiveClassRoomPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const storeUser = useAppStore((s) => s.user);
  const navigate = useNavigate();

  const [cls, setCls] = useState<ClassRow | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

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
        const { data: rows } = await supabase
          .from("live_class_attendance")
          .select("user_id, status, joined_at")
          .eq("class_id", id);
        const ids = (rows ?? []).map((r) => r.user_id);
        let names: Record<string, string> = {};
        if (ids.length) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("user_id, full_name")
            .in("user_id", ids);
          names = Object.fromEntries(
            (profs ?? []).map((p) => [p.user_id, p.full_name?.trim() || "Student"]),
          );
        }
        if (!cancelled) {
          setAttendees(
            (rows ?? []).map((r) => ({ ...r, display_name: names[r.user_id] || "Student" })) as Attendee[],
          );
        }
      };

      await refreshAttendees();
      if (!cancelled) setLoading(false);

      // Load initial messages
      const { data: msgs } = await supabase
        .from("live_class_messages")
        .select("*")
        .eq("class_id", id)
        .order("created_at")
        .limit(100);
      if (!cancelled) setMessages((msgs ?? []) as ChatMsg[]);

      channel = supabase
        .channel(`teacher-class-${id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "live_class_attendance", filter: `class_id=eq.${id}` },
          () => refreshAttendees(),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "live_classes", filter: `id=eq.${id}` },
          (payload) => { setCls((prev) => (prev ? { ...prev, ...(payload.new as ClassRow) } : prev)); },
        )
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "live_class_messages", filter: `class_id=eq.${id}` },
          (payload) => {
            setMessages((prev) => [...prev, payload.new as ChatMsg]);
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
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  const sendMessage = async () => {
    if (!chatInput.trim() || !cls || !user) return;
    setSending(true);
    const text = chatInput.trim();
    setChatInput("");
    const { error } = await supabase.from("live_class_messages").insert({
      class_id: cls.id,
      user_id: user.id,
      display_name: teacherDisplay,
      is_teacher: true,
      message: text,
    });
    setSending(false);
    if (error) toast.error("Failed to send message");
  };

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
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 text-xs text-primary-foreground/80 hover:text-primary-foreground"
          >
            <Users className="h-3 w-3" /> {attendees.length}
          </button>
          <button
            onClick={() => setChatOpen((v) => !v)}
            className="relative flex items-center gap-1 text-xs text-primary-foreground/80 hover:text-primary-foreground"
          >
            <MessageSquare className="h-4 w-4" />
            {messages.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                {messages.length > 99 ? "99+" : messages.length}
              </span>
            )}
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
            <button
              onClick={endClass}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-bold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
            >
              <Square className="h-3.5 w-3.5" /> End class
            </button>
          )}
          {isCompleted && (
            <span className="rounded-lg bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">Completed</span>
          )}
        </div>
      </div>

      {/* Attendees drawer */}
      {showDetails && (
        <div className="shrink-0 border-b border-border bg-card px-4 py-3">
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
      )}

      {/* Main area + optional chat sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* Zoom / video area */}
      <div className="flex-1 min-h-0 relative bg-[#0a0a0a]">
        {isLive ? (
          cls.zoom_meeting_id ? (
            <ZoomMeetingRoom
              classId={cls.id}
              classSlug={cls.slug}
              displayName={teacherDisplay}
              onLeave={() => navigate("/teacher/live-classes")}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 gap-2 px-4 text-center">
              <Video className="h-10 w-10 opacity-40" />
              <p className="text-sm">Zoom meeting not configured.</p>
              <p className="text-xs opacity-60">Re-create this class from admin to generate a Zoom meeting.</p>
            </div>
          )
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
            <p className="text-sm">Click "Start class" to launch the Zoom meeting.</p>
            <p className="text-xs mt-1 opacity-60">Students connect automatically when you go live.</p>
          </div>
        )}
      </div>

      {/* Chat sidebar */}
      {chatOpen && (
        <div className="w-80 shrink-0 flex flex-col border-l border-border bg-[hsl(var(--navy))] text-white">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-bold">Student Messages</span>
            <button onClick={() => setChatOpen(false)} className="text-white/60 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
            {messages.length === 0 ? (
              <p className="text-center text-xs text-white/40 mt-8">No messages yet.</p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex flex-col gap-0.5 ${m.is_teacher ? "items-end" : "items-start"}`}>
                  <span className="text-[10px] text-white/40">{m.display_name}{m.is_teacher ? " (you)" : ""}</span>
                  <div className={`max-w-[90%] rounded-xl px-3 py-1.5 text-sm ${m.is_teacher ? "bg-indigo-600 text-white" : "bg-white/10 text-white"}`}>
                    {m.message}
                  </div>
                </div>
              ))
            )}
            <div ref={chatBottomRef} />
          </div>
          <div className="px-3 py-3 border-t border-white/10 flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Reply to students…"
              className="flex-1 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={sendMessage}
              disabled={sending || !chatInput.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

export default TeacherLiveClassRoomPage;
