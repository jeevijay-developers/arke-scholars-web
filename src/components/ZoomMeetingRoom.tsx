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

// Zoom SDK v6.x uses react-draggable + react-resizable + zoom-MuiBox-root classes.
// The main meeting panel is the .react-draggable that does NOT have .zoom-MuiBox-root
// (the chat/participants panels DO have .zoom-MuiBox-root — we must not touch those or
// their popper behaviour breaks).
// We use top/right/bottom/left:0 instead of height:100% for the absolutely-positioned
// elements — stretching via all-sides is more reliable than percentage heights.
const injectZoomFillStyles = () => {
  if (document.getElementById("zoom-fill-override")) return;
  const style = document.createElement("style");
  style.id = "zoom-fill-override";
  style.textContent = `
    /* Container must be a positioned ancestor */
    #meetingSDKElement {
      display: flex !important;
      flex-direction: column !important;
    }
    #meetingSDKElement > div {
      position: relative !important;
      flex: 1 1 0 !important;
      min-height: 0 !important;
      width: 100% !important;
      height: 100% !important;
    }
    /* Main meeting panel — stretch to fill, ignore Zoom's hardcoded translate */
    #meetingSDKElement > div > .react-draggable:not(.zoom-MuiBox-root) {
      position: absolute !important;
      top: 0 !important; right: 0 !important;
      bottom: 0 !important; left: 0 !important;
      width: auto !important;
      height: auto !important;
      transform: none !important;
    }
    #meetingSDKElement > div > .react-draggable:not(.zoom-MuiBox-root) > .zoom-MuiBox-root:first-child {
      position: absolute !important;
      top: 0 !important; right: 0 !important;
      bottom: 0 !important; left: 0 !important;
    }
    #meetingSDKElement > div > .react-draggable:not(.zoom-MuiBox-root) .react-resizable {
      width: 100% !important;
      height: 100% !important;
      max-width: 100% !important;
      max-height: 100% !important;
    }
    /* outerPaper — flex column so toolbar stays at bottom */
    #meetingSDKElement > div > .react-draggable:not(.zoom-MuiBox-root) .react-resizable > div:first-child {
      width: 100% !important;
      height: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
    }
    /* innerPaper (video area) — grows above toolbar */
    #meetingSDKElement > div > .react-draggable:not(.zoom-MuiBox-root) .react-resizable > div:first-child > div:first-child {
      flex: 1 1 0 !important;
      min-height: 0 !important;
      height: 0 !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
    }
    /* videoBox — 3rd child of innerPaper */
    #meetingSDKElement > div > .react-draggable:not(.zoom-MuiBox-root) .react-resizable > div:first-child > div:first-child > div:nth-child(3) {
      flex: 1 1 0 !important;
      min-height: 0 !important;
      height: 0 !important;
      overflow: hidden !important;
    }
    /* Kill the resize handle */
    #meetingSDKElement .react-resizable-handle { display: none !important; }

    /* Re-anchor poppers (chat/participants) as a right-side panel */
    .zoom-MuiPopper-root {
      position: fixed !important;
      transform: none !important;
      top: 60px !important;
      right: 0 !important;
      bottom: 60px !important;
      left: auto !important;
      width: 380px !important;
      overflow-y: auto !important;
      border-left: 1px solid rgba(255,255,255,0.1) !important;
    }
  `;
  document.head.appendChild(style);
};

const patchZoomInlineStyles = (root: HTMLElement) => {
  const zoomRoot = root.firstElementChild as HTMLElement | null;
  if (!zoomRoot) return;

  // Main panel = the react-draggable WITHOUT .zoom-MuiBox-root
  // (chat/participants panels have .zoom-MuiBox-root and must NOT be touched)
  const draggable = Array.from(zoomRoot.children).find(
    (el) => el.classList.contains("react-draggable") && !el.classList.contains("zoom-MuiBox-root"),
  ) as HTMLElement | null;
  if (!draggable) return;

  // Stretch an absolutely-positioned element to fill its positioned ancestor
  const stretch = (el: HTMLElement) => {
    el.style.setProperty("position", "absolute", "important");
    el.style.setProperty("top", "0", "important");
    el.style.setProperty("right", "0", "important");
    el.style.setProperty("bottom", "0", "important");
    el.style.setProperty("left", "0", "important");
    el.style.removeProperty("width");
    el.style.removeProperty("height");
  };

  draggable.style.setProperty("transform", "none", "important");
  stretch(draggable);

  const panel = draggable.firstElementChild as HTMLElement | null;
  if (panel) stretch(panel);

  const resizable = panel?.firstElementChild as HTMLElement | null;
  if (resizable) {
    resizable.style.setProperty("width", "100%", "important");
    resizable.style.setProperty("height", "100%", "important");
    resizable.style.setProperty("max-width", "100%", "important");
    resizable.style.setProperty("max-height", "100%", "important");
  }

  // Zoom SDK v6.x renders its meeting "window" as nested MuiPaper blocks with
  // hardcoded pixel heights (e.g. 358px). We override them so the content fills
  // the resizable wrapper instead of leaving a black gap at the bottom.
  const outerPaper = resizable?.firstElementChild as HTMLElement | null;
  if (outerPaper) {
    outerPaper.style.setProperty("height", "100%", "important");
    outerPaper.style.setProperty("display", "flex", "important");
    outerPaper.style.setProperty("flex-direction", "column", "important");
    outerPaper.style.setProperty("overflow", "hidden", "important");
  }

  // innerPaper = video area (flex-grows above the fixed-height bottom toolbar)
  const innerPaper = outerPaper?.firstElementChild as HTMLElement | null;
  if (innerPaper) {
    innerPaper.style.setProperty("flex", "1 1 0", "important");
    innerPaper.style.setProperty("min-height", "0", "important");
    innerPaper.style.setProperty("height", "0", "important");
    innerPaper.style.setProperty("display", "flex", "important");
    innerPaper.style.setProperty("flex-direction", "column", "important");
    innerPaper.style.setProperty("overflow", "hidden", "important");
  }

  // videoBox = 3rd child of innerPaper (flex-grows below the Zoom top toolbar)
  const videoBox = innerPaper?.children[2] as HTMLElement | null;
  if (videoBox) {
    videoBox.style.setProperty("flex", "1 1 0", "important");
    videoBox.style.setProperty("min-height", "0", "important");
    videoBox.style.setProperty("height", "0", "important");
    videoBox.style.setProperty("overflow", "hidden", "important");
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
    // Zoom SDK v6 has an internal bug where it renders lists without key props.
    // The warning fires from inside @zoom_meetingsdk_embedded.js and cannot be
    // fixed from outside. Suppress only that exact React message while mounted.
    const origError = console.error; // eslint-disable-line no-console
    console.error = (...args: unknown[]) => { // eslint-disable-line no-console
      if (typeof args[0] === "string" && args[0].includes("unique") && args[0].includes("key")) return;
      origError(...args);
    };

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

        // Re-patch whenever Zoom re-applies its inline transform or adds new children.
        // rAF debounce prevents the observer from looping (each setProperty call is
        // itself a DOM mutation that would re-trigger a synchronous observer).
        let patchPending = false;
        mutationObserverRef.current = new MutationObserver(() => {
          if (patchPending) return;
          patchPending = true;
          requestAnimationFrame(() => {
            patchPending = false;
            if (containerRef.current) patchZoomInlineStyles(containerRef.current);
          });
        });
        mutationObserverRef.current.observe(containerRef.current, {
          subtree: true,
          attributes: true,
          attributeFilter: ["style"],
          childList: true,
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
      console.error = origError; // eslint-disable-line no-console
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
    <div className="absolute inset-0 bg-[#0a0a0a] flex flex-col">
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-[#0a0a0a]">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
          <p className="text-xs text-white/40">Connecting to meeting…</p>
        </div>
      )}
      {/* Zoom Component View mounts here — explicit flex-1 + min-h-0 so the SDK
          receives a real pixel height rather than 0 or "100%" which Zoom ignores */}
      <div
        ref={containerRef}
        id="meetingSDKElement"
        style={{ flex: "1 1 0", minHeight: 0, width: "100%", overflow: "hidden" }}
      />
    </div>
  );
};

export default ZoomMeetingRoom;
