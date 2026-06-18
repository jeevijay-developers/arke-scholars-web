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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let zoomClient: any = null;
let zoomInitPromise: Promise<void> | null = null;
let zoomJoined = false;

const resetZoomState = () => {
  zoomInitPromise = null;
  zoomJoined = false;
};

// Fixed size we tell Zoom to render at. We then scale it to fill the container.
// Using a standard 16:9 size gives Zoom a stable layout to work with.
const ZOOM_W = 1280;
const ZOOM_H = 720;

const injectZoomBaseStyles = () => {
  const existing = document.getElementById("zoom-fill-override");
  if (existing) existing.remove();
  const style = document.createElement("style");
  style.id = "zoom-fill-override";
  style.textContent = `
    #meetingSDKElement {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: ${ZOOM_W}px !important;
      height: ${ZOOM_H}px !important;
      overflow: hidden !important;
      transform-origin: top left !important;
    }

    /* Kill draggable transform & resize handle */
    #meetingSDKElement .react-resizable-handle { display: none !important; }
    #meetingSDKElement .react-draggable { transform: none !important; cursor: default !important; }

    /* Force every inner div to full ZOOM_W x ZOOM_H */
    #meetingSDKElement > div,
    #meetingSDKElement .react-draggable:not(.zoom-MuiBox-root),
    #meetingSDKElement .react-draggable:not(.zoom-MuiBox-root) > div,
    #meetingSDKElement .react-resizable,
    #meetingSDKElement .react-resizable > div:first-child {
      width: ${ZOOM_W}px !important;
      height: ${ZOOM_H}px !important;
      max-width: none !important;
      max-height: none !important;
      overflow: hidden !important;
    }

    /* Video area inside the meeting panel */
    #meetingSDKElement .react-resizable > div:first-child > div:first-child {
      width: ${ZOOM_W}px !important;
      height: ${ZOOM_H - 60}px !important;
      overflow: hidden !important;
    }

    /* Video tile container */
    #meetingSDKElement .react-resizable > div:first-child > div:first-child > div:nth-child(3) {
      width: ${ZOOM_W}px !important;
      height: ${ZOOM_H - 60}px !important;
      overflow: hidden !important;
    }

    /* Canvas and video elements — fill their container */
    #meetingSDKElement canvas {
      width: ${ZOOM_W}px !important;
      height: ${ZOOM_H - 60}px !important;
      display: block !important;
    }
    #meetingSDKElement video {
      width: 100% !important;
      height: 100% !important;
      object-fit: cover !important;
    }

    /* Poppers (chat/participants) — fixed right panel */
    .zoom-MuiPopper-root {
      position: fixed !important;
      top: 52px !important;
      right: 0 !important;
      bottom: 0 !important;
      left: auto !important;
      width: 360px !important;
      transform: none !important;
      overflow-y: auto !important;
      z-index: 9999 !important;
    }
  `;
  document.head.appendChild(style);
};

const scaleZoomToFit = (wrapper: HTMLElement, sdkEl: HTMLElement) => {
  const scaleX = wrapper.offsetWidth / ZOOM_W;
  const scaleY = wrapper.offsetHeight / ZOOM_H;
  // Use the smaller scale so nothing is clipped, then stretch with scaleY to fill height
  const scale = Math.max(scaleX, scaleY);
  sdkEl.style.transform = `scale(${scale})`;

  // Center after scaling if scaleX !== scaleY
  const scaledW = ZOOM_W * scale;
  const scaledH = ZOOM_H * scale;
  const offsetX = (wrapper.offsetWidth - scaledW) / 2;
  const offsetY = (wrapper.offsetHeight - scaledH) / 2;
  sdkEl.style.transformOrigin = "top left";
  sdkEl.style.left = `${offsetX}px`;
  sdkEl.style.top = `${offsetY}px`;
};

const ZoomMeetingRoom = ({ classId, classSlug, displayName, onLeave }: ZoomMeetingRoomProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const sdkRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const didJoinRef = useRef(false);

  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const origError = console.error; // eslint-disable-line no-console
    console.error = (...args: unknown[]) => { // eslint-disable-line no-console
      if (typeof args[0] === "string" && args[0].includes("unique") && args[0].includes("key")) return;
      origError(...args);
    };

    let cancelled = false;

    const run = async () => {
      try {
        // ── 1. SDK client ──────────────────────────────────────────────────
        const module = await import("@zoom/meetingsdk/embedded");
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ZoomMtgEmbedded = (module.default || module) as any;
        if (!zoomClient) {
          const createClientFn = ZoomMtgEmbedded.createClient ?? ZoomMtgEmbedded.default?.createClient;
          if (!createClientFn) throw new Error("Zoom Meeting SDK: createClient not found.");
          zoomClient = createClientFn.call(ZoomMtgEmbedded);
        }

        if (!sdkRef.current) throw new Error("Meeting container not mounted");

        // ── 2. init() with fixed 1280×720 ─────────────────────────────────
        if (!zoomInitPromise) {
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
          if (cancelled) return;

          zoomInitPromise = zoomClient.init({
            zoomAppRoot: sdkRef.current,
            language: "en-US",
            customize: {
              meetingInfo: ["topic", "host", "mn", "pwd", "telPwd", "invite", "participant", "dc", "enctype"],
              video: {
                popper: { disableDraggable: true },
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                defaultViewType: "speaker" as any,
                viewSizes: {
                  default: { width: ZOOM_W, height: ZOOM_H },
                  ribbon: { width: ZOOM_W, height: ZOOM_H },
                },
                isResizable: false,
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

        // ── 3. Credentials ─────────────────────────────────────────────────
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error("Not authenticated");

        const { data, error: fnErr } = await supabase.functions.invoke("zoom-signature", {
          body: { classId, classSlug },
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (fnErr || !data?.signature) throw new Error(fnErr?.message ?? "Failed to get meeting signature");
        if (cancelled) return;

        // ── 4. join() ──────────────────────────────────────────────────────
        if (!zoomJoined) {
          zoomJoined = true;
          await zoomClient.join({
            signature: data.signature,
            appKey: data.appKey ?? data.sdkKey,
            meetingNumber: data.meetingNumber,
            password: data.password ?? "",
            userName: displayName,
          });
        }
        if (cancelled) return;

        didJoinRef.current = true;
        setStatus("ready");

        // Inject base CSS (fixes fixed ZOOM_W×ZOOM_H size + kills draggable)
        injectZoomBaseStyles();

        // Scale the fixed-size SDK element to fill the wrapper
        const doScale = () => {
          if (wrapperRef.current && sdkRef.current) {
            scaleZoomToFit(wrapperRef.current, sdkRef.current);
          }
        };

        // Patch canvas size explicitly — Zoom sets canvas width/height attributes
        // (not CSS) which CSS cannot override
        const patchCanvas = () => {
          if (!sdkRef.current) return;
          sdkRef.current.querySelectorAll("canvas").forEach((c) => {
            if (c.width < ZOOM_W) c.width = ZOOM_W;
            if (c.height < ZOOM_H - 60) c.height = ZOOM_H - 60;
          });
        };

        // Scale immediately and after Zoom finishes rendering
        doScale();
        [200, 600, 1200, 2500].forEach((ms) => setTimeout(() => { doScale(); patchCanvas(); }, ms));

        resizeObserverRef.current = new ResizeObserver(doScale);
        resizeObserverRef.current.observe(wrapperRef.current!);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        zoomClient.on("connection-change", (payload: any) => {
          if (payload?.state === "Closed" || payload?.state === "Fail") onLeave?.();
        });
      } catch (err) {
        if (cancelled) return;
        let msg = "Failed to join meeting";
        if (err instanceof Error) {
          msg = err.message;
        } else if (err && typeof err === "object") {
          const o = err as Record<string, unknown>;
          msg = String(o.reason ?? o.type ?? o.message ?? JSON.stringify(err));
        } else {
          msg = String(err);
        }
        resetZoomState();
        setError(msg);
        setStatus("error");
      }
    };

    run();

    return () => {
      console.error = origError; // eslint-disable-line no-console
      cancelled = true;
      resizeObserverRef.current?.disconnect();
      if (didJoinRef.current && zoomClient) {
        zoomClient.leaveMeeting().catch(() => {});
        didJoinRef.current = false;
        resetZoomState();
      }
    };
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
    <div ref={wrapperRef} className="absolute inset-0 bg-[#0a0a0a] overflow-hidden">
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-[#0a0a0a]">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          <p className="text-xs text-white/40">Connecting to meeting…</p>
        </div>
      )}
      {/* Fixed 1280×720 SDK element — scaled to fill wrapperRef via CSS transform */}
      <div
        ref={sdkRef}
        id="meetingSDKElement"
      />
    </div>
  );
};

export default ZoomMeetingRoom;
