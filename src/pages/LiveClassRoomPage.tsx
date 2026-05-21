import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Users, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { Link, useParams } from "react-router-dom";
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
  course_id: string | null;
};

type Message = {
  id: string;
  user_id: string;
  display_name: string;
  is_teacher: boolean;
  message: string;
  created_at: string;
};

const LiveClassRoomPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const storeUser = useAppStore((s) => s.user);
  const [cls, setCls] = useState<ClassRow | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [participants, setParticipants] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase.from("live_classes").select("*").eq("slug", slug).maybeSingle();
      const row = data as ClassRow | null;
      setCls(row);
      if (!row) {
        setLoading(false);
        return;
      }
      const id = row.id;

      // Check enrollment if class is course-linked
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

      const { data: msgs } = await supabase
        .from("live_class_messages")
        .select("*")
        .eq("class_id", id)
        .order("created_at", { ascending: true });
      setMessages((msgs ?? []) as Message[]);

      // Auto-attendance: upsert — constraint is UNIQUE(user_id, class_id)
      if (user) {
        const { error: attErr } = await supabase.from("live_class_attendance").upsert(
          {
            class_id: id,
            user_id: user.id,
            joined_at: new Date().toISOString(),
            status: "joined",
          },
          { onConflict: "user_id,class_id" },
        );
        if (attErr) console.error("[Attendance] upsert failed:", attErr.message);
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
          { event: "INSERT", schema: "public", table: "live_class_messages", filter: `class_id=eq.${id}` },
          (payload) => {
            const incoming = payload.new as Message;
            setMessages((prev) =>
              prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
            );
          },
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "live_class_attendance", filter: `class_id=eq.${id}` },
          async () => {
            const { count } = await supabase
              .from("live_class_attendance")
              .select("*", { count: "exact", head: true })
              .eq("class_id", id);
            setParticipants(count ?? 0);
          },
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "live_classes", filter: `id=eq.${id}` },
          (payload) => {
            const updated = payload.new as ClassRow;
            setCls((prev) => {
              if (prev && prev.status !== "completed" && updated.status === "completed") {
                toast("Class has ended", {
                  description: "The teacher has ended this live class.",
                  duration: 6000,
                });
              }
              return prev ? { ...prev, ...updated } : prev;
            });
          },
        )
        .subscribe();

      // Cleanup stored on element ref to remove on unmount
      (window as any).__liveClassChannel = channel;
    })();

    return () => {
      const ch = (window as any).__liveClassChannel;
      if (ch) supabase.removeChannel(ch);
    };
  }, [slug, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!user || !cls || !text.trim()) return;
    const display = storeUser?.full_name || user.email?.split("@")[0] || "Student";
    const trimmed = text.trim();
    setText("");

    // Optimistic insert — message appears instantly, deduplicated on realtime event
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      user_id: user.id,
      display_name: display,
      is_teacher: false,
      message: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase.from("live_class_messages").insert({
      class_id: cls.id,
      user_id: user.id,
      display_name: display,
      is_teacher: false,
      message: trimmed,
    }).select().single();

    if (error) {
      toast.error(error.message);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setText(trimmed);
      return;
    }
    if (data) {
      setMessages((prev) => prev.map((m) => m.id === optimisticId ? (data as Message) : m));
    }
  };

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
        <Link to="/my-live-classes" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to live classes
        </Link>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="p-10 text-center">
        <p className="text-sm text-muted-foreground">You need to enroll in this course to access this live class.</p>
        <Link to="/my-live-classes" className="mt-4 inline-block text-sm text-primary hover:underline">
          Back to live classes
        </Link>
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

      <div className="flex flex-1 min-h-0 flex-col md:flex-row">
        <div className="relative flex-1 min-h-0 bg-[#0a0a0a]">
          {isLive ? (
            <div className="absolute inset-0">
              <AgoraVideoRoom
                channelName={cls.id}
                role="audience"
              />
            </div>
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
              <p className="text-xs mt-1">You'll automatically see the stream when the teacher goes live.</p>
            </div>
          )}
        </div>

        <aside className="flex flex-col min-h-0 h-[45vh] md:h-auto md:w-[300px] lg:w-[340px] border-t md:border-t-0 md:border-l border-border bg-card">
          <div className="shrink-0 px-4 py-3 border-b border-border">
            <p className="text-sm font-bold text-foreground">Live chat</p>
            <p className="text-[10px] text-muted-foreground">{messages.length} messages</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No messages yet — say hello!</p>
            ) : (
              messages.map((m) => {
                const isOwn = m.user_id === user?.id;
                const initials = m.display_name.split(" ").map((n) => n[0]).join("").slice(0, 2);
                return (
                  <div key={m.id} className={`flex items-end gap-2 ${isOwn ? "flex-row-reverse" : ""}`}>
                    <div className={`h-7 w-7 shrink-0 rounded-full text-[10px] font-bold flex items-center justify-center ${m.is_teacher ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                      {initials}
                    </div>
                    <div className={`max-w-[75%] min-w-0 ${isOwn ? "items-end" : "items-start"} flex flex-col`}>
                      <p className={`text-[11px] font-semibold text-foreground flex items-center gap-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                        {m.is_teacher && <img src="/badge-award-medal.svg" className="h-3.5 w-3.5 shrink-0" alt="Teacher" />}
                        <span>{m.display_name}</span>
                      </p>
                      <div className={`rounded-2xl px-3 py-1.5 ${isOwn ? "rounded-br-sm bg-primary" : "rounded-bl-sm bg-muted"}`}>
                        <p className={`text-xs break-words ${isOwn ? "text-primary-foreground" : "text-foreground"}`}>{m.message}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="shrink-0 p-3 border-t border-border flex gap-2 bg-card"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
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

export default LiveClassRoomPage;
