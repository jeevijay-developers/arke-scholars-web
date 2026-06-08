import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    hmr: { overlay: false },
    allowedHosts: [
      "clash-antivirus-yearly.ngrok-free.dev"
    ]
  },
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: [
      "react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime",
      "@tanstack/react-query", "@tanstack/query-core",
    ],
  },
  build: {
    target: "es2019",
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "router": ["react-router-dom"],
          "supabase": ["@supabase/supabase-js"],
          "query": ["@tanstack/react-query"],
          "math": ["katex", "mathlive"],
          "charts": ["recharts"],
        },
      },
    },
  },
});
