import { useEffect, useState } from "react";
import { ArrowLeft, Users, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { Link, useParams } from "react-router-dom";
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
  course_id: string | null;
};

const LiveClassRoomPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const storeUser = useAppStore((s) => s.user);
  const [cls, setCls] = useState<ClassRow | null>(null);
  const [participants, setParticipants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);

  const studentDisplay =
    storeUser?.full_name || (user?.user_metadata?.full_name as string | undefined) || user?.email?.split("@")[0] || "Student";

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase.from("live_classes").select("*").eq("slug", slug).maybeSingle();
      const row = data as ClassRow | null;
      setCls(row);
      if (!row) { setLoading(false); return; }
      const id = row.id;

      if (row.course_id && user) {
        const { data: enrollment } = await supabase
          .from("enrollments")
          .select("is_active")
          .eq("user_id", user.id)
          .eq("course_id", row.course_id)
          .maybeSingle();
        if (!enrollment?.is_active) {
          setHasAccess(false);
          setLoading(false);
          return;
        }
      }

      if (user) {
        await supabase.from("live_class_attendance").upsert(
          { class_id: id, user_id: user.id, joined_at: new Date().toISOString(), status: "joined" },
          { onConflict: "user_id,class_id" },
        );
      }

      const { count } = await supabase
        .from("live_class_attendance")
        .select("*", { count: "exact", head: true })
        .eq("class_id", id);
      setParticipants(count ?? 0);
      setLoading(false);

      const channel = supabase
        .channel(`class-${id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "live_class_attendance", filter: `class_id=eq.${id}` },
          async () => {
            const { count: c } = await supabase
              .from("live_class_attendance")
              .select("*", { count: "exact", head: true })
              .eq("class_id", id);
            setParticipants(c ?? 0);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "live_classes", filter: `id=eq.${id}` },
          (payload) => {
            const updated = payload.new as ClassRow;
            setCls((prev) => {
              if (prev && prev.status !== "completed" && updated.status === "completed") {
                toast("Class has ended", { description: "The teacher has ended this live class.", duration: 6000 });
              }
              return prev ? { ...prev, ...updated } : prev;
            });
          },
        )
        .subscribe();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__liveClassChannel = channel;
    })();

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ch = (window as any).__liveClassChannel;
      if (ch) supabase.removeChannel(ch);
    };
  }, [slug, user]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }
  if (!cls) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">Class not found.</p>
        <Link to="/my-live-classes" className="mt-4 inline-block text-sm text-primary hover:underline">Back to live classes</Link>
      </div>
    );
  }
  if (!hasAccess) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">You need to enroll in this course to access this live class.</p>
        <Link to="/my-live-classes" className="mt-4 inline-block text-sm text-primary hover:underline">Back to live classes</Link>
      </div>
    );
  }

  const isLive = cls.status === "live";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <SEO title={cls.title} description={`Attending ${cls.subject} live class on ARKE Scholars.`} />

      <div className="shrink-0 bg-gradient-to-r from-[hsl(var(--navy))] to-[hsl(var(--navy2))] px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/my-live-classes" className="text-white">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{cls.title}</p>
            <p className="text-[10px] text-white/60">{cls.subject} — {cls.educator_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLive && <LiveBadge />}
          <span className="flex items-center gap-1 text-xs text-white/70">
            <Users className="h-3 w-3" /> {participants}
          </span>
        </div>
      </div>

      {/* Full-width Zoom meeting — no custom chat sidebar */}
      <div className="flex-1 min-h-0 relative bg-[#0a0a0a]">
        {isLive ? (
          cls.zoom_meeting_id ? (
            <ZoomMeetingRoom
              classId={cls.id}
              classSlug={cls.slug}
              displayName={studentDisplay}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 p-6 text-center">
              <p className="text-sm">Meeting not yet configured.</p>
              <p className="text-xs mt-1 opacity-60">Please wait or contact support.</p>
            </div>
          )
        ) : cls.recording_url ? (
          <iframe
            src={cls.recording_url}
            title={cls.title}
            allow="fullscreen"
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white/60 p-6 text-center">
            <p className="text-sm">Class is not live yet.</p>
            <p className="text-xs mt-1">You'll see the meeting automatically when the teacher goes live.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveClassRoomPage;
