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

// Force Zoom's internal fixed-size wrappers to fill our container.
// Zoom renders .meeting-client with inline px dimensions — !important overrides them.
const injectZoomFillStyles = () => {
  if (document.getElementById("zoom-fill-override")) return;
  const style = document.createElement("style");
  style.id = "zoom-fill-override";
  style.textContent = `
    #meetingSDKElement,
    #meetingSDKElement > div,
    #meetingSDKElement .meeting-client,
    #meetingSDKElement .meeting-client-inner {
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
      position: absolute !important;
      inset: 0 !important;
    }
    #meetingSDKElement .react-resizable-handle { display: none !important; }
    #meetingSDKElement .zoommtg-drag-handle { cursor: default !important; }
    #meetingSDKElement video-player-container,
    #meetingSDKElement [class*="video-player"],
    #meetingSDKElement [class*="main-layout"],
    #meetingSDKElement [class*="speaker-active"],
    #meetingSDKElement [class*="gallery-video"] {
      width: 100% !important;
      height: 100% !important;
      top: 0 !important;
      left: 0 !important;
    }
    #meetingSDKElement video {
      width: 100% !important;
      height: 100% !important;
      object-fit: contain !important;
    }
  `;
  document.head.appendChild(style);
};

// Directly patch inline styles on Zoom's internal .meeting-client element,
// since some versions set width/height via JS after the style tag is parsed.
const patchZoomInlineStyles = (root: HTMLElement) => {
  const client = root.querySelector(".meeting-client") as HTMLElement | null;
  if (client) {
    client.style.setProperty("width", "100%", "important");
    client.style.setProperty("height", "100%", "important");
    client.style.setProperty("position", "absolute", "important");
    client.style.setProperty("inset", "0", "important");
  }
};

const ZoomMeetingRoom = ({ classId, classSlug, displayName, onLeave }: ZoomMeetingRoomProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientRef = useRef<any>(null);
  const joinedRef = useRef(false);
  const initializedRef = useRef(false); // guard against double-init (StrictMode / re-render)
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

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

        // Use full viewport for dimensions — this page has no sidebar (immersive route).
        // Subtract toolbar height so the Zoom controls bar stays visible.
        const w = window.innerWidth;
        const h = window.innerHeight - ZOOM_TOOLBAR_HEIGHT;

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

        // Inject CSS overrides and patch inline styles set by the SDK after join.
        injectZoomFillStyles();
        if (containerRef.current) patchZoomInlineStyles(containerRef.current);

        // Re-patch whenever the container resizes (window resize, orientation change, etc.)
        if (containerRef.current) {
          resizeObserverRef.current = new ResizeObserver(() => {
            if (containerRef.current) patchZoomInlineStyles(containerRef.current);
          });
          resizeObserverRef.current.observe(containerRef.current);
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
      resizeObserverRef.current?.disconnect();
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
