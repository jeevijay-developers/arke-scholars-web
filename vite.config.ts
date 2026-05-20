import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import agoraToken from "agora-token";
const { RtcTokenBuilder, RtcRole } = agoraToken;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv reads .env files correctly (strips quotes, handles all formats)
  const env     = loadEnv(mode, process.cwd(), "");
  const appId   = env.VITE_AGORA_APP_ID;
  const appCert = env.AGORA_APP_CERTIFICATE;

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: { overlay: false },
    },
    plugins: [
      react(),
      // Agora token endpoint — Node.js only, certificate never reaches the browser
      {
        name: "agora-token-dev",
        configureServer(server) {
          server.middlewares.use("/api/agora-token", (req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            if (req.method === "OPTIONS") { res.end("{}"); return; }

            if (!appId || !appCert) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: "VITE_AGORA_APP_ID or VITE_AGORA_APP_CERTIFICATE missing in .env" }));
              return;
            }

            let body = "";
            req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
            req.on("end", () => {
              try {
                const parsed      = JSON.parse(body || "{}") as { channelName?: string; uid?: number; role?: string };
                const channelName = parsed.channelName;
                const uid         = parsed.uid ?? 0;
                const role        = parsed.role ?? "audience";

                if (!channelName) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "channelName is required" }));
                  return;
                }

                const agoraRole = role === "host" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
                const expiry    = Math.floor(Date.now() / 1000) + 3600;
                const token     = RtcTokenBuilder.buildTokenWithUid(
                  appId, appCert, channelName, uid, agoraRole, expiry, expiry,
                );

                res.end(JSON.stringify({ token }));
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: msg }));
              }
            });
          });
        },
      },
      // Agora cloud recording endpoint — development mock
      {
        name: "agora-cloud-recording-dev",
        configureServer(server) {
          server.middlewares.use("/api/agora-cloud-recording", (req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            if (req.method === "OPTIONS") { res.end("{}"); return; }

            let body = "";
            req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
            req.on("end", () => {
              try {
                const parsed = JSON.parse(body || "{}") as { action?: string };
                if (parsed.action === "start") {
                  res.end(JSON.stringify({
                    success: true,
                    resourceId: "mock-resource-" + Date.now(),
                    sid: "mock-sid-" + Date.now(),
                  }));
                } else if (parsed.action === "stop") {
                  res.end(JSON.stringify({
                    success: true,
                    fileList: [{ filename: "recording-" + Date.now() + ".m3u8" }],
                    recordingUrl: "https://example.com/recording.m3u8",
                  }));
                } else {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "Invalid action" }));
                }
              } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                res.statusCode = 500;
                res.end(JSON.stringify({ error: msg }));
              }
            });
          });
        },
      },
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
      dedupe: [
        "react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime",
        "@tanstack/react-query", "@tanstack/query-core",
      ],
    },
  };
});
