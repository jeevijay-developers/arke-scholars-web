import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Users, Loader2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
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

      const { data: msgs } = await supabase
        .from("live_class_messages")
        .select("*")
        .eq("class_id", id)
        .order("created_at", { ascending: true });
      setMessages((msgs ?? []) as Message[]);

      // Auto-attendance: upsert
      if (user) {
        await supabase.from("live_class_attendance").upsert(
          {
            class_id: id,
            user_id: user.id,
            joined_at: new Date().toISOString(),
            status: "joined",
          },
          { onConflict: "class_id,user_id" } as never,
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
          { event: "INSERT", schema: "public", table: "live_class_messages", filter: `class_id=eq.${id}` },
          (payload) => setMessages((prev) => [...prev, payload.new as Message]),
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
    const { error } = await supabase.from("live_class_messages").insert({
      class_id: cls.id,
      user_id: user.id,
      display_name: display,
      is_teacher: false,
      message: text.trim(),
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setText("");
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

  const isLive = cls.status === "live";
  const rawSrc = cls.recording_url || cls.meeting_url;
  const videoSrc = rawSrc
    ? (() => {
        // For Jitsi meetings, hide the Jitsi watermark/logo via interface config hash params.
        const isJitsi = /jit\.si|jitsi/i.test(rawSrc);
        if (!isJitsi) return rawSrc;
        const flags = [
          "config.disableDeepLinking=true",
          "interfaceConfig.SHOW_JITSI_WATERMARK=false",
          "interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false",
          "interfaceConfig.SHOW_BRAND_WATERMARK=false",
          "interfaceConfig.SHOW_POWERED_BY=false",
          "interfaceConfig.HIDE_DEEP_LINKING_LOGO=true",
          "interfaceConfig.DEFAULT_LOGO_URL=",
          "interfaceConfig.DEFAULT_WELCOME_PAGE_LOGO_URL=",
        ].join("&");
        const sep = rawSrc.includes("#") ? "&" : "#";
        return `${rawSrc}${sep}${flags}`;
      })()
    : null;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
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
        <div className="relative flex-1 min-h-0 bg-[#0a0a0a] flex items-center justify-center">
          {videoSrc ? (
            <>
              <iframe
                src={videoSrc}
                title={cls.title}
                allow="camera; microphone; fullscreen; display-capture"
                className="h-full w-full border-0"
              />
              {/* Arke logo cover over Jitsi watermark (top-left of iframe) */}
              <div className="pointer-events-none absolute top-2 left-2 md:top-3 md:left-3 z-10 flex items-center gap-2 rounded-lg bg-black/70 px-2.5 py-1 backdrop-blur-sm">
                <img src={arkeLogo} alt="Arke Scholars" className="h-5 md:h-6 w-auto rounded" />
                <span className="text-[10px] md:text-xs font-bold text-white tracking-wide">Arke Scholars</span>
              </div>
            </>
          ) : (
            <div className="text-center text-white/60 p-6">
              <p className="text-sm">No meeting link available yet.</p>
              <p className="text-xs mt-1">Check back when the class goes live.</p>
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
