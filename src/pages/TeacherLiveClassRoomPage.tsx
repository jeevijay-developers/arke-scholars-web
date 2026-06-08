import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Users, Loader2, Play, Square, Video } from "lucide-react";
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
  meeting_url: string | null;
  recording_url: string | null;
  starts_at: string;
  ends_at: string | null;
  created_by: string | null;
  description: string | null;
  zoom_meeting_id: string | null;
  zoom_meeting_password: string | null;
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
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

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

      await refreshAttendees();
      if (!cancelled) setLoading(false);

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

      {/* Main video area — full width, Zoom handles everything */}
      <div className="flex-1 min-h-0 bg-[#0a0a0a]">
        {isLive ? (
          cls.zoom_meeting_id ? (
            <div className="h-full w-full">
              <ZoomMeetingRoom
                meetingNumber={cls.zoom_meeting_id}
                password={cls.zoom_meeting_password ?? ""}
                classSlug={cls.slug}
                role="host"
                displayName={teacherDisplay}
                onLeave={() => navigate("/teacher/live-classes")}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-white/60 text-sm px-4 text-center">
              Zoom meeting not configured for this class. Please recreate it from admin.
            </div>
          )
        ) : isCompleted && cls.recording_url ? (
          <iframe
            src={cls.recording_url}
            title={cls.title}
            allow="fullscreen"
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-white/60 px-4 text-center">
            <Video className="h-10 w-10 mb-2 opacity-60" />
            <p className="text-sm">Click "Start class" to begin your live stream.</p>
            <p className="text-xs mt-1 opacity-60">Students will connect automatically when you go live.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherLiveClassRoomPage;
