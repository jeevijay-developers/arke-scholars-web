import { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  ICameraVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteVideoTrack,
  IRemoteAudioTrack,
} from "agora-rtc-sdk-ng";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, WifiOff, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const APP_ID = import.meta.env.VITE_AGORA_APP_ID as string | undefined;

async function fetchToken(channelName: string, uid: number, role: "host" | "audience"): Promise<string | null> {
  const isDev = import.meta.env.DEV;
  const url   = isDev
    ? "/api/agora-token"
    : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agora-token`;

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (!isDev) {
      headers["apikey"]        = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      headers["Authorization"] = `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string}`;
    }

    const res = await fetch(url, {
      method:  "POST",
      headers,
      body:    JSON.stringify({ channelName, uid, role }),
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
  const leftRef        = useRef(false);

  const [status,         setStatus]         = useState<ConnectionStatus>("connecting");
  const [micMuted,       setMicMuted]       = useState(false);
  const [camOff,         setCamOff]         = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [error,          setError]          = useState<string | null>(null);

  // Store the pending remote video track so we can play it after the ref mounts
  const pendingRemoteTrack = useRef<IRemoteVideoTrack | null>(null);

  const localTracksRef = useRef<[IMicrophoneAudioTrack, ICameraVideoTrack] | null>(null);

  const leave = useCallback(async () => {
    if (leftRef.current) return;
    leftRef.current = true;
    const client = clientRef.current;
    if (!client) return;
    if (localTracksRef.current) {
      try { localTracksRef.current[0].stop(); localTracksRef.current[0].close(); } catch (_) { /* */ }
      try { localTracksRef.current[1].stop(); localTracksRef.current[1].close(); } catch (_) { /* */ }
      localTracksRef.current = null;
    }
    try { await client.leave(); } catch (_) { /* */ }
    setStatus("disconnected");
    onLeave?.();
  }, [onLeave]);

  // Once hasRemoteVideo flips true, play the pending track into the now-visible ref
  useEffect(() => {
    if (!hasRemoteVideo || !pendingRemoteTrack.current) return;
    const track = pendingRemoteTrack.current;
    // Use rAF to ensure the DOM element has painted with real dimensions
    requestAnimationFrame(() => {
      if (remoteVideoRef.current) {
        track.play(remoteVideoRef.current);
      }
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
        // Store the track and let the state-driven effect play it once the div is visible
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

    const join = async () => {
      try {
        await client.setClientRole(role);
        const token = await fetchToken(channelName, uid, role);
        await client.join(APP_ID, channelName, token, uid === 0 ? null : uid);
        setStatus("live");

        if (role === "host") {
          const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
            { encoderConfig: "music_standard" },
            { encoderConfig: "480p_1" },
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
          friendly = "Agora token error: your project requires a signed token. Restart the dev server so VITE_AGORA_APP_CERTIFICATE is loaded, then try again.";
        }
        setError(friendly);
        setStatus("disconnected");
        toast.error("Stream connection failed");
      }
    };

    join();
    return () => { leave(); };
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

  if (error) {
    return (
      <div className="flex h-full w-full min-h-[240px] flex-col items-center justify-center gap-3 bg-[#0a0a0a] p-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive shrink-0" />
        <p className="text-sm text-white/80 max-w-sm leading-relaxed">{error}</p>
      </div>
    );
  }

  return (
    /*
     * Single stacking context: video fills the entire container, controls bar
     * is absolutely pinned to the bottom. No flex-col split that would cause
     * the video area to overflow and appear twice.
     */
    <div className="relative h-full w-full min-h-[240px] bg-[#0a0a0a] overflow-hidden">
      {/* Status pill */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
        {status === "connecting"   && <><Loader2 className="h-3 w-3 animate-spin" /> Connecting…</>}
        {status === "live"         && <><span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" /> LIVE</>}
        {status === "disconnected" && <><WifiOff className="h-3 w-3 text-destructive" /> Disconnected</>}
      </div>

      {/* Video area — fills the whole container */}
      {role === "audience" && (
        <>
          {/* Remote video always mounted so the ref exists when track.play() fires */}
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
          {camOff && status === "live" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#111] z-10">
              <VideoOff className="h-10 w-10 text-white/30" />
              <p className="text-xs text-white/40">Camera is off</p>
            </div>
          )}
        </>
      )}

      {/* Controls bar — overlaid at the bottom */}
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
          </>
        )}
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
