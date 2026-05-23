import React from "react";
import { hydrateRoot, createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "katex/dist/katex.min.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

if (rootElement.hasChildNodes()) {
  // Pre-rendered HTML from react-snap — hydrate instead of replacing
  hydrateRoot(
    rootElement,
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
