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

const APP_ID = import.meta.env.VITE_AGORA_APP_ID as string | undefined;

async function fetchToken(channelName: string, uid: number, role: "host" | "audience"): Promise<string | null> {
  const isDev = import.meta.env.DEV;
  const url = isDev
    ? "/api/agora-token"
    : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agora-token`;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!isDev) {
      headers["apikey"] = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      headers["Authorization"] = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ channelName, uid, role }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error ?? `HTTP ${res.status}`);
    }

    const data = await res.json() as { token: string | null };
    return data.token ?? null;
  } catch (e) {
    console.warn("[Agora] Token fetch failed, using null:", e);
    return null;
  }
}

// 0=unknown, 1=excellent, 2=good, 3=poor, 4=bad, 5=very bad, 6=disconnected
function NetworkBars({ quality }: { quality: number }) {
  const colors = [
    "text-white/40",  // 0 unknown
    "text-green-400", // 1 excellent
    "text-green-400", // 2 good
    "text-yellow-400",// 3 poor
    "text-red-400",   // 4 bad
    "text-red-500",   // 5 very bad
    "text-white/40",  // 6 disconnected
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
  const clientRef      = useRef<IAgoraRTCClient | null>(null);
  const localVideoRef  = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const containerRef   = useRef<HTMLDivElement>(null);
  const leftRef        = useRef(false);

  const [status,          setStatus]          = useState<ConnectionStatus>("connecting");
  const [micMuted,        setMicMuted]        = useState(false);
  const [camOff,          setCamOff]          = useState(false);
  const [hasRemoteVideo,  setHasRemoteVideo]  = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [networkQuality,  setNetworkQuality]  = useState(0);
  const [isFullscreen,    setIsFullscreen]    = useState(false);

  const pendingRemoteTrack = useRef<IRemoteVideoTrack | null>(null);
  const localTracksRef     = useRef<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null);
  const screenTrackRef     = useRef<ILocalVideoTrack | null>(null);

  const leave = useCallback(async () => {
    if (leftRef.current) return;
    if (role === "audience") {
      const ok = window.confirm("Leave the live class?");
      if (!ok) return;
    }
    leftRef.current = true;
    const client = clientRef.current;
    if (!client) return;
    if (screenTrackRef.current) {
      try { screenTrackRef.current.stop(); screenTrackRef.current.close(); } catch (_) { /* */ }
      screenTrackRef.current = null;
    }
    if (localTracksRef.current) {
      try { localTracksRef.current[0].stop(); localTracksRef.current[0].close(); } catch (_) { /* */ }
      try { localTracksRef.current[1].stop(); localTracksRef.current[1].close(); } catch (_) { /* */ }
      localTracksRef.current = null;
    }
    try { await client.leave(); } catch (_) { /* */ }
    setStatus("disconnected");
    onLeave?.();
  }, [onLeave, role]);

  // Play pending remote track once div is visible
  useEffect(() => {
    if (!hasRemoteVideo || !pendingRemoteTrack.current) return;
    const track = pendingRemoteTrack.current;
    requestAnimationFrame(() => {
      if (remoteVideoRef.current) track.play(remoteVideoRef.current);
    });
  }, [hasRemoteVideo]);

  useEffect(() => {
    leftRef.current = false;

    if (!APP_ID) {
      setError("Agora App ID is missing. Add VITE_AGORA_APP_ID to .env and restart the dev server.");
      setStatus("disconnected");
      return;
    }

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
        await client.setClientRole(role);
        const token = await fetchToken(channelName, uid, role);
        await client.join(APP_ID, channelName, token, uid === 0 ? null : uid);
        setStatus("live");

        if (role === "host") {
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            { encoderConfig: "music_standard" },
            { encoderConfig: "720p_1" },
          );
          localTracksRef.current = [audioTrack, videoTrack];
          if (localVideoRef.current) videoTrack.play(localVideoRef.current);
          await client.publish([audioTrack, videoTrack]);
        }
      } catch (err: unknown) {
        if (leftRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        let friendly = `Failed to connect: ${msg}`;
        if (msg.includes("Permission") || msg.includes("NotAllowed")) {
          friendly = "Camera or microphone permission denied. Click the camera icon in your browser's address bar, allow access, then refresh.";
        } else if (msg.includes("NotFound") || msg.includes("device")) {
          friendly = "No camera or microphone found. Please connect a device and refresh.";
        } else if (msg.includes("CAN_NOT_GET_GATEWAY") || msg.includes("dynamic use static")) {
          friendly = "Agora token error: your project requires a signed token. Restart the dev server so AGORA_APP_CERTIFICATE is loaded, then try again.";
        }
        setError(friendly);
        setStatus("disconnected");
        toast.error("Stream connection failed");
      }
    };

    join();
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, role]);

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

        // Handle user stopping screen share via browser's native stop button
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
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full min-h-[240px] bg-[#0a0a0a] overflow-hidden">
      {/* Status pill */}
      <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
        {status === "connecting"   && <><Loader2 className="h-3 w-3 animate-spin" /> Connecting…</>}
        {status === "live"         && <><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE</>}
        {status === "disconnected" && <><WifiOff className="h-3 w-3 text-destructive" /> Disconnected</>}
      </div>

      {/* Network quality — top right */}
      {status === "live" && networkQuality > 0 && (
        <div className="absolute top-3 right-3 z-20 rounded-full bg-black/70 px-2.5 py-1 backdrop-blur-sm">
          <NetworkBars quality={networkQuality} />
        </div>
      )}

      {/* Video area */}
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

      {/* Controls bar */}
      <div className="absolute bottom-0 inset-x-0 z-20 flex items-center justify-center gap-3 py-3 bg-gradient-to-t from-black/80 to-transparent">
        {role === "host" && (
          <>
            <button
              onClick={toggleMic}
              title={micMuted ? "Unmute mic" : "Mute mic"}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors
                ${micMuted ? "bg-destructive text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={toggleCam}
              title={camOff ? "Turn camera on" : "Turn camera off"}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors
                ${camOff ? "bg-destructive text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              {camOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
            </button>
            <button
              onClick={toggleScreenShare}
              title={isScreenSharing ? "Stop screen share" : "Share screen"}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors
                ${isScreenSharing ? "bg-blue-600 text-white" : "bg-white/10 text-white hover:bg-white/20"}`}
            >
              {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
            </button>
          </>
        )}
        <button
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        >
          {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
        </button>
        <button
          onClick={leave}
          title={role === "host" ? "End stream" : "Leave class"}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-white hover:opacity-90 transition-opacity"
        >
          <PhoneOff className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default AgoraVideoRoom;
