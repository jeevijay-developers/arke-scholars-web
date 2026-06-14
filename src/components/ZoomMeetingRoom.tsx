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

// ─── Module-level Zoom singleton ──────────────────────────────────────────────
// createClient() always returns the same object (global singleton inside the SDK).
// Calling init() twice on it causes it to hang silently, which is why we gate
// both operations at module scope rather than inside the React effect.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let zoomClient: any = null;
// Promise that resolves when init() has completed; reused across Strict Mode remounts.
let zoomInitPromise: Promise<void> | null = null;
// Reset when the component unmounts for real (not Strict Mode cleanup).
let zoomJoined = false;

const resetZoomState = () => {
  zoomInitPromise = null;
  zoomJoined = false;
  // Don't null out zoomClient — createClient() always returns the same instance anyway.
};

// Zoom SDK v6.x uses react-draggable + react-resizable + zoom-MuiBox-root classes
// (not .meeting-client). We inject CSS overrides and patch inline styles via JS because
// the SDK re-applies inline transforms after every resize/drag event.
const injectZoomFillStyles = () => {
  if (document.getElementById("zoom-fill-override")) return;
  const style = document.createElement("style");
  style.id = "zoom-fill-override";
  style.textContent = `
    #meetingSDKElement > div > .react-draggable {
      width: 100% !important;
      height: 100% !important;
      transform: none !important;
      position: absolute !important;
      inset: 0 !important;
    }
    #meetingSDKElement > div > .react-draggable > .zoom-MuiBox-root:first-child {
      width: 100% !important;
      height: 100% !important;
      position: absolute !important;
      inset: 0 !important;
    }
    #meetingSDKElement > div > .react-draggable .react-resizable {
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
    }
    #meetingSDKElement .react-resizable-handle { display: none !important; }
  `;
  document.head.appendChild(style);
};

const patchZoomInlineStyles = (root: HTMLElement) => {
  const zoomRoot = root.firstElementChild as HTMLElement | null;
  const draggable = zoomRoot?.querySelector(":scope > .react-draggable") as HTMLElement | null;
  const panel = draggable?.firstElementChild as HTMLElement | null;
  const resizable = panel?.firstElementChild as HTMLElement | null;

  if (draggable) {
    draggable.style.setProperty("width", "100%", "important");
    draggable.style.setProperty("height", "100%", "important");
    draggable.style.setProperty("transform", "none", "important");
    draggable.style.setProperty("position", "absolute", "important");
    draggable.style.setProperty("inset", "0", "important");
  }
  if (panel) {
    panel.style.setProperty("width", "100%", "important");
    panel.style.setProperty("height", "100%", "important");
    panel.style.setProperty("position", "absolute", "important");
    panel.style.setProperty("inset", "0", "important");
  }
  if (resizable) {
    resizable.style.setProperty("width", "100%", "important");
    resizable.style.setProperty("height", "100%", "important");
    resizable.style.setProperty("max-width", "100%", "important");
    resizable.style.setProperty("max-height", "100%", "important");
  }
};

const ZoomMeetingRoom = ({ classId, classSlug, displayName, onLeave }: ZoomMeetingRoomProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mutationObserverRef = useRef<MutationObserver | null>(null);
  // Tracks whether THIS effect instance did the join (used to decide whether to
  // call leaveMeeting in the cleanup).
  const didJoinRef = useRef(false);

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        // ── 1. Load SDK and create (singleton) client ──────────────────────
        const module = await import("@zoom/meetingsdk/embedded");
        if (cancelled) return;

        const ZoomMtgEmbedded = (module.default || module) as any; // eslint-disable-line @typescript-eslint/no-explicit-any
        if (!zoomClient) {
          const createClientFn =
            ZoomMtgEmbedded.createClient ??
            ZoomMtgEmbedded.default?.createClient;
          if (!createClientFn) throw new Error("Zoom Meeting SDK: createClient not found.");
          zoomClient = createClientFn.call(ZoomMtgEmbedded);
        }

        if (!containerRef.current) throw new Error("Meeting container not mounted");

        // ── 2. init() — only called once, even across Strict Mode remounts ─
        if (!zoomInitPromise) {
          zoomInitPromise = zoomClient.init({
            zoomAppRoot: containerRef.current,
            language: "en-US",
            customize: {
              meetingInfo: ["topic", "host", "mn", "pwd", "telPwd", "invite", "participant", "dc", "enctype"],
              video: {
                popper: { disableDraggable: true },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                defaultViewType: "speaker" as any,
              },
              chat: { popper: { disableDraggable: true } },
              participants: { popper: { disableDraggable: true } },
              setting: { popper: { disableDraggable: true } },
              invite: { popper: { disableDraggable: true } },
              meeting: { popper: { disableDraggable: true } },
            },
          });
        }
        await zoomInitPromise;
        if (cancelled) return;

        // ── 3. Fetch credentials ───────────────────────────────────────────
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

        // ── 4. join() — only once per session ─────────────────────────────
        if (!zoomJoined) {
          zoomJoined = true;
          await zoomClient.join({
            signature: data.signature,
            // SDK v4+: appKey replaces sdkKey in joinOptions
            appKey: data.appKey ?? data.sdkKey,
            meetingNumber: data.meetingNumber,
            password: data.password ?? "",
            userName: displayName,
          });
        }
        if (cancelled) return;

        didJoinRef.current = true;
        setStatus("ready");

        injectZoomFillStyles();
        if (containerRef.current) patchZoomInlineStyles(containerRef.current);

        resizeObserverRef.current = new ResizeObserver(() => {
          if (containerRef.current) patchZoomInlineStyles(containerRef.current);
        });
        resizeObserverRef.current.observe(containerRef.current);

        // Re-patch whenever Zoom re-applies its inline transform (drag/resize events).
        mutationObserverRef.current = new MutationObserver(() => {
          if (containerRef.current) patchZoomInlineStyles(containerRef.current);
        });
        mutationObserverRef.current.observe(containerRef.current, {
          subtree: true, attributes: true, attributeFilter: ["style"],
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        zoomClient.on("connection-change", (payload: any) => {
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

    run();

    return () => {
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      mutationObserverRef.current?.disconnect();
      // Only leave if this effect instance completed the join.
      // Strict Mode cleanup fires before join completes, so didJoinRef is false
      // on the first (simulated) mount — we don't call leaveMeeting then.
      if (didJoinRef.current && zoomClient) {
        zoomClient.leaveMeeting().catch(() => {});
        didJoinRef.current = false;
        resetZoomState();
      }
    };
    // classId excluded intentionally — changing class requires a full navigation.
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
    <div className="relative h-full w-full bg-[#0a0a0a]">
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
