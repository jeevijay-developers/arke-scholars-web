import { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
  ILocalVideoTrack,
} from "agora-rtc-sdk-ng";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, WifiOff,
  AlertCircle, Monitor, MonitorOff, Maximize, Minimize, Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const APP_ID = import.meta.env.VITE_AGORA_APP_ID as string | undefined;

async function fetchToken(channelName: string, uid: number, role: "host" | "audience"): Promise<string | null> {
  const isDev = import.meta.env.DEV;

  if (isDev) {
    try {
      const res = await fetch("/api/agora-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelName, uid, role }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { token: string | null };
      return data.token ?? null;
    } catch (e) {
      console.warn("[Agora] Dev token fetch failed:", e);
      return null;
    }
  }

  // Production: use the Supabase client so auth headers + URL are handled the same
  // way as every other working Supabase call in the app.
  try {
    const { data, error } = await supabase.functions.invoke("agora-token", {
      body: { channelName, uid, role },
    });
    if (error) throw error;
    return (data as { token: string | null }).token ?? null;
  } catch (e) {
    console.warn("[Agora] Token fetch failed:", e);
    return null;
  }
}

// 0=unknown, 1=excellent, 2=good, 3=poor, 4=bad, 5=very bad, 6=disconnected
function NetworkBars({ quality }: { quality: number }) {
  const colors = [
    "text-white/40",   // 0 unknown
    "text-green-400",  // 1 excellent
    "text-green-400",  // 2 good
    "text-yellow-400", // 3 poor
    "text-red-400",    // 4 bad
    "text-red-500",    // 5 very bad
    "text-white/40",   // 6 disconnected
  ];
  const labels = ["", "Excellent", "Good", "Poor", "Bad", "Very bad", ""];
  const color = colors[quality] ?? "text-white/40";
  const label = labels[quality] ?? "";
  return (
    <div className={`flex items-center gap-1 ${color}`} title={label ? `Network: ${label}` : "Checking network…"}>
      <Wifi className="h-3 w-3" />
      {label && <span className="text-[10px] font-semibold">{label}</span>}
    </div>
  );
}

type ConnectionStatus = "connecting" | "live" | "disconnected";

export type Props = {
  channelName: string;
  role: "host" | "audience";
  uid?: number;
  onLeave?: () => void;
};

const AgoraVideoRoom = ({ channelName, role, uid = 0, onLeave }: Props) => {
  const localVideoRef  = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const leftRef        = useRef(false);
  const clientRef      = useRef<IAgoraRTCClient | null>(null);

  const [status,          setStatus]          = useState<ConnectionStatus>("connecting");
  const [micMuted,        setMicMuted]        = useState(false);
  const [camOff,          setCamOff]          = useState(false);
  const [hasRemoteVideo,  setHasRemoteVideo]  = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [isPermissionError, setIsPermissionError] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [networkQuality,  setNetworkQuality]  = useState(0);
  const [isFullscreen,    setIsFullscreen]    = useState(false);
  const [retryCount,      setRetryCount]      = useState(0);

  const pendingRemoteTrack = useRef<IRemoteVideoTrack | null>(null);
  const localTracksRef     = useRef<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null);
  const screenTrackRef     = useRef<ILocalVideoTrack | null>(null);

  const leave = useCallback(async (skipConfirm = false) => {
    if (leftRef.current) return;
    if (role === "audience" && !skipConfirm) {
      const ok = window.confirm("Leave the live class?");
      if (!ok) return;
    }
    leftRef.current = true;
    if (screenTrackRef.current) {
      try { screenTrackRef.current.stop(); screenTrackRef.current.close(); } catch (_) { /* */ }
      screenTrackRef.current = null;
    }
    if (localTracksRef.current) {
      try { localTracksRef.current[0].stop(); localTracksRef.current[0].close(); } catch (_) { /* */ }
      try { localTracksRef.current[1].stop(); localTracksRef.current[1].close(); } catch (_) { /* */ }
      localTracksRef.current = null;
    }
    try { await clientRef.current?.leave(); } catch (_) { /* */ }
    setStatus("disconnected");
    onLeave?.();
  }, [onLeave, role]);

  // Play pending remote track once div is mounted/visible
  useEffect(() => {
    if (!hasRemoteVideo || !pendingRemoteTrack.current) return;
    const track = pendingRemoteTrack.current;
    requestAnimationFrame(() => {
      if (remoteVideoRef.current) track.play(remoteVideoRef.current);
    });
  }, [hasRemoteVideo]);

  useEffect(() => {
    leftRef.current = false;
    setError(null);
    setIsPermissionError(false);
    setStatus("connecting");

    if (!APP_ID) {
      setError("Agora App ID is missing. Add VITE_AGORA_APP_ID to .env and restart the dev server.");
      setStatus("disconnected");
      return;
    }

    // Create a fresh client per mount — avoids INVALID_OPERATION from a lingering singleton
    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    clientRef.current = client;

    client.on("user-published", async (remoteUser, mediaType) => {
      await client.subscribe(remoteUser, mediaType);
      if (mediaType === "video") {
        const track = remoteUser.videoTrack as IRemoteVideoTrack;
        pendingRemoteTrack.current = track;
        setHasRemoteVideo(true);
      }
      if (mediaType === "audio") {
        (remoteUser.audioTrack as IRemoteAudioTrack).play();
      }
    });

    client.on("user-unpublished", (_u, mediaType) => {
      if (mediaType === "video") {
        pendingRemoteTrack.current = null;
        setHasRemoteVideo(false);
      }
    });

    client.on("user-left", () => {
      pendingRemoteTrack.current = null;
      setHasRemoteVideo(false);
    });

    client.on("connection-state-change", (state) => {
      if (state === "CONNECTED")    setStatus("live");
      if (state === "DISCONNECTED") setStatus("disconnected");
    });

    client.on("network-quality", (stats) => {
      const q = role === "host" ? stats.uplinkNetworkQuality : stats.downlinkNetworkQuality;
      setNetworkQuality(q);
    });

    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    const join = async () => {
      try {
        // setClientRole must be called before join in "live" mode
        await client.setClientRole(role);
        const token = await fetchToken(channelName, uid, role);
        await client.join(APP_ID, channelName, token, uid === 0 ? null : uid);
        setStatus("live");

        if (role === "host") {
          // Proactively request permissions so the browser prompt appears before Agora tries
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            stream.getTracks().forEach((t) => t.stop());
          } catch (permErr) {
            const msg = permErr instanceof Error ? permErr.message : String(permErr);
            if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
              setIsPermissionError(true);
              setError("Camera or microphone permission denied. Click 'Allow' in your browser's address bar, then click 'Retry'.");
              setStatus("disconnected");
              toast.error("Camera/mic access denied");
              return;
            }
          }

          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            { encoderConfig: "music_standard" },
            { encoderConfig: "720p_1" },
          );

          // Guard: component may have unmounted while we awaited tracks
          if (leftRef.current) {
            audioTrack.stop(); audioTrack.close();
            videoTrack.stop(); videoTrack.close();
            return;
          }

          localTracksRef.current = [audioTrack, videoTrack];
          if (localVideoRef.current) videoTrack.play(localVideoRef.current);
          await client.publish([audioTrack, videoTrack]);
        }
      } catch (err: unknown) {
        if (leftRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        let friendly = `Failed to connect: ${msg}`;
        let isPerm = false;
        if (msg.includes("Permission") || msg.includes("NotAllowed") || msg.includes("denied")) {
          isPerm = true;
          friendly = "Camera or microphone permission denied. Click the camera icon in your browser's address bar, allow access, then click 'Retry'.";
        } else if (msg.includes("NotFound") || msg.includes("device")) {
          friendly = "No camera or microphone found. Please connect a device and refresh.";
        } else if (msg.includes("CAN_NOT_GET_GATEWAY") || msg.includes("dynamic use static")) {
          friendly = "Agora token error: your project requires a signed token. Restart the dev server so AGORA_APP_CERTIFICATE is loaded, then try again.";
        }
        setIsPermissionError(isPerm);
        setError(friendly);
        setStatus("disconnected");
        toast.error("Stream connection failed");
      }
    };

    join();

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      client.removeAllListeners();
      // Mark as left so the join catch block ignores late errors
      leftRef.current = true;
      // Clean up tracks then leave — fire-and-forget is fine here since the client is local
      if (screenTrackRef.current) {
        try { screenTrackRef.current.stop(); screenTrackRef.current.close(); } catch (_) { /* */ }
        screenTrackRef.current = null;
      }
      if (localTracksRef.current) {
        try { localTracksRef.current[0].stop(); localTracksRef.current[0].close(); } catch (_) { /* */ }
        try { localTracksRef.current[1].stop(); localTracksRef.current[1].close(); } catch (_) { /* */ }
        localTracksRef.current = null;
      }
      client.leave().catch(() => { /* */ });
      clientRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, role, retryCount]);

  const toggleMic = async () => {
    const track = localTracksRef.current?.[0];
    if (!track) return;
    const next = !micMuted;
    await track.setMuted(next);
    setMicMuted(next);
  };

  const toggleCam = async () => {
    const track = localTracksRef.current?.[1];
    if (!track) return;
    const next = !camOff;
    await track.setMuted(next);
    setCamOff(next);
  };

  const toggleScreenShare = async () => {
    const client = clientRef.current;
    if (!client) return;

    if (isScreenSharing) {
      if (screenTrackRef.current) {
        try {
          await client.unpublish(screenTrackRef.current);
          screenTrackRef.current.stop();
          screenTrackRef.current.close();
        } catch (_) { /* */ }
        screenTrackRef.current = null;
      }
      // Restore camera
      if (localTracksRef.current) {
        const [, camTrack] = localTracksRef.current;
        if (localVideoRef.current) camTrack.play(localVideoRef.current);
        try { await client.publish(camTrack); } catch (_) { /* */ }
      }
      setIsScreenSharing(false);
    } else {
      try {
        const screenTrack = await AgoraRTC.createScreenVideoTrack(
          { encoderConfig: "1080p_1", optimizationMode: "detail" },
          "disable",
        ) as ILocalVideoTrack;
        screenTrackRef.current = screenTrack;

        if (localTracksRef.current) {
          try { await client.unpublish(localTracksRef.current[1]); } catch (_) { /* */ }
        }
        if (localVideoRef.current) screenTrack.play(localVideoRef.current);
        await client.publish(screenTrack);
        setIsScreenSharing(true);

        // Handle user stopping screen share via the browser's native stop button
        (screenTrack as any).on?.("track-ended", () => {
          void toggleScreenShare();
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.toLowerCase().includes("cancel")) {
          toast.error("Screen share failed. Please try again.");
        }
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  if (error) {
    return (
      <div className="flex h-full w-full min-h-[240px] flex-col items-center justify-center gap-3 bg-[#0a0a0a] p-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive shrink-0" />
        <p className="text-sm text-white/80 max-w-sm leading-relaxed">{error}</p>
        {(isPermissionError || role === "host") && (
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="mt-1 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:opacity-90"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full bg-[#0a0a0a] overflow-hidden flex flex-col">
      {/* Status pill */}
      <div className="absolute top-2 sm:top-3 left-2 sm:left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/70 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-bold text-white backdrop-blur-sm">
        {status === "connecting"   && <><Loader2 className="h-3 w-3 animate-spin" /> Connecting…</>}
        {status === "live"         && <><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE</>}
        {status === "disconnected" && <><WifiOff className="h-3 w-3 text-destructive" /> Disconnected</>}
      </div>

      {/* Network quality — top right */}
      {status === "live" && networkQuality > 0 && (
        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-20 rounded-full bg-black/70 px-2 sm:px-2.5 py-0.5 sm:py-1 backdrop-blur-sm">
          <NetworkBars quality={networkQuality} />
        </div>
      )}

      {/* Video area — fills available space */}
      <div className="flex-1 relative w-full">
        {role === "audience" && (
          <>
            <div ref={remoteVideoRef} className="absolute inset-0 h-full w-full" />
            {status === "connecting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-10">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
              </div>
            )}
            {status === "live" && !hasRemoteVideo && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#0a0a0a] z-10">
                <VideoOff className="h-10 w-10 text-white/30" />
                <p className="text-sm text-white/50">Waiting for teacher's stream…</p>
              </div>
            )}
          </>
        )}

        {role === "host" && (
          <>
            <div ref={localVideoRef} className="absolute inset-0 h-full w-full" />
            {status === "connecting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a] z-10">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
              </div>
            )}
            {camOff && !isScreenSharing && status === "live" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#111] z-10">
                <VideoOff className="h-10 w-10 text-white/30" />
                <p className="text-xs text-white/40">Camera is off</p>
              </div>
            )}
            {isScreenSharing && (
              <div className="absolute top-12 left-3 z-20 rounded-full bg-blue-600/90 px-2.5 py-0.5 text-[10px] font-bold text-white">
                Screen sharing
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls bar — at bottom */}
      <div className="shrink-0 flex items-center justify-center gap-2 sm:gap-3 py-2 sm:py-3 px-2 sm:px-0 bg-gradient-to-t from-black/80 to-transparent z-20">
        {role === "host" && (
          <>
            <button
              onClick={toggleMic}
              title={micMuted ? "Unmute mic" : "Mute mic"}
              className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full transition-colors
                ${micMuted ? "bg-destructive text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              {micMuted ? <MicOff className="h-3 w-3 sm:h-4 sm:w-4" /> : <Mic className="h-3 w-3 sm:h-4 sm:w-4" />}
            </button>
            <button
              onClick={toggleCam}
              title={camOff ? "Turn camera on" : "Turn camera off"}
              className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full transition-colors
                ${camOff ? "bg-destructive text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              {camOff ? <VideoOff className="h-3 w-3 sm:h-4 sm:w-4" /> : <Video className="h-3 w-3 sm:h-4 sm:w-4" />}
            </button>
            <button
              onClick={toggleScreenShare}
              title={isScreenSharing ? "Stop screen share" : "Share screen"}
              className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full transition-colors
                ${isScreenSharing ? "bg-blue-600 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              {isScreenSharing ? <MonitorOff className="h-3 w-3 sm:h-4 sm:w-4" /> : <Monitor className="h-3 w-3 sm:h-4 sm:w-4" />}
            </button>
          </>
        )}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          {isFullscreen ? <Minimize className="h-3 w-3 sm:h-4 sm:w-4" /> : <Maximize className="h-3 w-3 sm:h-4 sm:w-4" />}
        </button>
        <button
          onClick={() => leave(false)}
          title={role === "host" ? "End stream" : "Leave class"}
          className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-destructive text-white hover:opacity-90 transition-opacity"
        >
          <PhoneOff className="h-3 w-3 sm:h-4 sm:w-4" />
        </button>
      </div>
    </div>
  );
};

export default AgoraVideoRoom;
