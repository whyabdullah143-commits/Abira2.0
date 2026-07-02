import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, Paperclip, X, FileText, MessageSquare, Palette, Video, VideoOff, Camera, SwitchCamera, Copy, Check, ZoomIn, ZoomOut, Menu, Settings, SlidersHorizontal, Volume1, Activity, Clock, Cpu, Sparkles, ExternalLink } from "lucide-react";
import { getAbiraResponse, getAbiraAudio, resetAbiraSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer from "./components/Visualizer";
import { 
  isSupabaseConfigured, 
  loadMessagesFromSupabase, 
  syncMessagesToSupabase, 
  clearMessagesInSupabase,
  testSupabaseConnection
} from "./services/supabaseService";
import WeatherCard from "./components/WeatherCard";
import PermissionModal from "./components/PermissionModal";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

// Professional helper to parse message text into high-fidelity formatted layout
function formatMessageText(text: string, theme: "dark" | "purple" | "blue" | "neon" | "cyberpunk" | "classic" = "dark") {
  if (!text) return null;

  // Split by code blocks
  const parts = text.split(/(```[\s\S]*?```)/g);

  const isCyberpunk = theme === "cyberpunk" || theme === "neon";
  const isClassic = theme === "classic" || theme === "purple" || theme === "blue";

  return parts.map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      const codeLines = part.slice(3, -3).trim().split("\n");
      let language = "code";
      if (codeLines[0] && codeLines[0].length < 15 && !codeLines[0].includes(" ") && !codeLines[0].includes("=") && !codeLines[0].includes("(")) {
        language = codeLines[0];
        codeLines.shift();
      }
      const codeText = codeLines.join("\n");

      const codeBg = isCyberpunk ? "bg-black border-cyan-500/20 text-cyan-300" : isClassic ? "bg-neutral-900 border-amber-500/30 text-amber-100" : "bg-neutral-950/80 border-white/10 text-violet-200";

      return (
        <div key={index} className={`my-2 rounded-lg p-3 border font-mono text-xs overflow-x-auto select-text ${codeBg}`}>
          {language && language !== "code" && (
            <div className={`text-[9px] uppercase tracking-wider border-b pb-1 mb-1.5 font-bold ${
              isCyberpunk ? "border-cyan-500/10 text-cyan-400" : isClassic ? "border-amber-500/10 text-amber-400" : "border-white/5 text-white/40"
            }`}>
              {language}
            </div>
          )}
          <pre className="whitespace-pre">{codeText}</pre>
        </div>
      );
    }

    // Handle normal text formatting: bold (**) and line breaks
    const subParts = part.split("\n");
    return (
      <div key={index} className="space-y-1.5 leading-relaxed text-sm">
        {subParts.map((line, lineIdx) => {
          if (line.trim() === "") {
            return <div key={lineIdx} className="h-3" />;
          }

          // If bullet point
          const isBullet = line.startsWith("- ") || line.startsWith("* ");
          const contentLine = isBullet ? line.substring(2) : line;

          const boldParts = contentLine.split(/(\*\*.*?\*\*)/g);
          const renderedLine = boldParts.map((bPart, bIdx) => {
            if (bPart.startsWith("**") && bPart.endsWith("**")) {
              const boldClr = isCyberpunk ? "text-fuchsia-400 font-bold" : isClassic ? "text-amber-400 font-bold" : "text-white font-semibold";
              return <strong key={bIdx} className={boldClr}>{bPart.slice(2, -2)}</strong>;
            }
            return bPart;
          });

          const textColor = isCyberpunk ? "text-green-300" : isClassic ? "text-amber-100" : "text-white/95";

          if (isBullet) {
            return (
              <ul key={lineIdx} className={`list-disc list-inside pl-1.5 ${textColor}`}>
                <li className="inline">{renderedLine}</li>
              </ul>
            );
          }

          return <p key={lineIdx} className={`${textColor} break-words whitespace-pre-wrap`}>{renderedLine}</p>;
        })}
      </div>
    );
  });
}

interface TypewriterMessageProps {
  text: string;
  onComplete?: () => void;
  theme?: "dark" | "cyberpunk" | "classic";
}

function TypewriterMessage({ text, onComplete, theme = "dark" }: TypewriterMessageProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isDone, setIsDone] = useState(false);
  const textRef = useRef(text);
  textRef.current = text;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let index = 0;
    const originalText = textRef.current;
    
    if (!originalText) {
      setIsDone(true);
      onCompleteRef.current?.();
      return;
    }

    // Fast typing pacing with adaptive speed for lengthier responses
    const interval = setInterval(() => {
      const step = originalText.length > 300 ? 3 : 2;
      index += step;
      
      if (index >= originalText.length) {
        clearInterval(interval);
        setDisplayedText(originalText);
        setIsDone(true);
        onCompleteRef.current?.();
      } else {
        setDisplayedText(originalText.slice(0, index));
      }
    }, 12);

    return () => clearInterval(interval);
  }, [text]);

  const handleSkip = () => {
    if (!isDone) {
      setDisplayedText(text);
      setIsDone(true);
      onComplete?.();
    }
  };

  const cursorBg = theme === "cyberpunk" ? "bg-cyan-400" : theme === "classic" ? "bg-amber-400" : "bg-violet-400";

  return (
    <div 
      onClick={handleSkip} 
      className={!isDone ? "cursor-pointer select-none active:scale-[0.99] transition-transform" : ""}
      title={!isDone ? "Click to instantly complete typing" : undefined}
    >
      {formatMessageText(displayedText, theme)}
      {!isDone && (
        <span className={`inline-block w-1.5 h-3.5 ml-1 animate-[pulse_1s_infinite] rounded-sm align-middle ${cursorBg}`} />
      )}
    </div>
  );
}

function CopyButton({ text, theme = "dark" }: { text: string; theme?: "dark" | "cyberpunk" | "classic" | "purple" | "blue" | "neon" }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  };

  const isCyberpunk = theme === "cyberpunk" || theme === "neon";
  const isClassic = theme === "classic" || theme === "purple" || theme === "blue";

  const btnBg = isCyberpunk 
    ? "bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/10" 
    : isClassic 
      ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/10" 
      : "bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/5";

  return (
    <button
      onClick={handleCopy}
      className={`p-1 px-1.5 rounded transition-all cursor-pointer flex items-center gap-1 text-[9px] uppercase font-mono tracking-wider ${btnBg}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <>
          <Check size={9.5} className="text-green-400 animate-pulse" />
          <span className="text-green-400 font-bold">Copied</span>
        </>
      ) : (
        <>
          <Copy size={9.5} />
          <span>Copy</span>
        </>
      )}
    </button>
  );
}

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "abira";
  text: string;
}

const themeConfigs = {
  dark: {
    bg: "bg-[#06060c]",
    text: "text-slate-300",
    font: "font-sans",
    headerBg: "bg-black/30 backdrop-blur-md border-b border-white/5",
    accentColor: "from-violet-500 to-cyan-500",
    buttonPrimary: "bg-violet-600/90 hover:bg-violet-500 text-white shadow-lg",
    buttonSecondary: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
    glowDot: "bg-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.6)]",
    chatBoxBg: "bg-[#080812ef] border-white/10",
    bubbleUser: "bg-gradient-to-br from-violet-600 to-cyan-600 text-white rounded-tr-none",
    bubbleAI: "bg-white/5 border border-white/10 text-white/90 rounded-tl-none",
    footerInput: "bg-black/40 border-white/10 text-white placeholder:text-white/30",
    badgeLabel: "text-violet-400 uppercase tracking-widest",
    sendButton: "bg-violet-600 hover:bg-violet-500 text-white disabled:bg-violet-600/50",
    activeSessionButton: "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30",
    inactiveSessionButton: "bg-[#0c0a13] text-white border border-white/20 hover:bg-white/5",
    typewriterCursor: "bg-violet-400",
    glowText: "text-violet-400 drop-shadow-[0_0_8px_rgba(139,92,246,0.5)]",
    cardBorder: "border-white/10 bg-white/5",
    orbGlow: "shadow-violet-500/50",
    orbColor: "rgba(139, 92, 246, 1)",
    orbGradient: "from-violet-600 via-purple-600 to-cyan-500",
    textColor: "text-violet-400"
  },
  purple: {
    bg: "bg-[#080410]",
    text: "text-fuchsia-200",
    font: "font-sans",
    headerBg: "bg-black/30 backdrop-blur-md border-b border-fuchsia-500/10",
    accentColor: "from-fuchsia-500 to-purple-600",
    buttonPrimary: "bg-fuchsia-600 hover:bg-fuchsia-500 text-white shadow-lg",
    buttonSecondary: "bg-white/5 hover:bg-white/10 text-fuchsia-300 border border-fuchsia-100/10",
    glowDot: "bg-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.5)]",
    chatBoxBg: "bg-[#080410ef] border-fuchsia-500/20",
    bubbleUser: "bg-gradient-to-br from-fuchsia-600 to-purple-600 text-white rounded-tr-none",
    bubbleAI: "bg-white/5 border border-white/10 text-white/90 rounded-tl-none",
    footerInput: "bg-black/40 border-fuchsia-500/20 text-fuchsia-200 placeholder:text-fuchsia-500/30",
    badgeLabel: "text-fuchsia-400 uppercase tracking-widest",
    sendButton: "bg-fuchsia-600 hover:bg-fuchsia-500 text-white disabled:bg-fuchsia-600/50",
    activeSessionButton: "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30",
    inactiveSessionButton: "bg-[#080410] text-fuchsia-200 border border-fuchsia-500/30 hover:bg-fuchsia-500/10",
    typewriterCursor: "bg-fuchsia-400",
    glowText: "text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,2,239,0.5)]",
    cardBorder: "border-fuchsia-500/20 bg-fuchsia-950/20",
    orbGlow: "shadow-fuchsia-500/50",
    orbColor: "rgba(217, 70, 239, 1)",
    orbGradient: "from-fuchsia-600 via-purple-600 to-pink-500",
    textColor: "text-fuchsia-400"
  },
  blue: {
    bg: "bg-[#020916]",
    text: "text-cyan-200",
    font: "font-sans",
    headerBg: "bg-black/30 backdrop-blur-md border-b border-cyan-500/10",
    accentColor: "from-cyan-500 to-blue-600",
    buttonPrimary: "bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg",
    buttonSecondary: "bg-white/5 hover:bg-white/10 text-cyan-200 border border-cyan-500/20",
    glowDot: "bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.5)]",
    chatBoxBg: "bg-[#020916ef] border-cyan-500/20",
    bubbleUser: "bg-gradient-to-br from-cyan-600 to-blue-600 text-white rounded-tr-none",
    bubbleAI: "bg-white/5 border border-white/10 text-white/90 rounded-tl-none",
    footerInput: "bg-black/40 border-cyan-500/20 text-cyan-200 placeholder:text-cyan-500/30",
    badgeLabel: "text-cyan-400 uppercase tracking-widest",
    sendButton: "bg-cyan-600 hover:bg-cyan-500 text-white disabled:bg-cyan-600/50",
    activeSessionButton: "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30",
    inactiveSessionButton: "bg-[#020916] text-cyan-200 border border-cyan-500/30 hover:bg-cyan-500/10",
    typewriterCursor: "bg-cyan-400",
    glowText: "text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]",
    cardBorder: "border-cyan-500/20 bg-cyan-950/20",
    orbGlow: "shadow-cyan-500/50",
    orbColor: "rgba(6, 182, 212, 1)",
    orbGradient: "from-cyan-500 via-blue-500 to-indigo-500",
    textColor: "text-cyan-400"
  },
  neon: {
    bg: "bg-[#010402]",
    text: "text-emerald-300",
    font: "font-mono font-medium",
    headerBg: "bg-[#010402]/85 border-b border-green-500/20",
    accentColor: "from-green-500 to-emerald-600",
    buttonPrimary: "bg-green-500 hover:bg-green-400 text-black shadow-lg",
    buttonSecondary: "bg-white/5 hover:bg-white/10 text-green-300 border border-green-500/20",
    glowDot: "bg-green-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]",
    chatBoxBg: "bg-[#010402ef] border-green-500/20",
    bubbleUser: "bg-gradient-to-br from-green-600 to-emerald-600 text-black rounded-tr-none font-bold",
    bubbleAI: "bg-white/5 border border-white/10 text-white/90 rounded-tl-none",
    footerInput: "bg-black/40 border-green-500/20 text-green-300 placeholder:text-green-500/30",
    badgeLabel: "text-green-400 uppercase tracking-widest",
    sendButton: "bg-green-500 hover:bg-green-400 text-black disabled:bg-green-500/50",
    activeSessionButton: "bg-red-950/80 text-red-400 border border-red-500/50 hover:bg-red-900/40",
    inactiveSessionButton: "bg-[#010402] text-green-300 border border-green-500/30 hover:bg-green-500/10",
    typewriterCursor: "bg-green-400",
    glowText: "text-green-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]",
    cardBorder: "border-green-500/20 bg-green-950/20",
    orbGlow: "shadow-green-500/50",
    orbColor: "rgba(16, 185, 129, 1)",
    orbGradient: "from-green-400 via-emerald-500 to-teal-500",
    textColor: "text-green-400"
  }
};

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [theme, setTheme] = useState<"dark" | "purple" | "blue" | "neon">(() => {
    const saved = localStorage.getItem("abira_theme");
    if (saved === "cyberpunk") return "neon";
    if (saved === "classic") return "purple";
    if (saved && ["dark", "purple", "blue", "neon"].includes(saved)) {
      return saved as any;
    }
    return "dark";
  });

  const [prevTheme, setPrevTheme] = useState<"dark" | "purple" | "blue" | "neon" | null>(null);
  const themeRef = useRef(theme);

  useEffect(() => {
    if (themeRef.current !== theme) {
      setPrevTheme(themeRef.current);
      themeRef.current = theme;
    }
    localStorage.setItem("abira_theme", theme);
  }, [theme]);

  const [appState, setAppState] = useState<AppState>("idle");
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch (e) {
      setIsInIframe(true);
    }
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("abira_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  const [completedTypingIds, setCompletedTypingIds] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("abira_chat_history");
    if (saved) {
      try {
        const history = JSON.parse(saved);
        if (Array.isArray(history)) {
          const initial: Record<string, boolean> = {};
          for (const item of history) {
            if (item && item.id) {
              initial[item.id] = true;
            }
          }
          return initial;
        }
      } catch (e) {
        console.error("Failed to extract completed typing IDs from history", e);
      }
    }
    return {};
  });

  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const syncedIdsRef = useRef<Set<string>>(new Set<string>());

  // Load chat history from Supabase if configured when app boots
  useEffect(() => {
    const initSupabase = async () => {
      if (isSupabaseConfigured()) {
        try {
          const testRes = await testSupabaseConnection();
          if (testRes.success) {
            setIsSupabaseConnected(true);
            const dbMessages = await loadMessagesFromSupabase();
            if (dbMessages && dbMessages.length > 0) {
              // Populate syncedIdsRef with loaded message IDs
              dbMessages.forEach(msg => syncedIdsRef.current.add(msg.id));
              setMessages(dbMessages);
              
              // Re-populate completedTypingIds so they do not animate typing again
              const initial: Record<string, boolean> = {};
              for (const item of dbMessages) {
                if (item && item.id) {
                  initial[item.id] = true;
                }
              }
              setCompletedTypingIds(initial);
            } else if (messagesRef.current.length > 0) {
              // Supabase is connected but empty, whereas we have local chats! Back them up.
              console.log("Supabase is empty. Syncing existing local chats...");
              const success = await syncMessagesToSupabase(messagesRef.current);
              if (success) {
                messagesRef.current.forEach(msg => syncedIdsRef.current.add(msg.id));
              }
            }
          } else {
            console.warn("Supabase connection check failed (perhaps table abira_messages is not created yet):", testRes.error);
            setIsSupabaseConnected(false);
          }
        } catch (err) {
          console.error("Failed to initialize Supabase messages:", err);
          setIsSupabaseConnected(false);
        }
      } else {
        setIsSupabaseConnected(false);
      }
    };
    initSupabase();
  }, []);

  // Sync state with LocalStorage and Supabase automatically
  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("abira_chat_history", JSON.stringify(messages));

    if (isSupabaseConfigured() && isSupabaseConnected) {
      if (messages.length === 0) {
        // Chat was cleared! Clear in Supabase too
        clearMessagesInSupabase();
        syncedIdsRef.current.clear();
      } else {
        const unsyncedMessages = messages.filter(msg => !syncedIdsRef.current.has(msg.id));
        if (unsyncedMessages.length > 0) {
          // Optimistically mark them as synced to prevent parallel hook race conditions
          unsyncedMessages.forEach(msg => syncedIdsRef.current.add(msg.id));
          
          syncMessagesToSupabase(unsyncedMessages).then((success) => {
            if (!success) {
              // Revert on failure so it can retry
              unsyncedMessages.forEach(msg => syncedIdsRef.current.delete(msg.id));
            }
          });
        }
      }
    }
  }, [messages, isSupabaseConnected]);

  const [isMuted, setIsMuted] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMicMuted = isMicMuted;
    }
  }, [isMicMuted]);

  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(() => {
    return localStorage.getItem("abira_wakeword_enabled") !== "false";
  });
  const [isWakeWordListening, setIsWakeWordListening] = useState(false);
  const wakeWordRecognitionRef = useRef<any>(null);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [permissionModalType, setPermissionModalType] = useState<"microphone" | "camera" | "both">("microphone");
  const [isSessionActive, setIsSessionActive] = useState(false);

  // High-performance camera vision states and refs
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraIntervalRef = useRef<any>(null);
  
  const [cameraZoom, setCameraZoom] = useState(1);
  const cameraZoomRef = useRef(1);

  useEffect(() => {
    cameraZoomRef.current = cameraZoom;
  }, [cameraZoom]);

  const applyHardwareZoom = useCallback(async (zoomVal: number) => {
    if (!cameraStreamRef.current) return;
    const track = cameraStreamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      if (typeof track.getCapabilities === "function") {
        const capabilities = track.getCapabilities() as any;
        if (capabilities && capabilities.zoom) {
          const min = capabilities.zoom.min || 1;
          const max = capabilities.zoom.max || 10;
          const targetZoom = Math.max(min, Math.min(max, zoomVal));
          await track.applyConstraints({
            advanced: [{ zoom: targetZoom }] as any
          });
          console.log(`Applied hardware zoom constraint: ${targetZoom}`);
        }
      }
    } catch (e) {
      console.warn("Failed to apply hardware zoom track constraints:", e);
    }
  }, []);

  const handleZoom = useCallback((action: "zoom_in" | "zoom_out" | "normal", factor?: number) => {
    setCameraZoom((current) => {
      let nextZoom = current;
      if (action === "zoom_in") {
        if (factor) {
          nextZoom = Math.min(5, Math.max(1, factor));
        } else {
          nextZoom = Math.min(5, current + 1); // 1x increment
        }
      } else if (action === "zoom_out") {
        if (factor) {
          nextZoom = Math.max(1, factor);
        } else {
          nextZoom = Math.max(1, current - 1); // 1x decrement
        }
      } else if (action === "normal") {
        nextZoom = 1;
      }
      
      applyHardwareZoom(nextZoom);
      return nextZoom;
    });
  }, [applyHardwareZoom]);

  // Stop camera utility to guarantee absolute closure of tracks and release device locks
  const stopCamera = useCallback(() => {
    setIsCameraOn(false);
    setCameraStream(null);
    if (cameraIntervalRef.current) {
      clearInterval(cameraIntervalRef.current);
      cameraIntervalRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log(`Stopped camera track: ${track.label}`);
      });
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Define refs to prevent stale closure in camera frame capture interval
  const isSessionActiveRef = useRef(isSessionActive);
  const cameraFacingModeRef = useRef(cameraFacingMode);

  useEffect(() => {
    isSessionActiveRef.current = isSessionActive;
  }, [isSessionActive]);

  useEffect(() => {
    cameraFacingModeRef.current = cameraFacingMode;
  }, [cameraFacingMode]);

  // Frame capture and feed generation
  const captureAndSendFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video || !cameraStreamRef.current) return;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        if (cameraFacingModeRef.current === "user") {
          // Naturally mirror selfie (user) view in canvas
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        
        const zoom = cameraZoomRef.current || 1;
        const vWidth = video.videoWidth || 640;
        const vHeight = video.videoHeight || 480;

        if (zoom > 1) {
          const sWidth = vWidth / zoom;
          const sHeight = vHeight / zoom;
          const sx = (vWidth - sWidth) / 2;
          const sy = (vHeight - sHeight) / 2;
          ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        
        const base64Data = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
        if (liveSessionRef.current && isSessionActiveRef.current) {
          console.log("Sending video frame to Abira...");
          liveSessionRef.current.sendVideoFrame(base64Data);
        }
      }
    } catch (e) {
      console.error("Failed to capture and send frame:", e);
    }
  }, []);

  // Request media inputs & start camera transmission
  const startCamera = useCallback(async (facing: "user" | "environment" = cameraFacingModeRef.current) => {
    try {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      setCameraStream(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: facing
        }
      });

      cameraStreamRef.current = stream;
      setCameraStream(stream);
      setIsCameraOn(true);

      // Instantly bind the fresh stream to the HTML video element node
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.play().catch(e => console.warn("Video playback autoplay blocked inside startCamera:", e));
      }

      // Try applying active zoom setting to the new camera track natively
      setTimeout(() => {
        applyHardwareZoom(cameraZoomRef.current);
      }, 300);

      // Start frame intervals (1.5 seconds)
      if (cameraIntervalRef.current) {
        clearInterval(cameraIntervalRef.current);
      }
      cameraIntervalRef.current = setInterval(() => {
        captureAndSendFrame();
      }, 1500);

    } catch (err: any) {
      const errMsg = err?.message || String(err);
      if (errMsg.includes("Permission") || errMsg.includes("Allowed") || errMsg.includes("device") || errMsg.includes("NotAllowedError")) {
        console.warn("Camera vision hardware access denied:", err);
      } else {
        console.error("Camera vision hardware access denied:", err);
      }
      setPermissionModalType("camera");
      setShowPermissionModal(true);
      setIsCameraOn(false);
      setCameraStream(null);
    }
  }, [captureAndSendFrame, applyHardwareZoom]);

  // Robustly bind the live media stream to the video element node upon mounting or state updates
  useEffect(() => {
    if (isCameraOn && cameraStream) {
      const video = videoRef.current;
      if (video) {
        if (video.srcObject !== cameraStream) {
          video.srcObject = cameraStream;
        }
        video.play().catch(e => console.warn("Video playback autoplay blocked:", e));
        return;
      }

      // Safeguard for React render cycle intervals / scheduling lag
      const timer = setTimeout(() => {
        if (videoRef.current && cameraStream) {
          if (videoRef.current.srcObject !== cameraStream) {
            videoRef.current.srcObject = cameraStream;
          }
          videoRef.current.play().catch(e => console.warn("Video playback autoplay blocked on retry:", e));
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isCameraOn, cameraFacingMode, cameraStream]);

  // Automatically shut down camera access completely on session inactivation for absolute privacy
  useEffect(() => {
    if (!isSessionActive) {
      stopCamera();
    }
  }, [isSessionActive, stopCamera]);

  // Make sure to clean up camera tasks on component unmount
  useEffect(() => {
    return () => {
      if (cameraIntervalRef.current) {
        clearInterval(cameraIntervalRef.current);
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [liveVolume, setLiveVolume] = useState(0);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [assistantVolume, setAssistantVolume] = useState(() => {
    return Number(localStorage.getItem("abira_assistant_volume") || "100");
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);

  // Subscribe to audio volume level events
  useEffect(() => {
    const handleVolume = (e: any) => {
      setLiveVolume(e.detail?.volume || 0);
    };
    window.addEventListener("abira-volume", handleVolume);
    return () => {
      window.removeEventListener("abira-volume", handleVolume);
      setLiveVolume(0);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("abira_assistant_volume", assistantVolume.toString());
    if (assistantVolume === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  }, [assistantVolume, setIsMuted]);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.volumeScale = isMuted ? 0 : assistantVolume / 100;
    }
  }, [isMuted, assistantVolume]);

  const [chatInputText, setChatInputText] = useState("");
  const chatsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isChatOpen) {
      setTimeout(() => {
        chatsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [messages, isChatOpen, appState]);

  // File attachments state & ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFile, setAttachedFile] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const attachedFileRef = useRef(attachedFile);
  
  useEffect(() => {
    attachedFileRef.current = attachedFile;
  }, [attachedFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      alert("Please upload only PDF or Image files.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Please upload files smaller than 10MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(",")[1];
      setAttachedFile({
        data: base64String,
        mimeType: file.type,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const handleTextCommand = useCallback(async (finalTranscript: string, isVoice: boolean = false) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    // Intercept "session off karo" styled stop requests
    const lowerCmd = finalTranscript.toLowerCase().trim();
    if (
      lowerCmd.includes("session off") || 
      lowerCmd.includes("end session") || 
      lowerCmd.includes("band karo") || 
      lowerCmd.includes("band kro") || 
      lowerCmd.includes("bnd karo") || 
      lowerCmd.includes("bnd kro") ||
      lowerCmd.includes("band ho jao") ||
      lowerCmd.includes("band hojao") ||
      lowerCmd.includes("bnd ho jao") ||
      lowerCmd.includes("bnd hojao") ||
      lowerCmd.includes("chup ho jao") ||
      lowerCmd.includes("chup hojao") ||
      lowerCmd.includes("khamosh") ||
      lowerCmd.includes("shut down") ||
      lowerCmd.includes("turn off") ||
      lowerCmd.includes("silent") ||
      lowerCmd.includes("stop session")
    ) {
      setMessages((prev) => [...prev, { id: Date.now().toString(), sender: "user", text: finalTranscript }]);
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("speaking");
      const abiraEndMsg = "Session end kar diya hai, Abdullah. Dobara baat karne ke liye start button dabayein!";
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "abira", text: abiraEndMsg }]);
      
      if (isVoice && !isMuted) {
        const audioBase64 = await getAbiraAudio(abiraEndMsg);
        if (audioBase64) {
          await playPCM(audioBase64, isMuted ? 0 : assistantVolume / 100);
        }
      }
      setAppState("idle");
      resetAbiraSession();
      return;
    }

    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: "user", text: finalTranscript }]);
    
    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      if (attachedFileRef.current) {
        // Temporarily mute microphone of the live session to handle standard Gemini response safely
        liveSessionRef.current.isMicMuted = true;
      } else {
        liveSessionRef.current.sendText(finalTranscript);
        return;
      }
    }

    setAppState("processing");

    // 1. Check for browser commands
    const commandResult = processCommand(finalTranscript);

    let responseText = "";

    if (commandResult.isBrowserAction) {
      let targetVol = assistantVolume;
      if (commandResult.setVolume !== undefined) {
        if (commandResult.setVolume === -15) {
          targetVol = Math.max(0, assistantVolume - 15);
        } else if (commandResult.setVolume === 15) {
          targetVol = Math.min(100, assistantVolume + 15);
        } else {
          targetVol = commandResult.setVolume;
        }
        setAssistantVolume(targetVol);
      }

      responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "abira", text: responseText }]);
      
      if (isVoice && !isMuted) {
        setAppState("speaking");
        const audioBase64 = await getAbiraAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64, isMuted ? 0 : targetVol / 100);
        }
      }

      if (liveSessionRef.current) {
        liveSessionRef.current.isMicMuted = isMicMuted;
        setAppState("listening");
      } else {
        setAppState("idle");
      }

      setTimeout(() => {
        if (commandResult.url) {
          try {
            const tgtUrl = commandResult.url;
            if (tgtUrl.toLowerCase().includes("about:blank") || tgtUrl.toLowerCase().includes("aboutblank")) {
              console.warn("Blocked potentially invalid command URL:", tgtUrl);
            } else {
              window.open(tgtUrl, "_blank");
            }
          } catch (err) {
            console.error("Failed to open command URL safely:", err);
          }
        }
      }, 1500);
    } else {
      // 2. General Chit-Chat via Gemini
      const fileToUpload = attachedFileRef.current;
      setAttachedFile(null); // Clear selected file right away
      responseText = await getAbiraResponse(finalTranscript, messagesRef.current, fileToUpload);
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "abira", text: responseText }]);
      
      if (isVoice && !isMuted) {
        setAppState("speaking");
        const audioBase64 = await getAbiraAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64, isMuted ? 0 : assistantVolume / 100);
        }
      }
      
      if (liveSessionRef.current) {
        liveSessionRef.current.isMicMuted = isMicMuted;
        setAppState("listening");
      } else {
        setAppState("idle");
      }
    }
  }, [isMuted, isSessionActive]);

  const toggleListening = useCallback(async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetAbiraSession();
    } else {
      // Clear background wake-word listener first so there's no mic conflict
      if (wakeWordRecognitionRef.current) {
        try {
          wakeWordRecognitionRef.current.onend = null;
          wakeWordRecognitionRef.current.stop();
        } catch (e) {}
        wakeWordRecognitionRef.current = null;
        setIsWakeWordListening(false);
      }

      try {
        setIsSessionActive(true);
        resetAbiraSession();
        
        const session = new LiveSessionManager(messagesRef.current);
        session.isMuted = isMuted;
        session.isMicMuted = isMicMuted;
        session.volumeScale = isMuted ? 0 : assistantVolume / 100;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
          if (state === "idle") {
            setIsSessionActive(false);
          }
        };
        
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + sender, sender, text }]);
          
          if (sender === "user") {
            const lowerText = text.toLowerCase();
            if (
              lowerText.includes("session off") || 
              lowerText.includes("end session") || 
              lowerText.includes("band karo") || 
              lowerText.includes("band kro") || 
              lowerText.includes("bnd karo") || 
              lowerText.includes("bnd kro") ||
              lowerText.includes("band ho jao") ||
              lowerText.includes("band hojao") ||
              lowerText.includes("bnd ho jao") ||
              lowerText.includes("bnd hojao") ||
              lowerText.includes("chup ho jao") ||
              lowerText.includes("chup hojao") ||
              lowerText.includes("khamosh") ||
              lowerText.includes("shut down") ||
              lowerText.includes("turn off") ||
              lowerText.includes("silent") ||
              lowerText.includes("stop session")
            ) {
              setIsSessionActive(false);
              if (liveSessionRef.current) {
                liveSessionRef.current.stop();
                liveSessionRef.current = null;
              }
              setAppState("idle");
              resetAbiraSession();
            }
          }
        };
        
        session.onCommand = (url) => {
          setTimeout(() => {
            try {
              if (url) {
                const lowerUrl = url.toLowerCase();
                if (lowerUrl.includes("about:blank") || lowerUrl.includes("aboutblank")) {
                  console.warn("Blocked potentially invalid onCommand URL:", url);
                } else {
                  window.open(url, "_blank");
                }
              }
            } catch (err) {
              console.error("Failed to open onCommand URL safely:", err);
            }
          }, 1000);
        };

        session.onAppAction = (actionType, args) => {
          if (actionType === "open_camera") {
            const facing = args?.cameraFacing === "environment" ? "environment" : "user";
            setCameraFacingMode(facing);
            startCamera(facing);
          } else if (actionType === "close_camera") {
            stopCamera();
          } else if (actionType === "change_theme") {
            const themes: ("dark" | "purple" | "blue" | "neon")[] = ["dark", "purple", "blue", "neon"];
            setTheme((currentTheme) => {
              const requestedTheme = args?.themeName;
              if (requestedTheme) {
                if (requestedTheme === "cyberpunk") return "neon";
                if (requestedTheme === "classic") return "purple";
                if (themes.includes(requestedTheme as any)) {
                  return requestedTheme as any;
                }
              }
              const currentIndex = themes.indexOf(currentTheme);
              if (currentIndex === -1) return "dark";
              return themes[(currentIndex + 1) % themes.length];
            });
          } else if (actionType === "zoom_in") {
            const factor = args?.zoomFactor ? Number(args.zoomFactor) : undefined;
            handleZoom("zoom_in", factor);
          } else if (actionType === "zoom_out") {
            const factor = args?.zoomFactor ? Number(args.zoomFactor) : undefined;
            handleZoom("zoom_out", factor);
          } else if (actionType === "open_chat") {
            setIsChatOpen(true);
          } else if (actionType === "close_chat") {
            setIsChatOpen(false);
          } else if (actionType === "write_chat_message") {
            setIsChatOpen(true);
            if (args?.chatMessage) {
              setChatInputText(args.chatMessage);
              handleTextCommand(args.chatMessage);
            }
          } else if (actionType === "change_volume") {
            const level = args?.volumeLevel;
            if (typeof level === "number") {
              if (level === -15) {
                setAssistantVolume((prev) => Math.max(0, prev - 15));
              } else if (level === 15) {
                setAssistantVolume((prev) => Math.min(100, prev + 15));
              } else if (level >= 0 && level <= 100) {
                setAssistantVolume(level);
              }
            }
          }
        };

        await session.start();
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        if (errMsg.includes("Permission") || errMsg.includes("Allowed") || errMsg.includes("device") || errMsg.includes("NotAllowedError")) {
          console.warn("Session cancelled or permission denied:", e);
        } else {
          console.error("Failed to start session:", e);
        }
        setPermissionModalType("microphone");
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  }, [isSessionActive, isMuted, startCamera, stopCamera, setTheme, setIsChatOpen, setChatInputText, handleTextCommand]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  // Handle toggling the camera state explicitly by button
  const toggleCamera = useCallback(async () => {
    if (isCameraOn) {
      stopCamera();
    } else {
      // If session is inactive, boot up Abira as well
      if (!isSessionActive) {
        toggleListening();
      }
      await startCamera();
    }
  }, [isCameraOn, isSessionActive, toggleListening, startCamera, stopCamera]);

  // Handle switching video feed camera source (Front vs Back camera)
  const toggleCameraFacingMode = useCallback(async () => {
    const newFacing = cameraFacingMode === "user" ? "environment" : "user";
    setCameraFacingMode(newFacing);
    if (isCameraOn) {
      // Re-initialize stream with the new camera hardware source dynamically
      await startCamera(newFacing);
    }
  }, [cameraFacingMode, isCameraOn, startCamera]);

  // Background Wake Word Detection loop
  useEffect(() => {
    localStorage.setItem("abira_wakeword_enabled", isWakeWordEnabled.toString());

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn("SpeechRecognition not supported in this browser.");
      return;
    }

    let isStoppedPurposefully = false;

    if (isWakeWordEnabled && !isSessionActive && appState === "idle") {
      if (!wakeWordRecognitionRef.current) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "ur-PK"; // Optimized for Urdu and English context

          recognition.onstart = () => {
            setIsWakeWordListening(true);
            console.log("Wake word background engine started.");
          };

          recognition.onresult = (event: any) => {
            const resultsLength = event.results.length;
            for (let i = event.resultIndex; i < resultsLength; i++) {
              const transcript = event.results[i][0].transcript.toLowerCase();
              console.log("Background matching transcript:", transcript);
              if (
                transcript.includes("abira") ||
                transcript.includes("abeera") ||
                transcript.includes("abera") ||
                transcript.includes("hey abira") ||
                transcript.includes("hi abira") ||
                transcript.includes("bira") ||
                transcript.includes("hey abeera") ||
                transcript.includes("ہیلو ابیرا") ||
                transcript.includes("ابیرا")
              ) {
                console.log("Matched wake word: Abira!");
                isStoppedPurposefully = true;
                recognition.onend = null;
                try {
                  recognition.stop();
                } catch (e) {}
                wakeWordRecognitionRef.current = null;
                setIsWakeWordListening(false);
                
                // Start Session
                toggleListening();
                break;
              }
            }
          };

          recognition.onerror = (e: any) => {
            console.warn("Wake-word loop error:", e.error);
            if (e.error === "not-allowed") {
              setIsWakeWordEnabled(false);
            }
          };

          recognition.onend = () => {
            setIsWakeWordListening(false);
            wakeWordRecognitionRef.current = null;
            if (!isStoppedPurposefully && isWakeWordEnabled && !isSessionActive) {
              setTimeout(() => {
                if (isWakeWordEnabled && !isSessionActive && !wakeWordRecognitionRef.current) {
                  setIsWakeWordListening(prev => !prev);
                }
              }, 1000);
            }
          };

          wakeWordRecognitionRef.current = recognition;
          recognition.start();
        } catch (err) {
          console.error("Wake-word engine startup failure:", err);
        }
      }
    } else {
      if (wakeWordRecognitionRef.current) {
        isStoppedPurposefully = true;
        try {
          wakeWordRecognitionRef.current.onend = null;
          wakeWordRecognitionRef.current.stop();
        } catch (e) {}
        wakeWordRecognitionRef.current = null;
        setIsWakeWordListening(false);
      }
    }

    return () => {
      isStoppedPurposefully = true;
      if (wakeWordRecognitionRef.current) {
        try {
          wakeWordRecognitionRef.current.onend = null;
          wakeWordRecognitionRef.current.stop();
        } catch (e) {}
        wakeWordRecognitionRef.current = null;
        setIsWakeWordListening(false);
      }
    };
  }, [isWakeWordEnabled, isSessionActive, appState, toggleListening]);

  const handleSendAttachedFile = () => {
    if (!attachedFile) return;
    handleTextCommand("Please analyze this attached file.");
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() && !attachedFile) return;
    
    handleTextCommand(textInput.trim() || "Please analyze this attached file.");
    setTextInput("");
    setShowTextInput(false);
  };

  return (
    <div className={`h-[100dvh] w-full max-w-full text-white flex items-center justify-center relative overflow-hidden m-0 p-0 transition-all duration-[600ms] bg-[#020204] ${themeConfigs[theme].font}`}>
      
      {/* Background Holographic Atmosphere */}
      <AnimatePresence mode="wait">
        <motion.div
          key={theme}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none"
        >
          {theme === "dark" && (
            <>
              <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-violet-900/10 blur-[130px] rounded-full" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[130px] rounded-full" />
            </>
          )}
          {theme === "purple" && (
            <>
              <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-fuchsia-900/15 blur-[130px] rounded-full" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-900/15 blur-[130px] rounded-full" />
            </>
          )}
          {theme === "blue" && (
            <>
              <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-cyan-900/15 blur-[130px] rounded-full" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/15 blur-[130px] rounded-full" />
            </>
          )}
          {theme === "neon" && (
            <>
              <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-950/20 blur-[130px] rounded-full" />
              <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-teal-950/25 blur-[130px] rounded-full" />
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Floating Space Dust Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        {Array.from({ length: 25 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white filter blur-[0.5px]"
            style={{
              width: Math.random() * 3 + 1 + "px",
              height: Math.random() * 3 + 1 + "px",
              left: Math.random() * 100 + "%",
              top: Math.random() * 100 + "%",
            }}
            animate={{
              y: [-10, -80],
              x: [0, Math.sin(i) * 20],
              opacity: [0, 0.4, 0],
            }}
            transition={{
              duration: Math.random() * 8 + 6,
              repeat: Infinity,
              delay: Math.random() * 5,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {showPermissionModal && (
        <PermissionModal 
          type={permissionModalType}
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      {/* Main Glassmorphic Mobile-First Panel Mockup */}
      <div className={`relative w-full h-full sm:h-[95vh] sm:max-h-[850px] sm:max-w-[430px] rounded-none sm:rounded-[36px] sm:border border-white/5 bg-[#030307]/80 backdrop-blur-3xl flex flex-col items-center justify-between overflow-hidden select-none shadow-[0_25px_80px_rgba(0,0,0,0.8)] z-10 transition-all duration-300`}>
        
        {/* TOP SECTION */}
        <header className="w-full flex items-center justify-between px-6 pt-5 pb-3 bg-gradient-to-b from-black/20 to-transparent z-20 shrink-0">
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 flex items-center justify-center transition-all cursor-pointer text-white/70 hover:text-white"
            title="Toggle dialogue log"
          >
            <Menu size={18} />
          </button>

          <div className="flex flex-col items-center">
            <motion.h1 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`text-2xl font-bold tracking-[0.18em] bg-gradient-to-r ${themeConfigs[theme].accentColor} bg-clip-text text-transparent select-none font-sans drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]`}
              style={{ textShadow: "0 0 25px rgba(255,255,255,0.05)" }}
            >
              ABIRA
            </motion.h1>
          </div>

          <div className="flex items-center gap-2">
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 flex items-center justify-center transition-all cursor-pointer text-white/70 hover:text-white"
              title="Open AI in Fullscreen (New Tab)"
            >
              <ExternalLink size={17} />
            </a>

            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/5 flex items-center justify-center transition-all cursor-pointer ${showSettings ? themeConfigs[theme].textColor : "text-white/70 hover:text-white"}`}
              title="Settings Console"
            >
              <Settings size={18} />
            </button>
          </div>
        </header>

        {/* Dynamic Center Panel Container (Or AI Core) */}
        <div className="w-full flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden">
          
          <AnimatePresence mode="wait">
            {!isCameraOn ? (
              /* CENTER AI CORE: Glowing Futuristic AI Orb Panel */
              <motion.div 
                key="orbandplatform"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="relative w-full h-[250px] flex flex-col items-center justify-center"
              >
                {/* Concentric Glow Resonance Circles (React Fully to Volume!) */}
                <motion.div 
                  animate={{
                    scale: 1 + (liveVolume / 100) * 0.9,
                    opacity: appState === "speaking" ? [0.15, 0.45, 0.15] : 0.15
                  }}
                  transition={{ duration: 0.3 }}
                  className={`absolute w-48 h-48 rounded-full border border-dashed ${themeConfigs[theme].cardBorder} pointer-events-none filter blur-[1px]`}
                />
                <motion.div 
                  animate={{
                    scale: 1.35 + (liveVolume / 100) * 1.3,
                    opacity: appState === "speaking" ? [0.08, 0.28, 0.08] : 0.08
                  }}
                  transition={{ duration: 0.35 }}
                  className={`absolute w-44 h-44 rounded-full border border-dotted ${themeConfigs[theme].cardBorder} pointer-events-none`}
                />
                
                {/* Floating 3D Outer Ring System (Slow float idle, active speaking rotation) */}
                <motion.div
                  animate={{
                    rotate: 360,
                    y: [-3, 3, -3]
                  }}
                  transition={{
                    rotate: { duration: appState === "speaking" ? 6 : appState === "processing" ? 3 : 15, repeat: Infinity, ease: "linear" },
                    y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className={`absolute w-36 h-36 rounded-full border-t border-b border-r border-transparent ${themeConfigs[theme].cardBorder} p-1 pointer-events-none`}
                  style={{ transform: "rotateX(55deg) rotateY(15deg)" }}
                />

                <motion.div
                  animate={{
                    rotate: -360,
                    y: [3, -3, 3]
                  }}
                  transition={{
                    rotate: { duration: appState === "speaking" ? 5 : appState === "processing" ? 2.5 : 12, repeat: Infinity, ease: "linear" },
                    y: { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className={`absolute w-32 h-32 rounded-full border-l border-r border-b border-transparent ${themeConfigs[theme].cardBorder} opacity-60 pointer-events-none`}
                  style={{ transform: "rotateX(40deg) rotateY(-20deg)" }}
                />

                {/* Pedestal platform under the orb core */}
                <div className="absolute bottom-4 flex flex-col items-center justify-center pointer-events-none select-none">
                  <div className="w-28 h-[6px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent blur-[3px] rounded-full" />
                  <div className="w-20 h-[3px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent blur-[1px] rounded-full mt-[1px]" />
                </div>

                {/* Morphing Liquid/Glassmorphic AI Orb */}
                <motion.div
                  animate={{
                    borderRadius: [
                      "42% 58% 70% 30% / 45% 45% 55% 55%",
                      "65% 35% 50% 50% / 60% 40% 60% 40%",
                      "48% 52% 40% 60% / 40% 58% 62% 42%",
                      "42% 58% 70% 30% / 45% 45% 55% 55%"
                    ],
                    rotate: [0, 90, 180, 270, 360],
                    y: appState === "speaking" ? [-5, 5, -5] : [-2, 2, -2],
                    scale: appState === "speaking" ? [1, 1.05, 0.98, 1.02, 1] : 1
                  }}
                  transition={{
                    borderRadius: { duration: appState === "processing" ? 3 : 8, repeat: Infinity, ease: "easeInOut" },
                    rotate: { duration: appState === "processing" ? 4 : appState === "speaking" ? 6 : 14, repeat: Infinity, ease: "linear" },
                    y: { duration: 4.5, repeat: Infinity, ease: "easeInOut" },
                    scale: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
                  }}
                  className={`relative w-28 h-28 bg-gradient-to-tr ${themeConfigs[theme].orbGradient} flex items-center justify-center transition-all duration-300 filter overflow-visible`}
                  style={{
                    scale: 1 + (liveVolume / 100) * 0.42,
                    boxShadow: `0 0 ${Math.round(35 + (liveVolume / 100) * 60)}px ${themeConfigs[theme].orbColor}65, inset 0 3px 12px rgba(255,255,255,0.4)`
                  }}
                >
                  {/* Glowing core highlight overlay */}
                  <div className="w-4 h-4 rounded-full bg-white/70 filter blur-[1px] opacity-85 absolute top-6 left-8" />
                  
                  {/* Subtle Sparkle indicator for AI states */}
                  {appState === "processing" && (
                    <motion.div 
                      animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.4, 0.9, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Sparkles size={16} className="text-white" />
                    </motion.div>
                  )}
                </motion.div>

              </motion.div>
            ) : (
              /* CAMERA LIVE CONTAINER VIEW: Replaces Orb when camera is active */
              <motion.div 
                key="cameraviewpanel"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="relative w-full h-[250px] rounded-2xl overflow-hidden border border-white/15 bg-black/40 shadow-inner flex flex-col justify-end p-2.5 group"
              >
                {/* Live Video camera element */}
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && cameraStream) {
                      el.muted = true;
                      el.defaultMuted = true;
                      if (el.srcObject !== cameraStream) {
                        el.srcObject = cameraStream;
                      }
                      el.play().catch(e => console.warn("Video playback autoplay blocked in callback ref:", e));
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 select-none pointer-events-none rounded-2xl"
                  style={{
                    transform: `scale(${cameraZoom}) ${cameraFacingMode === "user" ? "scaleX(-1)" : ""}`,
                    transformOrigin: "center center"
                  }}
                />

                {/* High Tech HUD Glass overlay indicators */}
                <div className="absolute inset-x-2.5 top-2.5 flex items-center justify-between pointer-events-none z-10 select-none">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-black/40 text-white/80 border border-white/5 backdrop-blur-md text-[9px] uppercase tracking-widest font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span>Abira Eye Live</span>
                  </div>

                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/40 text-[9px] uppercase tracking-widest font-mono text-white/50 border border-white/5 backdrop-blur-md">
                    <span>{cameraFacingMode === "user" ? "Front" : "Back"} Cam ({cameraZoom}x)</span>
                  </div>
                </div>

                {/* Inline Camera Controller Tools */}
                <div className="w-full flex items-center justify-between bg-black/60 border border-white/5 backdrop-blur-md rounded-xl p-1.5 z-10 transition-opacity duration-300 opacity-90 sm:opacity-0 group-hover:opacity-100">
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={toggleCameraFacingMode}
                      className="p-1 px-2 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-white/80 hover:text-white transition-all text-[10px] uppercase font-mono flex items-center gap-1.5 border border-white/5 cursor-pointer"
                      title="Switch camera sensor source"
                    >
                      <SwitchCamera size={11} />
                      <span>Switch</span>
                    </button>
                    
                    <button 
                      onClick={() => handleZoom("zoom_in")}
                      disabled={cameraZoom >= 5}
                      className="p-1 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-white/80 hover:text-white disabled:opacity-40 transition-all border border-white/5 cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn size={12} />
                    </button>

                    <button 
                      onClick={() => handleZoom("zoom_out")}
                      disabled={cameraZoom <= 1}
                      className="p-1 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-white/80 hover:text-white disabled:opacity-40 transition-all border border-white/5 cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut size={12} />
                    </button>
                  </div>

                  <button 
                    onClick={stopCamera}
                    className="p-1 px-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 active:scale-95 transition-all text-[10px] uppercase font-mono border border-red-500/20 cursor-pointer"
                    title="Close Video capture stream"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* VOICE WAVE SECTION: Elegant Real-time Horizontal Waveform */}
        <div className="w-full px-6 py-2 select-none pointer-events-none shrink-0 border-t border-white/[0.02]">
          <div className="h-10 flex items-center justify-center gap-[3px]">
            {Array.from({ length: 32 }).map((_, i) => {
              // Creating a symmetrical visual distribution shape
              const baseDistWeight = 1 - Math.abs(i - 16) * 0.055;
              
              return (
                <motion.div
                  key={i}
                  animate={{
                    height: appState === "speaking"
                      ? `${Math.max(4, (liveVolume / 100) * 36 * baseDistWeight + Math.sin(Date.now() / 150 + i * 0.45) * 8 + 4)}px`
                      : appState === "listening"
                        ? `${Math.max(4, 15 * baseDistWeight + Math.sin(Date.now() / 200 + i * 0.3) * 10 + 4)}px`
                        : appState === "processing"
                          ? `${Math.max(4, 5 + Math.sin(Date.now() / 100 + i * 0.8) * 12)}px`
                          // gentle standby floating wave movement
                          : `${Math.max(4, 6 + Math.sin(Date.now() / 600 + i * 0.28) * 4)}px`
                  }}
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                  className={`w-[3px] rounded-full transition-colors duration-500 ${
                    theme === "dark" 
                      ? "bg-gradient-to-t from-violet-600 to-indigo-400" 
                      : theme === "purple" 
                        ? "bg-gradient-to-t from-fuchsia-600 to-pink-400" 
                        : theme === "blue" 
                          ? "bg-gradient-to-t from-cyan-500 to-blue-400" 
                          : "bg-gradient-to-t from-green-500 to-emerald-400"
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* QUICK ACTION BUTTONS SLOT */}
        <div className="w-full px-6 py-3 shrink-0 relative">
          <div className="grid grid-cols-4 gap-2 w-full">
            
            {/* Action 1: Start Chat message log drawer */}
            <button 
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all text-center group cursor-pointer active:scale-95`}
              title="Open text dialogue logs"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center transition-all group-hover:scale-105 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                <MessageSquare size={16} />
              </div>
              <span className="text-[9px] font-medium tracking-wide uppercase text-white/60">Chat log</span>
            </button>

            {/* Action 2: Voice talk listening triggers */}
            <button 
              onClick={toggleListening}
              className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all text-center group cursor-pointer active:scale-95 ${isSessionActive ? "ring-1 ring-violet-500/30" : ""}`}
              title="Activate voice dialog"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center transition-all group-hover:scale-105 text-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.1)]">
                <Mic size={16} />
              </div>
              <span className="text-[9px] font-medium tracking-wide uppercase text-white/60">Voice Talk</span>
            </button>

            {/* Action 3: Camera Capture toggling */}
            <button 
              onClick={toggleCamera}
              className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all text-center group cursor-pointer active:scale-95 ${isCameraOn ? "ring-1 ring-cyan-500/30" : ""}`}
              title="Toggle Live Camera feeds"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all group-hover:scale-105 ${isCameraOn ? "bg-red-500/10 border border-red-500/20 text-red-400" : "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]"}`}>
                <Camera size={16} />
              </div>
              <span className="text-[9px] font-medium tracking-wide uppercase text-white/60">Camera</span>
            </button>

            {/* Action 4: Theme visual color customization selector */}
            <button 
              onClick={() => {
                setShowThemeSelector(!showThemeSelector);
                setShowVolumePopup(false);
              }}
              className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 transition-all text-center group cursor-pointer active:scale-95 ${showThemeSelector ? "ring-1 ring-amber-500/30" : ""}`}
              title="Change UI theme"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center transition-all group-hover:scale-105 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                <Palette size={16} />
              </div>
              <span className="text-[9px] font-medium tracking-wide uppercase text-white/60">Theme</span>
            </button>

          </div>

          {/* Holographic Theme Picker Popover Overlay */}
          <AnimatePresence>
            {showThemeSelector && (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute inset-x-6 bottom-full mb-2 bg-[#090912]/95 border border-white/10 backdrop-blur-xl rounded-2xl p-3 z-30 shadow-2xl flex flex-col gap-2"
              >
                <div className="flex items-center justify-between pointer-events-none mb-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-white/50">Select accent palette</span>
                  <Palette size={10} className="text-white/40" />
                </div>

                <div className="grid grid-cols-4 gap-2">
                  <button 
                    onClick={() => { setTheme("dark"); setShowThemeSelector(false); }}
                    className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 border cursor-pointer transition-all ${theme === "dark" ? "border-violet-500 bg-violet-950/20 text-white" : "border-white/5 bg-white/[0.02] hover:bg-white/5 text-white/70"}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shadow-md" />
                    <span className="text-[9px] font-medium font-sans">Dark</span>
                  </button>

                  <button 
                    onClick={() => { setTheme("purple"); setShowThemeSelector(false); }}
                    className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 border cursor-pointer transition-all ${theme === "purple" ? "border-fuchsia-500 bg-fuchsia-950/20 text-white" : "border-white/5 bg-white/[0.02] hover:bg-white/5 text-white/70"}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-500 shadow-md" />
                    <span className="text-[9px] font-medium font-sans">Purple</span>
                  </button>

                  <button 
                    onClick={() => { setTheme("blue"); setShowThemeSelector(false); }}
                    className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 border cursor-pointer transition-all ${theme === "blue" ? "border-cyan-500 bg-cyan-950/20 text-white" : "border-white/5 bg-white/[0.02] hover:bg-white/5 text-white/70"}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 shadow-md" />
                    <span className="text-[9px] font-medium font-sans">Blue</span>
                  </button>

                  <button 
                    onClick={() => { setTheme("neon"); setShowThemeSelector(false); }}
                    className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 border cursor-pointer transition-all ${theme === "neon" ? "border-green-500 bg-green-950/20 text-white" : "border-white/5 bg-white/[0.02] hover:bg-white/5 text-white/70"}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-md" />
                    <span className="text-[9px] font-medium font-mono text-center">Neon</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* MAIN CONTROL SECTION */}
        <div className="w-full px-6 py-4 bg-gradient-to-t from-black/40 via-black/10 to-transparent shrink-0 relative z-20 select-none border-t border-white/[0.02]">
          <div className="flex items-center justify-between gap-4 w-full">
            
            {/* LEFT BUTTON: Active Sound output toggler with popup adjust */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowVolumePopup(!showVolumePopup);
                  setShowThemeSelector(false);
                }}
                className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                  isMuted 
                    ? "border-red-500/20 bg-red-950/10 text-red-400" 
                    : showVolumePopup
                      ? `border-cyan-500 bg-cyan-950/20 ${themeConfigs[theme].textColor}`
                      : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                }`}
                title="Sound Settings"
              >
                {isMuted ? <VolumeX size={16} /> : assistantVolume >= 50 ? <Volume2 size={16} /> : <Volume1 size={16} />}
              </button>

              {/* Volume sliders adjustments popover dropdown */}
              <AnimatePresence>
                {showVolumePopup && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: -5 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    className="absolute bottom-full left-0 mb-2 w-48 p-4 rounded-2xl bg-[#090912]/95 border border-white/10 backdrop-blur-xl shadow-2xl z-40"
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase font-mono tracking-wider text-white/50 mb-2.5">
                      <span>Sound system</span>
                      <span>{assistantVolume}%</span>
                    </div>

                    <input 
                      type="range"
                      min="0"
                      max="100"
                      value={assistantVolume}
                      onChange={(e) => setAssistantVolume(Number(e.target.value))}
                      className="w-full accent-cyan-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />

                    <div className="flex items-center justify-between mt-3 text-[10px] text-white/40">
                      <span>Muted</span>
                      <span>Full voice</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* CENTER CONCENTRIC CIRCLE MICROPHONE ICON BUTTON PANEL */}
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="relative w-16 h-16 flex items-center justify-center select-none mb-1">
                {/* Reactive Concentric glowing rings */}
                <motion.div 
                  animate={{
                    scale: isSessionActive ? [1, 1.25, 1] : 1,
                    opacity: isSessionActive ? [0.15, 0.5, 0.15] : 0.15
                  }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                  className="absolute inset-0 rounded-full border-2 border-fuchsia-500 filter blur-[1.5px] pointer-events-none"
                />
                
                <motion.div 
                  animate={{
                    scale: isSessionActive ? [1, 1.15, 1] : 1,
                    opacity: isSessionActive ? [0.2, 0.6, 0.2] : 0.2
                  }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: 0.2 }}
                  className="absolute inset-1 rounded-full border border-cyan-400 filter blur-[0.5px] pointer-events-none"
                />

                <button
                  onClick={toggleListening}
                  className={`relative w-12 h-12 rounded-full flex items-center justify-center border-none transition-all active:scale-95 cursor-pointer shadow-lg z-10 ${
                    isSessionActive 
                      ? "bg-gradient-to-tr from-fuchsia-600 via-purple-600 to-pink-500 text-white shadow-[0_0_20px_rgba(240,70,250,0.5)]" 
                      : "bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-white"
                  }`}
                  title={isSessionActive ? "Stop Session" : "Start Session"}
                >
                  <AnimatePresence mode="wait">
                    {appState === "processing" ? (
                      <Loader2 size={18} className="animate-spin text-cyan-400" />
                    ) : isSessionActive ? (
                      <motion.div 
                        animate={{ scale: [1, 1.15, 1] }} 
                        transition={{ duration: 0.8, repeat: Infinity }}
                      >
                        <Activity size={18} className="text-white" />
                      </motion.div>
                    ) : (
                      <Mic size={18} />
                    )}
                  </AnimatePresence>
                </button>
              </div>

              {/* Wide glowing session main control button */}
              <button
                onClick={toggleListening}
                className={`px-6 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all duration-300 shadow-[0_3px_15px_rgba(0,0,0,0.3)] active:scale-95 border cursor-pointer ${
                  isSessionActive 
                    ? "bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20 shadow-[0_0_12px_rgba(239,68,68,0.15)]" 
                    : `bg-gradient-to-r ${themeConfigs[theme].accentColor} text-white hover:opacity-95 ${themeConfigs[theme].glowText} border-transparent`
                }`}
              >
                {isSessionActive ? "Stop Session" : "Start Session"}
              </button>
            </div>

            {/* RIGHT BUTTON: MIC MUTE button indicator */}
            <div>
              <button
                onClick={() => setIsMicMuted(!isMicMuted)}
                className={`w-11 h-11 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                  isMicMuted 
                    ? "border-red-500 bg-red-950/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]" 
                    : "border-white/10 bg-white/5 text-white/70 hover:text-white"
                }`}
                title={isMicMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isMicMuted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            </div>

          </div>
        </div>

        {/* BOTTOM STATUS CARDS */}
        <footer className="w-full px-5 pb-5 pt-1.5 shrink-0 select-none z-10 border-t border-white/[0.01]">
          <div className="grid grid-cols-4 gap-2 w-full">
            
            {/* Status 1: Listening Status */}
            <div className="p-2 px-1.5 rounded-2xl bg-white/[0.02] border border-white/[0.03] flex flex-col justify-between h-14">
              <span className="text-[8px] uppercase tracking-wider text-white/40 block">Status</span>
              <div className="flex items-center gap-1 overflow-hidden mt-1 pb-0.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  appState === "listening" 
                    ? "bg-green-400 animate-pulse" 
                    : appState === "speaking" 
                      ? "bg-pink-400 animate-pulse" 
                      : appState === "processing" 
                        ? "bg-cyan-400 animate-spin" 
                        : "bg-white/20"
                }`} />
                <span className="text-[9px] font-bold font-mono tracking-tighter truncate capitalize text-white/80">
                  {appState === "idle" ? "Standby" : appState}
                </span>
              </div>
            </div>

            {/* Status 2: Response Speed */}
            <div className="p-2 px-1.5 rounded-2xl bg-white/[0.02] border border-white/[0.03] flex flex-col justify-between h-14">
              <span className="text-[8px] uppercase tracking-wider text-white/40 block">Latency</span>
              <div className="flex flex-col justify-end mt-1">
                <span className="text-[10px] font-bold font-mono text-cyan-400 leading-none">0.38s</span>
                <svg className="w-full h-3 text-cyan-500/40 mt-1 pointer-events-none animate-pulse" viewBox="0 0 100 20" preserveAspectRatio="none">
                  <path 
                    d="M 0 15 Q 15 10, 30 14 T 60 8 T 80 16 T 100 12" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="1.5" 
                  />
                </svg>
              </div>
            </div>

            {/* Status 3: Memory Usage */}
            <div className="p-2 px-1.5 rounded-2xl bg-white/[0.02] border border-white/[0.03] flex flex-col justify-between h-14">
              <span className="text-[8px] uppercase tracking-wider text-white/40 block">Memory</span>
              <div className="flex items-center gap-1 justify-between mt-1">
                <span className="text-[10px] font-bold font-mono text-indigo-400 leading-none truncate">2.4g</span>
                <svg className="w-5 h-5 shrink-0 text-indigo-500/20 transform -rotate-90 pointer-events-none" viewBox="0 0 36 36">
                  <path className="text-white/5" stroke="currentColor" strokeWidth="3" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="text-indigo-400" strokeDasharray="65, 100" stroke="currentColor" strokeWidth="3" strokeLinecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
              </div>
            </div>

            {/* Status 4: Connection Uptime */}
            <div className="p-2 px-1.5 rounded-2xl bg-white/[0.02] border border-white/[0.03] flex flex-col justify-between h-14" title="99.9% uptime signal strength">
              <span className="text-[8px] uppercase tracking-wider text-white/40 block">Uptime</span>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[10px] font-bold font-mono text-emerald-400 leading-none">99.9%</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
              </div>
            </div>

          </div>
        </footer>

        {/* HOLOGRAPHIC CHAT SLIDE-OVER TEXT MESSAGING INTERFACE */}
        <AnimatePresence>
          {isChatOpen && (
            <>
              {/* Blur backdrop overlay */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsChatOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md z-30 pointer-events-auto cursor-pointer"
              />

              {/* Chat panel sheet */}
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className={`absolute inset-x-0 bottom-0 top-16 rounded-t-[32px] border-t border-white/10 z-40 flex flex-col pointer-events-auto backdrop-blur-3xl overflow-hidden shadow-2xl ${themeConfigs[theme].chatBoxBg}`}
              >
                {/* Chat Panel Title Bar Header */}
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-black/25 select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-white/50 font-mono">Conversations</span>
                    <span className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] text-[#818cf8] font-mono border border-white/5">Active session</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {messages.length > 0 && (
                      <button 
                        onClick={() => {
                          if (confirm("Are you sure you want to clear conversation history, Abdullah?")) {
                            setMessages([]);
                            resetAbiraSession();
                          }
                        }}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 active:scale-95 transition-all cursor-pointer border border-red-500/10"
                        title="Reset memories"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}

                    <button 
                      onClick={() => setIsChatOpen(false)}
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-white/70 hover:text-white transition-all cursor-pointer border border-white/5"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>

                {/* Messages Lists Scroll Area */}
                <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 scrollbar-hidden">
                  <WeatherCard theme={theme} />

                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-white/30 font-sans select-none">
                      <MessageSquare size={36} className="mb-3 opacity-20" />
                      <p className="text-sm font-medium">No messages yet</p>
                      <p className="text-xs max-w-[200px] mt-1 text-white/20">Send a text message or talk with Abira.</p>
                    </div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {Array.from(new Map<string, ChatMessage>(messages.filter((m): m is ChatMessage => !!(m && m.id)).map((m) => [m.id, m])).values()).map((msg: ChatMessage) => (
                        <motion.div 
                          key={msg.id}
                          initial={{ opacity: 0, y: 15, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, x: msg.sender === "user" ? 15 : -15, scale: 0.95, transition: { duration: 0.15 } }}
                          transition={{ type: "spring", stiffness: 350, damping: 25 }}
                          className={`flex flex-col max-w-[85%] ${msg.sender === "user" ? "self-end items-end" : "self-start items-start"}`}
                        >
                          <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm flex flex-col gap-1.5 select-text ${
                            msg.sender === "user" 
                              ? themeConfigs[theme].bubbleUser 
                              : themeConfigs[theme].bubbleAI
                          }`}>
                            <div className="whitespace-pre-wrap select-text">
                              {msg.sender === "abira" && !completedTypingIds[msg.id] ? (
                                <TypewriterMessage 
                                  text={msg.text} 
                                  theme={theme}
                                  onComplete={() => {
                                    setCompletedTypingIds(prev => ({
                                      ...prev,
                                      [msg.id]: true
                                    }));
                                  }}
                                />
                              ) : (
                                formatMessageText(msg.text, theme)
                              )}
                            </div>

                            <div className={`flex items-center gap-2 self-end mt-1 ${msg.sender === "user" ? "text-white/50" : "text-white/40"}`}>
                              <CopyButton text={msg.text} theme={theme} />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}

                  <AnimatePresence>
                    {appState === "processing" && (
                      <motion.div 
                        initial={{ opacity: 0, y: 12, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.15 } }}
                        className="flex flex-col max-w-[80%] self-start items-start"
                      >
                        <div className={`rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-2 text-xs italic ${themeConfigs[theme].bubbleAI}`}>
                          <Loader2 size={12} className="animate-spin text-cyan-400" />
                          <span>Abira is processing response...</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div ref={chatsEndRef} />
                </div>

                {/* Attachment Document indicators */}
                {attachedFile && (
                  <div className="px-5 py-2 border-t border-white/5 bg-white/[0.01] flex items-center justify-between select-none">
                    <div className="flex items-center gap-2 text-xs text-white/80">
                      {attachedFile.mimeType.startsWith("image/") ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0">
                          <img 
                            src={`data:${attachedFile.mimeType};base64,${attachedFile.data}`} 
                            alt="Attachment content preview" 
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <FileText size={16} className="text-violet-400 shrink-0" />
                      )}
                      <div className="flex flex-col truncate max-w-[200px]">
                        <span className="truncate text-white font-medium">{attachedFile.name}</span>
                        <span className="text-[9px] text-white/40 uppercase font-mono">{attachedFile.mimeType}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => setAttachedFile(null)}
                      className="p-1 px-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all cursor-pointer border border-white/5"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}

                {/* Typing Submit control dock */}
                <div className="px-5 py-4 border-t border-white/5 bg-black/20 shrink-0">
                  <form onSubmit={handleTextSubmit} className="flex items-center gap-2 w-full">
                    
                    {/* Attachment trigger file inputs hidden */}
                    <input 
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-white/60 hover:text-white transition-all cursor-pointer border border-white/5 shrink-0"
                      title="Attach picture or document"
                    >
                      <Paperclip size={14} />
                    </button>

                    <div className={`flex-1 flex items-center rounded-xl px-3 border border-white/10 bg-black/30`}>
                      <input 
                        type="text"
                        value={chatInputText}
                        onChange={(e) => setChatInputText(e.target.value)}
                        placeholder="Type text message to Abira..."
                        className={`flex-1 bg-transparent border-none outline-none py-2 focus:ring-0 ${themeConfigs[theme].text} placeholder:text-white/30 text-xs`}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!chatInputText.trim() && !attachedFile}
                      className={`p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${themeConfigs[theme].sendButton}`}
                      title="Send message"
                    >
                      <Send size={13} />
                    </button>
                  </form>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* FLOATING SETTINGS CONSOLE PANEL OVERLAY */}
        <AnimatePresence>
          {showSettings && (
            <>
              {/* Settings blur backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSettings(false)}
                className="absolute inset-0 bg-black/70 backdrop-blur-md z-30 pointer-events-auto cursor-pointer"
              />

              {/* Settings content pane */}
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 350 }}
                className="absolute inset-x-0 bottom-0 max-h-[70vh] rounded-t-[32px] border-t border-white/10 z-40 bg-[#090912]/95 backdrop-blur-3xl p-6 flex flex-col justify-between pointer-events-auto shadow-2xl"
              >
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-5 select-none">
                    <span className="text-xs uppercase tracking-wider text-white/50 font-mono flex items-center gap-1.5">
                      <SlidersHorizontal size={12} />
                      <span>Console configs</span>
                    </span>

                    <button 
                      onClick={() => setShowSettings(false)}
                      className="p-1 px-2 text-[10px] uppercase font-mono tracking-wider rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/5 cursor-pointer"
                    >
                      Close
                    </button>
                  </div>

                  <div className="flex flex-col gap-4 overflow-y-auto max-h-[45vh]">
                    
                    {/* Settings 1: Wake word trigger */}
                    <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-white/80">"Abira" Voice Trigger</span>
                        <span className="text-[10px] text-white/40">Starts listening on wake word shout</span>
                      </div>

                      <button
                        onClick={() => setIsWakeWordEnabled(!isWakeWordEnabled)}
                        className={`w-12 h-6 rounded-full transition-all duration-300 relative border cursor-pointer ${isWakeWordEnabled ? "bg-cyan-500 border-cyan-400" : "bg-white/5 border-white/10"}`}
                      >
                        <div className={`w-[18px] h-[18px] rounded-full bg-white absolute top-[2px] transition-all shadow-md ${isWakeWordEnabled ? "left-[26px]" : "left-[2px]"}`} />
                      </button>
                    </div>

                    {/* Settings 1.5: Open in New Tab block */}
                    <a
                      href={window.location.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.03] hover:bg-white/[0.06] hover:border-white/10 active:scale-[0.98] transition-all cursor-pointer"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-white/80">Open in New Tab</span>
                        <span className="text-[10px] text-white/40">Naye tab me Abira open kren</span>
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
                        <ExternalLink size={14} />
                      </div>
                    </a>

                    {/* Settings 1.6: Supabase Memory Synchronization Database status */}
                    <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                      <div className="flex items-center justify-between mb-2 select-none">
                        <span className="text-xs font-bold text-white/85 flex items-center gap-1.5">
                          <Cpu size={13} className="text-cyan-400" />
                          <span>Abira's Memory Sync (Supabase)</span>
                        </span>
                        {isSupabaseConnected ? (
                          <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Connected
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                            Local Only
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] text-white/50 leading-relaxed mb-3 select-none">
                        {isSupabaseConnected 
                          ? "Mashallah, Abira Supabase database ke sath connected hai! Ab aapki baten hamesha yaad rahengi."
                          : "Abira abhi local storage use kar rahi hai. Supabase database connect karne ke liye niche asaan tariqa dekhein!"
                        }
                      </div>

                      {/* Expandable Setup Instructions Accordion */}
                      <details className="group">
                        <summary className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors font-mono cursor-pointer select-none list-none flex items-center gap-1">
                          <span className="group-open:rotate-90 transition-transform">▸</span>
                          {isSupabaseConnected ? "See Database SQL Schema" : "Asaan Supabase Setup Guide (Next Steps)"}
                        </summary>
                        
                        <div className="mt-3 text-[10px] text-white/60 space-y-3 pt-3 border-t border-white/5 select-text font-sans">
                          <div>
                            <p className="font-bold text-cyan-400 mb-1">Step 1: AI Studio Secrets me API Keys add karein</p>
                            <p className="mb-1 leading-normal">AI Studio ke <b>Settings menu</b> (top-right core gear icon) me jayein, aur wahan <b>Secrets (Environment Variables)</b> me niche diye gaye dono variables add karein:</p>
                            <div className="p-2.5 rounded bg-black/40 font-mono text-[9px] text-slate-300 space-y-1 my-1">
                              <div><b>Name:</b> <code className="text-emerald-400">VITE_SUPABASE_URL</code><br/><b>Value:</b> <span className="text-white/40">(Apne Supabase project ka URL enter karein)</span></div>
                              <div className="pt-1.5"><b>Name:</b> <code className="text-emerald-400">VITE_SUPABASE_ANON_KEY</code><br/><b>Value:</b> <span className="text-white/40">(Apne Supabase project ka Anon/Public API key enter karein)</span></div>
                            </div>
                          </div>

                          <div>
                            <p className="font-bold text-cyan-400 mb-1">Step 2: Supabase Dashboard par SQL run karein</p>
                            <p className="mb-2 leading-normal">Apne Supabase Dashboard par jayein, left navigation bar par <b>SQL Editor</b> open karein, <b>New Query</b> banayein, aur niche diye gaye SQL script ko paste karke run/execute kar dein:</p>
                            <div className="relative">
                              <pre className="p-2.5 rounded bg-black/60 font-mono text-[8.5px] text-cyan-300 overflow-x-auto border border-white/5 max-h-[160px] leading-tight">
{`create table abira_messages (
  id text primary key,
  sender text not null check (sender in ('user', 'abira')),
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table abira_messages enable row level security;

-- Create policy to allow access to anyone using client anon key
create policy "Allow public access" 
on abira_messages 
for all 
using (true) 
with check (true);`}
                              </pre>
                            </div>
                          </div>
                          
                          <div className="pt-1 text-[9px] text-white/40 border-t border-white/5 italic leading-normal">
                            Yeh dono steps complete karte hi Abira automatically connected status pakar legi aur aapka purana local chat automatic backup ho jayega!
                          </div>
                        </div>
                      </details>
                    </div>

                    {/* Settings 2: System info diagnostic */}
                    <div className="p-3.5 rounded-2xl bg-white/[0.02] border border-white/[0.03]">
                      <span className="text-xs font-bold text-white/80 block mb-3">Diagnostic parameters</span>
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-white/40">
                        <div>Host: <span className="text-white/70">Local server</span></div>
                        <div>Engine: <span className="text-white/70">Gemini-3.5-flash</span></div>
                        <div>User Email: <span className="text-white/70 truncate block">abdullahshazada599@gmail.com</span></div>
                        <div>Timezone: <span className="text-white/70">UTC -7</span></div>
                      </div>
                    </div>

                    {/* Settings 3: Clear conversational memories */}
                    <button 
                      onClick={() => {
                        if (confirm("Reset conversation logs and Abira prompt session?")) {
                          setMessages([]);
                          resetAbiraSession();
                          setShowSettings(false);
                          alert("Session Reset Complete!");
                        }
                      }}
                      className="w-full py-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-medium text-xs border border-red-500/10 active:scale-95 transition-all text-center cursor-pointer"
                    >
                      Clear Memory Logs
                    </button>

                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 mt-4 text-center text-[10px] text-white/30 font-mono">
                  ABIRA System v2.5 • Developed for Abdullah
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* PREMIUM THEME CROSS-FADE OVERLAY LAYER */}
        <AnimatePresence>
          {prevTheme && (
            <motion.div
              key={prevTheme}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              onAnimationComplete={() => setPrevTheme(null)}
              className="absolute inset-0 z-[100] pointer-events-none rounded-[inherit] overflow-hidden bg-[#030307]/95 backdrop-blur-3xl flex flex-col items-center justify-between"
            >
              {/* Replica Header */}
              <header className="w-full flex items-center justify-between px-6 pt-5 pb-3 bg-gradient-to-b from-black/20 to-transparent shrink-0">
                <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/50">
                  <Menu size={18} />
                </div>
                <div className="flex flex-col items-center">
                  <h1 className={`text-2xl font-bold tracking-[0.18em] bg-gradient-to-r ${themeConfigs[prevTheme].accentColor} bg-clip-text text-transparent select-none font-sans drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]`}>
                    ABIRA
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/50">
                    <ExternalLink size={17} />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-white/50">
                    <Settings size={18} />
                  </div>
                </div>
              </header>

              {/* Replica Center Panel */}
              <div className="w-full flex-1 flex flex-col items-center justify-center px-6 relative overflow-hidden">
                <div className="relative w-full h-[250px] flex flex-col items-center justify-center">
                  {/* Replica Orbiting Circles */}
                  <div className={`absolute w-48 h-48 rounded-full border border-dashed ${themeConfigs[prevTheme].cardBorder} pointer-events-none filter blur-[1px]`} />
                  <div className={`absolute w-44 h-44 rounded-full border border-dotted ${themeConfigs[prevTheme].cardBorder} pointer-events-none`} />
                  <div className={`absolute w-36 h-36 rounded-full border-t border-b border-r border-transparent ${themeConfigs[prevTheme].cardBorder} p-1 pointer-events-none`}
                       style={{ transform: "rotateX(55deg) rotateY(15deg)" }} />
                  <div className={`absolute w-32 h-32 rounded-full border-l border-r border-b border-transparent ${themeConfigs[prevTheme].cardBorder} opacity-60 pointer-events-none`}
                       style={{ transform: "rotateX(40deg) rotateY(-20deg)" }} />

                  {/* Replica Core AI Orb */}
                  <div 
                    className={`relative w-28 h-28 bg-gradient-to-tr ${themeConfigs[prevTheme].orbGradient} flex items-center justify-center filter`}
                    style={{
                      borderRadius: "42% 58% 70% 30% / 45% 45% 55% 55%",
                      boxShadow: `0 0 35px ${themeConfigs[prevTheme].orbColor}65, inset 0 3px 12px rgba(255,255,255,0.4)`
                    }}
                  >
                    {/* Glowing core highlight overlay */}
                    <div className="w-4 h-4 rounded-full bg-white/70 filter blur-[1px] opacity-85 absolute top-6 left-8" />
                  </div>
                </div>
              </div>

              {/* Replica Footer controls spacer to preserve same dimensions */}
              <div className="h-[120px] w-full" />
            </motion.div>
          )}
        </AnimatePresence>

      </div>

    </div>
  );
}
