import AgoraRTC from "agora-rtc-sdk-ng";

export const agoraClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
