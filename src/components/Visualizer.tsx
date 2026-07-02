import { motion, AnimatePresence } from "motion/react";
import { useState, useEffect, useMemo } from "react";

type VisualizerState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "abira";
  text: string;
}

interface VisualizerProps {
  state: VisualizerState;
  messages: ChatMessage[];
  themeName?: "dark" | "cyberpunk" | "classic";
}

export default function Visualizer({ state, messages, themeName = "dark" }: VisualizerProps) {
  const [volume, setVolume] = useState(0);

  // Subscribe to voice response dynamic volume levels
  useEffect(() => {
    const handleVolume = (e: any) => {
      setVolume(e.detail?.volume || 0);
    };
    window.addEventListener("abira-volume", handleVolume);
    return () => {
      window.removeEventListener("abira-volume", handleVolume);
      setVolume(0);
    };
  }, []);

  // Real-time sentiment analysis engine to map speech to rich human emotions
  const currentEmotion = useMemo(() => {
    const lastAbiraMessage = [...messages]
      .reverse()
      .find((m) => m.sender === "abira")?.text || "";
    
    const lowercase = lastAbiraMessage.toLowerCase();
    
    // Expressive Urdu & English Keywords for Empathy, sadness, and sorrow
    const sadKeywords = [
      "sorry", "afsos", "dukh", "sad", "ron", "parayshan", "unfortunate", "bura", "afraid", 
      "hurt", "gam", "rote", "dard", "mushkil", "roya", "grief", "pain", "crying", "tears", 
      "lonely", "mayoos", "pareshan", "pukaar", "muafi", "udaas", "mayus", "rona", "khafa"
    ];
    
    // High Energy, Joy and Excitement keywords
    const excitedKeywords = [
      "wow", "great", "amazing", "zabarast", "khushi", "excited", "mubarak", "hurray", 
      "yippee", "awesome", "perfect", "behtereen", "shandar", "pyara", "lovely", 
      "wonderful", "hurrah", "superb", "brilliant", "enjoy", "jeeto", "mubarakbaad", "mza"
    ];
    
    // Curiosity, thoughtful analysis, ponder
    const thoughtfulKeywords = [
      "thinking", "wait", "let me see", "soch", "shayed", "maybe", "hm", "let me check", 
      "wonder", "analyse", "ponder", "curious", "sawal", "khayal", "dilchasp", "interesting",
      "fiker", "fiteh", "sochte hain"
    ];
    
    // Friendliness, cozy greeting terms
    const warmKeywords = [
      "hello", "hi", "hey", "assalam", "welcome", "shukriya", "thank you", "pyar", "love", 
      "care", "sweet", "friend", "dost", "khushamdeed", "acha"
    ];

    if (sadKeywords.some(keyword => lowercase.includes(keyword))) {
      return "sad";
    }
    if (excitedKeywords.some(keyword => lowercase.includes(keyword))) {
      return "excited";
    }
    if (thoughtfulKeywords.some(keyword => lowercase.includes(keyword))) {
      return "thoughtful";
    }
    if (warmKeywords.some(keyword => lowercase.includes(keyword))) {
      return "happy";
    }
    return "normal";
  }, [messages]);

  // Rotational speeds of the ambient cyber HUD background rings
  const getRingAnimation = (index: number, reverse: boolean = false) => {
    const baseSpeed = state === "listening" ? 4 : state === "processing" ? 2 : state === "speaking" ? 3 : 16;
    return {
      rotate: reverse ? [-360, 0] : [0, 360],
      transition: { duration: baseSpeed + index * 4, repeat: Infinity, ease: "linear" }
    };
  };

  // Outer ambient breathing/pulsing
  const getPulseAnimation = () => {
    if (state === "speaking") {
      return {
        scale: [1, 1.03, 0.98, 1.01, 1],
        opacity: [0.85, 1, 0.85],
        transition: { duration: 0.65, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "listening") {
      return {
        scale: [1, 1.02, 1],
        opacity: [0.75, 1, 0.75],
        transition: { duration: 1.25, repeat: Infinity, ease: "easeInOut" }
      };
    }
    if (state === "processing") {
      return {
        scale: [0.99, 1.01, 0.99],
        opacity: [0.6, 0.9, 0.6],
        transition: { duration: 0.8, repeat: Infinity, ease: "linear" }
      };
    }
    return {
      scale: [1, 1.004, 1],
      opacity: [0.45, 0.6, 0.45],
      transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
    };
  };

  // Theme matching current state or detected user sentiment
  const getTheme = () => {
    // 1. Cyberpunk Theme Palettes
    if (themeName === "cyberpunk") {
      if (currentEmotion === "sad") {
        return {
          color: "rgba(6, 182, 212, 1)",
          gradient: "from-cyan-600 via-blue-600 to-fuchsia-500",
          glow: "shadow-cyan-500/50",
          border: "border-cyan-400/40",
          textGlow: "text-cyan-400",
          label: "CYBER - EMPATHETIC SAD"
        };
      }
      if (currentEmotion === "excited") {
        return {
          color: "rgba(240, 70, 250, 1)",
          gradient: "from-fuchsia-500 via-pink-500 to-green-400",
          glow: "shadow-fuchsia-500/60",
          border: "border-fuchsia-400/40",
          textGlow: "text-fuchsia-400",
          label: "CYBER - EXCITED MODE"
        };
      }
      if (currentEmotion === "thoughtful") {
        return {
          color: "rgba(34, 211, 238, 1)",
          gradient: "from-cyan-400 via-blue-500 to-fuchsia-500",
          glow: "shadow-cyan-500/50",
          border: "border-cyan-400/40",
          textGlow: "text-cyan-400",
          label: "CYBER - PONDERING"
        };
      }

      switch (state) {
        case "listening": return {
          color: "rgba(240, 70, 250, 1)",
          gradient: "from-fuchsia-600 via-pink-500 to-cyan-400",
          glow: "shadow-fuchsia-500/60",
          border: "border-fuchsia-400/50",
          textGlow: "text-fuchsia-400",
          label: "CYBER - LISTENING..."
        };
        case "processing": return {
          color: "rgba(34, 211, 238, 1)",
          gradient: "from-cyan-400 via-teal-400 to-fuchsia-500",
          glow: "shadow-cyan-400/60",
          border: "border-cyan-400/50",
          textGlow: "text-cyan-400",
          label: "CYBER - RETRIEVING..."
        };
        case "speaking": return {
          color: "rgba(57, 255, 20, 1)",
          gradient: "from-green-400 via-emerald-500 to-fuchsia-500",
          glow: "shadow-green-500/60",
          border: "border-green-400/50",
          textGlow: "text-green-400",
          label: "CYBER - RESPONDING"
        };
        default: return {
          color: "rgba(34, 211, 238, 0.8)",
          gradient: "from-cyan-500 via-fuchsia-500 to-emerald-400",
          glow: "shadow-cyan-500/30",
          border: "border-cyan-500/40",
          textGlow: "text-cyan-400",
          label: "CYBER - STANDBY"
        };
      }
    }

    // 2. Classic High-Contrast Theme Palettes
    if (themeName === "classic") {
      if (currentEmotion === "sad") {
        return {
          color: "rgba(217, 119, 6, 1)",
          gradient: "from-amber-700 via-neutral-800 to-amber-500",
          glow: "shadow-amber-500/50",
          border: "border-amber-400/40",
          textGlow: "text-amber-400",
          label: "CLASSIC - REFLECTION"
        };
      }
      if (currentEmotion === "excited") {
        return {
          color: "rgba(245, 158, 11, 1)",
          gradient: "from-amber-500 via-yellow-500 to-white",
          glow: "shadow-amber-500/60",
          border: "border-amber-400/40",
          textGlow: "text-amber-400",
          label: "CLASSIC - EXCITED"
        };
      }
      if (currentEmotion === "thoughtful") {
        return {
          color: "rgba(180, 83, 9, 1)",
          gradient: "from-amber-800 via-amber-600 to-amber-400",
          glow: "shadow-amber-500/50",
          border: "border-amber-400/40",
          textGlow: "text-amber-400",
          label: "CLASSIC - THINKING"
        };
      }

      switch (state) {
        case "listening": return {
          color: "rgba(245, 158, 11, 1)",
          gradient: "from-amber-600 via-orange-500 to-amber-400",
          glow: "shadow-amber-500/60",
          border: "border-amber-400/50",
          textGlow: "text-amber-400",
          label: "CLASSIC - INPUT RECORD"
        };
        case "processing": return {
          color: "rgba(217, 119, 6, 1)",
          gradient: "from-amber-500 via-orange-600 to-yellow-500",
          glow: "shadow-amber-400/60",
          border: "border-amber-500/40",
          textGlow: "text-amber-500",
          label: "CLASSIC - DIALECTICS"
        };
        case "speaking": return {
          color: "rgba(251, 191, 36, 1)",
          gradient: "from-yellow-400 via-amber-400 to-amber-200",
          glow: "shadow-yellow-500/60",
          border: "border-yellow-400/50",
          textGlow: "text-yellow-400",
          label: "CLASSIC - VOCAL RESPONSE"
        };
        default: return {
          color: "rgba(245, 158, 11, 0.8)",
          gradient: "from-amber-600 via-neutral-700 to-amber-400",
          glow: "shadow-amber-500/30",
          border: "border-amber-500/30",
          textGlow: "text-amber-400",
          label: "CLASSIC - SECURE COGNITION"
        };
      }
    }

    // 3. Current Dark Mode Theme Palettes (Default)
    if (currentEmotion === "sad") {
      return { 
        color: "rgba(59, 130, 246, 1)", 
        gradient: "from-blue-600 via-indigo-600 to-cyan-500",
        glow: "shadow-blue-500/50", 
        border: "border-blue-400/40",
        textGlow: "text-blue-400",
        label: "EMPATHETIC - SADNESS"
      };
    }
    if (currentEmotion === "excited") {
      return { 
        color: "rgba(244, 63, 94, 1)", 
        gradient: "from-rose-500 via-pink-500 to-yellow-400",
        glow: "shadow-rose-500/60", 
        border: "border-rose-400/40",
        textGlow: "text-rose-400",
        label: "EMPATHETIC - EXCITED"
      };
    }
    if (currentEmotion === "thoughtful") {
      return { 
        color: "rgba(245, 158, 11, 1)", 
        gradient: "from-amber-500 via-orange-500 to-yellow-400",
        glow: "shadow-amber-500/50", 
        border: "border-amber-400/40",
        textGlow: "text-amber-400",
        label: "EMPATHETIC - REFLECTIVE"
      };
    }

    switch (state) {
      case "listening": return { 
        color: "rgba(139, 92, 246, 1)", 
        gradient: "from-violet-600 via-purple-600 to-fuchsia-500",
        glow: "shadow-violet-500/60", 
        border: "border-violet-400/40",
        textGlow: "text-violet-400",
        label: "LISTENING..." 
      };
      case "processing": return { 
        color: "rgba(56, 189, 248, 1)", 
        gradient: "from-sky-500 via-cyan-500 to-indigo-400",
        glow: "shadow-sky-400/60", 
        border: "border-sky-400/40",
        textGlow: "text-sky-400",
        label: "THINKING..." 
      };
      case "speaking": return { 
        color: "rgba(236, 72, 153, 1)", 
        gradient: "from-pink-500 via-rose-500 to-fuchsia-600",
        glow: "shadow-pink-500/60", 
        border: "border-pink-400/40",
        textGlow: "text-pink-400",
        label: "ABIRA SPEAKING" 
      };
      default: return { 
        color: "rgba(6, 182, 212, 0.8)", 
        gradient: "from-cyan-500 via-teal-500 to-emerald-400",
        glow: "shadow-cyan-500/30", 
        border: "border-cyan-500/30",
        textGlow: "text-cyan-400",
        label: "SECURE DIALOGUE STANDBY" 
      };
    }
  };

  const theme = getTheme();

  // Floating background ambient dust
  const particles = useMemo(() => Array.from({ length: 18 }), []);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none select-none z-0">
      
      {/* Floating Ambient Energy Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full filter blur-[1px]"
            style={{
              width: Math.random() * 5 + 2 + "px",
              height: Math.random() * 5 + 2 + "px",
              left: Math.random() * 100 + "%",
              top: Math.random() * 100 + "%",
              backgroundColor: theme.color,
            }}
            animate={{
              y: [-20, -120],
              x: [0, Math.sin(i) * 35],
              opacity: [0, 0.55, 0],
              scale: [0.8, 1.3, 0.8],
            }}
            transition={{
              duration: Math.random() * 6 + 5,
              repeat: Infinity,
              delay: Math.random() * 4,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Large Backdrop Atmospheric Pulse Glow */}
      <motion.div
        animate={getPulseAnimation()}
        className="absolute w-[80vw] h-[80vw] max-w-[800px] rounded-full transition-all duration-300 pointer-events-none filter blur-[130px]"
        style={{ 
          backgroundColor: theme.color, 
          boxShadow: `0 0 ${Math.round(150 + (volume / 100) * 80)}px ${theme.color}`,
          opacity: 0.12 + (volume / 100) * 0.3,
          scale: 1 + (volume / 100) * 0.25
        }}
      />

      {/* Cyber HUD Holographic Rings */}
      <motion.div
        animate={getRingAnimation(4, false)}
        className={`absolute w-[95vw] h-[95vw] max-w-[850px] max-h-[850px] rounded-full border-[1.2px] border-dashed ${theme.border} transition-all duration-300`}
        style={{
          opacity: 0.08 + (volume / 100) * 0.16,
          scale: 1 + (volume / 100) * 0.06
        }}
      />

      <motion.div
        animate={getRingAnimation(2, true)}
        className={`absolute w-[75vw] h-[75vw] max-w-[650px] max-h-[650px] rounded-full border-[1.5px] ${theme.border} border-t-transparent border-b-transparent transition-all duration-300`}
        style={{
          opacity: 0.14 + (volume / 100) * 0.22,
          scale: 1 + (volume / 100) * 0.10
        }}
      />

      {/* Elegant Glassmorphic Cyber Pod Frame (Reverting to the original beautiful pod card!) */}
      <motion.div
        animate={getPulseAnimation()}
        className={`relative w-[92vw] sm:w-[420px] h-[76vh] rounded-3xl backdrop-blur-xl flex flex-col items-center justify-between p-8 overflow-hidden transition-all duration-700 select-none ${
          themeName === "cyberpunk"
            ? "border-2 border-fuchsia-500/40 bg-[#020204]/90"
            : themeName === "classic"
            ? "border border-amber-500/30 bg-[#0f0e13]/90"
            : "border border-white/10 bg-neutral-950/45"
        }`}
        style={{ 
          boxShadow: themeName === "cyberpunk"
            ? `0 0 55px rgba(240,70,250,0.12), inset 0 1px 2px rgba(240,70,250,0.2)`
            : themeName === "classic"
            ? `0 0 55px rgba(245,158,11,0.08), inset 0 1px 2px rgba(245,158,11,0.1)`
            : `0 0 55px ${theme.color}15, inset 0 1px 1px rgba(255,255,255,0.1)`,
        }}
      >
        {/* Balanced spacing spacer instead of tech-larping text */}
        <div className="h-4 w-full" />

        {/* Center: Abstract Liquid Quantum Mood Orb & Sound Waves */}
        <div className="relative w-full flex-1 flex flex-col items-center justify-center">
          
          {/* Responsive Sound Resonance Rings */}
          <motion.div 
            animate={{ 
              scale: 1.1 + (volume / 100) * 0.6,
              opacity: state === "speaking" ? [0.15, 0.4, 0.15] : 0.15 
            }}
            transition={{ duration: 0.4 }}
            className={`absolute w-56 h-56 rounded-full border-2 border-dotted ${theme.border}`}
          />
          <motion.div 
            animate={{ 
              scale: 1.35 + (volume / 100) * 0.9,
              opacity: state === "speaking" ? [0.08, 0.28, 0.08] : 0.08 
            }}
            transition={{ duration: 0.4 }}
            className={`absolute w-56 h-56 rounded-full border ${theme.border} opacity-50`}
          />
          <motion.div 
            animate={{ 
              scale: 1.7 + (volume / 100) * 1.3,
              opacity: state === "speaking" ? [0.03, 0.15, 0.03] : 0.03 
            }}
            transition={{ duration: 0.4 }}
            className={`absolute w-56 h-56 rounded-full border border-t-transparent border-b-transparent ${theme.border}`}
          />

          {/* Morphing Liquid Quantum Core Orb */}
          <motion.div
            animate={{
              borderRadius: [
                "42% 58% 70% 30% / 45% 45% 55% 55%",
                "70% 30% 52% 48% / 60% 40% 60% 40%",
                "50% 50% 40% 60% / 40% 60% 60% 40%",
                "42% 58% 70% 30% / 45% 45% 55% 55%"
              ],
              rotate: [0, 120, 240, 360],
              y: state === "speaking" ? [-4, 4, -4] : [-2, 2, -2]
            }}
            transition={{
              duration: state === "processing" ? 3.5 : 7,
              repeat: Infinity,
              ease: "linear"
            }}
            className={`relative w-40 h-40 bg-gradient-to-tr ${theme.gradient} flex items-center justify-center transition-shadow duration-300 filter`}
            style={{
              scale: 1 + (volume / 100) * 0.42,
              boxShadow: `0 0 ${Math.round(40 + (volume / 100) * 60)}px ${theme.color}80, inset 0 4px 15px rgba(255,255,255,0.4)`
            }}
          >
            {/* Core inner highlight dot */}
            <div className="w-6 h-6 rounded-full bg-white/70 filter blur-[2px] opacity-80" />
          </motion.div>

          {/* Core Ambient Back-ring */}
          <div 
            className="absolute w-44 h-44 rounded-full border-2 border-white/10 filter blur-[1px] pointer-events-none scale-100"
          />

        </div>

        {/* Bottom Panel (Mood/Emotion Display & Visual Wave Indicators) */}
        <div className="w-full flex flex-col items-center gap-4 select-none">
          
          {/* Equalizer Audio Equalization Bar (Reacts fully dynamically in real-time!) */}
          <div className="h-4 flex items-end gap-[3px] select-none">
            {Array.from({ length: 9 }).map((_, i) => {
              // Standard height formula that creates a symmetrical audio visualization wave shape
              const baseHeightFactor = 1 - Math.abs(i - 4) * 0.18;
              const dynamicGain = state === "speaking" ? volume / 100 : state === "listening" ? 0.15 : 0;
              return (
                <motion.div
                  key={i}
                  animate={{
                    height: state === "speaking"
                      ? `${Math.max(3, dynamicGain * 16 * baseHeightFactor + Math.random() * 4)}px`
                      : state === "listening"
                      ? `${Math.max(3, 8 * baseHeightFactor + Math.random() * 3)}px`
                      : state === "processing"
                      ? `${Math.max(3, 3 + (i % 2 === 0 ? 5 : 1) * Math.sin(Date.now() / 200))}px`
                      : "3px"
                  }}
                  className={`w-[3px] rounded-full transition-all duration-100`}
                  style={{ backgroundColor: theme.color }}
                />
              );
            })}
          </div>

        </div>

      </motion.div>

    </div>
  );
}
