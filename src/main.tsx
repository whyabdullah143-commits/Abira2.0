// Define global polyfills for browser compatibility with Node-dependent libraries
if (typeof (window as any).global === "undefined") {
  (window as any).global = window;
}
if (typeof (window as any).process === "undefined") {
  (window as any).process = {
    env: {
      NODE_ENV: "production",
    },
    platform: "browser",
    browser: true,
    version: "",
    versions: {},
    nextTick: (cb: any) => setTimeout(cb, 0),
  };
} else {
  const proc = (window as any).process;
  if (!proc.env) proc.env = { NODE_ENV: "production" };
  if (!proc.platform) proc.platform = "browser";
  if (!proc.browser) proc.browser = true;
  if (!proc.nextTick) proc.nextTick = (cb: any) => setTimeout(cb, 0);
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
