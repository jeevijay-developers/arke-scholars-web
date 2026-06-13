import { useEffect, useRef, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type ZoomMeetingRoomProps = {
  /** live_classes.id (UUID) — credentials and role are derived server-side */
  classId: string;
  classSlug?: string;
  displayName: string;
  onLeave?: () => void;
};

type Status = "loading" | "ready" | "error";

// Zoom's embedded toolbar is ~56px tall; subtract so it stays on-screen.
const ZOOM_TOOLBAR_HEIGHT = 56;

const ZoomMeetingRoom = ({ classId, classSlug, displayName, onLeave }: ZoomMeetingRoomProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);
  const joinedRef = useRef(false);
  const initializedRef = useRef(false); // guard against double-init (StrictMode / re-render)

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only ever init once per mount — Zoom SDK throws if init is called twice.
    if (initializedRef.current) return;
    initializedRef.current = true;

    let cancelled = false;

    const init = async () => {
      try {
        const module = await import("@zoom/meetingsdk/embedded");
        if (cancelled) return;

        const ZoomMtgEmbedded = module.default || module;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const createClientFn = ZoomMtgEmbedded.createClient || (ZoomMtgEmbedded as any).default?.createClient;
        if (!createClientFn) {
          throw new Error("Zoom Meeting SDK: createClient not found.");
        }
        const client = createClientFn.call(ZoomMtgEmbedded);
        clientRef.current = client;

        if (!containerRef.current) throw new Error("Meeting container not mounted");

        const w = containerRef.current.clientWidth || window.innerWidth;
        // Subtract toolbar height so the controls bar stays within the visible viewport.
        const h = (containerRef.current.clientHeight || window.innerHeight) - ZOOM_TOOLBAR_HEIGHT;

        await client.init({
          zoomAppRoot: containerRef.current,
          language: "en-US",
          customize: {
            meetingInfo: ["topic", "host", "mn", "pwd", "telPwd", "invite", "participant", "dc", "enctype"],
            video: {
              isResizable: false,
              popper: { disableDraggable: true },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              defaultViewType: "speaker" as any,
              viewSizes: { default: { width: w, height: h } },
            },
            chat: { popper: { disableDraggable: true } },
            participants: { popper: { disableDraggable: true } },
            setting: { popper: { disableDraggable: true } },
            invite: { popper: { disableDraggable: true } },
            meeting: { popper: { disableDraggable: true } },
          },
        });

        // Fetch signature + meeting credentials from server (role derived server-side)
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");

        const { data, error: fnErr } = await supabase.functions.invoke("zoom-signature", {
          body: { classId, classSlug },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (fnErr || !data?.signature) {
          throw new Error(fnErr?.message ?? "Failed to get meeting signature");
        }

        if (cancelled) return;

        await client.join({
          signature: data.signature,
          sdkKey: data.sdkKey,
          meetingNumber: data.meetingNumber,
          password: data.password ?? "",
          userName: displayName,
        });

        joinedRef.current = true;
        if (!cancelled) setStatus("ready");

        // Inject CSS to pin the video panel in place and hide drag/resize chrome.
        // Zoom renders video-player-container with fixed inline px — !important overrides it.
        if (!document.getElementById("zoom-fill-override")) {
          const style = document.createElement("style");
          style.id = "zoom-fill-override";
          style.textContent = `
            #meetingSDKElement .react-resizable-handle { display: none !important; }
            #meetingSDKElement .zoommtg-drag-handle { cursor: default !important; }
            #meetingSDKElement video-player-container {
              width: 100% !important;
              height: 100% !important;
              top: 0 !important;
              left: 0 !important;
            }
            #meetingSDKElement video {
              width: 100% !important;
              height: 100% !important;
              object-fit: cover !important;
            }
          `;
          document.head.appendChild(style);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        client.on("connection-change", (payload: any) => {
          // "Reconnecting" is a transient state — do NOT leave. Only leave on terminal states.
          if (payload?.state === "Closed" || payload?.state === "Fail") {
            onLeave?.();
          }
        });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setStatus("error");
      }
    };

    init();

    return () => {
      cancelled = true;
      if (joinedRef.current && clientRef.current) {
        clientRef.current.leaveMeeting().catch(() => {});
        joinedRef.current = false;
      }
    };
    // classId is intentionally excluded — re-mounting for a new class requires
    // navigating away and back, which unmounts/remounts this component cleanly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "error") {
    return (
      <div className="flex h-full w-full min-h-[240px] flex-col items-center justify-center gap-3 bg-[#0a0a0a] p-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive shrink-0" />
        <p className="text-sm text-white/80 max-w-sm leading-relaxed">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-1 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#0a0a0a] overflow-hidden">
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-[#0a0a0a]">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          <p className="text-xs text-white/40">Connecting to meeting…</p>
        </div>
      )}
      {/* Zoom Component View mounts here */}
      <div ref={containerRef} id="meetingSDKElement" className="h-full w-full" />
    </div>
  );
};

export default ZoomMeetingRoom;
