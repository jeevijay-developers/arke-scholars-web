import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, Users, Loader2, Play, Square, Video } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";
import LiveBadge from "@/components/LiveBadge";
import arkeLogo from "@/assets/arke-logo.jpeg";

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
  const [recordingUrl, setRecordingUrl] = useState("");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const teacherDisplay = useMemo(
    () => storeUser?.full_name || (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "Teacher",
    [storeUser?.full_name, user?.user_metadata, user?.email],
  );

  // Load class + chat + attendees, and subscribe to realtime
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
      // Auth gate — only the owner teacher can host
      if (data.created_by && data.created_by !== user.id) {
        toast.error("You're not the host of this class");
        navigate("/teacher/live-classes");
        return;
      }
      if (cancelled) return;
      setCls(data as ClassRow);
      setRecordingUrl(data.recording_url ?? "");
      const id = data.id;

      const refreshAttendees = async () => {
        const { data: rows } = await supabase
          .from("live_class_attendance")
          .select("user_id, status, joined_at")
          .eq("class_id", id);
        const ids = (rows ?? []).map((r) => r.user_id);
        let names: Record<string, string> = {};
        if (ids.length) {
          const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", ids);
          names = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.full_name || "Student"]));
        }
        if (!cancelled) {
          setAttendees(
            (rows ?? []).map((r) => ({ ...r, display_name: names[r.user_id] || "Student" })) as Attendee[],
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
          (payload) => setMessages((prev) => [...prev, payload.new as Message]),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "live_class_attendance", filter: `class_id=eq.${id}` },
          () => refreshAttendees(),
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "live_classes", filter: `id=eq.${id}` },
          (payload) => setCls((prev) => (prev ? { ...prev, ...(payload.new as ClassRow) } : prev)),
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
    const { error } = await supabase.from("live_class_messages").insert({
      class_id: cls.id,
      user_id: user.id,
      display_name: teacherDisplay,
      is_teacher: true,
      message: text.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
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
      .update({
        status: "completed",
        ends_at: new Date().toISOString(),
        recording_url: recordingUrl.trim() || null,
      })
      .eq("id", cls.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Class ended");
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
  const rawSrc = cls.meeting_url || cls.recording_url;
  const videoSrc = rawSrc
    ? (() => {
        const isJitsi = /jit\.si|jitsi/i.test(rawSrc);
        if (!isJitsi) return rawSrc;
        const flags = [
          "config.disableDeepLinking=true",
          "interfaceConfig.SHOW_JITSI_WATERMARK=false",
          "interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false",
          "interfaceConfig.SHOW_BRAND_WATERMARK=false",
          "interfaceConfig.SHOW_POWERED_BY=false",
          "interfaceConfig.HIDE_DEEP_LINKING_LOGO=true",
        ].join("&");
        const sep = rawSrc.includes("#") ? "&" : "#";
        return `${rawSrc}${sep}${flags}`;
      })()
    : null;

  return (
    <div className="flex flex-col">
      {/* Header bar */}
      <div className="bg-gradient-to-r from-[hsl(var(--navy))] to-[hsl(var(--navy2))] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
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
          <span className="flex items-center gap-1 text-xs text-primary-foreground/80">
            <Users className="h-3 w-3" /> {attendees.length}
          </span>
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

      {/* Body — split pane on md+ */}
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-57px-52px)]">
        <div className="flex-1 min-w-0">
          <div className="relative aspect-video bg-[hsl(var(--navy))] flex items-center justify-center">
            {videoSrc ? (
              <>
                <iframe
                  src={videoSrc}
                  title={cls.title}
                  allow="camera; microphone; fullscreen; display-capture; autoplay"
                  className="absolute inset-0 h-full w-full"
                />
                <div className="pointer-events-none absolute top-2 left-2 md:top-3 md:left-3 z-10 flex items-center gap-2 rounded-lg bg-black/70 px-2.5 py-1 backdrop-blur-sm">
                  <img src={arkeLogo} alt="Arke Scholars" className="h-5 md:h-6 w-auto rounded" />
                  <span className="text-[10px] md:text-xs font-bold text-white tracking-wide">Arke Scholars</span>
                </div>
              </>
            ) : (
              <div className="text-center text-primary-foreground/70 px-4">
                <Video className="h-10 w-10 mx-auto mb-2 opacity-60" />
                <p className="text-sm">No meeting URL set for this class.</p>
                <p className="text-xs mt-1">Edit the class to add a Jitsi/Meet/Zoom link.</p>
              </div>
            )}
          </div>

          <div className="p-4 lg:p-6 space-y-4">

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-bold text-foreground mb-2">Class details</p>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-xs">
                <div><dt className="text-muted-foreground">Subject</dt><dd className="font-semibold text-foreground">{cls.subject}</dd></div>
                <div><dt className="text-muted-foreground">Scheduled</dt><dd className="font-semibold text-foreground">{new Date(cls.starts_at).toLocaleString()}</dd></div>
                <div className="sm:col-span-2"><dt className="text-muted-foreground">Description</dt><dd className="font-medium text-foreground">{cls.description || "—"}</dd></div>
              </dl>
            </div>

            {(isLive || isCompleted) && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm font-bold text-foreground mb-2">Recording URL (optional)</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={recordingUrl}
                    onChange={(e) => setRecordingUrl(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button
                    onClick={async () => {
                      if (!cls) return;
                      const { error } = await supabase
                        .from("live_classes")
                        .update({ recording_url: recordingUrl.trim() || null })
                        .eq("id", cls.id);
                      if (error) toast.error(error.message);
                      else toast.success("Recording link saved");
                    }}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Attendees ({attendees.length})
              </p>
              {attendees.length === 0 ? (
                <p className="text-xs text-muted-foreground">No students have joined yet.</p>
              ) : (
                <ul className="space-y-2 max-h-64 overflow-y-auto">
                  {attendees.map((a) => (
                    <li key={a.user_id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground truncate">{a.display_name}</span>
                      <span className="text-muted-foreground">
                        {a.joined_at ? new Date(a.joined_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : a.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Chat sidebar — splits at md */}
        <aside className="md:w-[300px] lg:w-[340px] border-t md:border-t-0 md:border-l border-border bg-card flex flex-col h-[60vh] md:h-auto md:sticky md:top-[57px] md:self-start md:max-h-[calc(100vh-57px)]">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-bold text-foreground">Live chat</p>
            <p className="text-[10px] text-muted-foreground">{messages.length} messages — you appear as TEACHER</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="p-3 border-t border-border flex gap-2"
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
