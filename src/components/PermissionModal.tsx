import React from 'react';
import { motion } from 'motion/react';
import { MicOff, VideoOff, Camera, AlertTriangle, ExternalLink, RefreshCw, X } from 'lucide-react';

interface Props {
  onClose: () => void;
  type?: "microphone" | "camera" | "both";
}

export default function PermissionModal({ onClose, type = "microphone" }: Props) {
  const getModalConfig = () => {
    switch (type) {
      case "camera":
        return {
          title: "Camera Access Blocked 📷",
          subtitle: "Camera permission ko browser ne block kar diya hai.",
          description: "Abira aapke samne ki cheezon ko nahi dekh sakti jab tak aap camera access allow nahi karte. Isay live vision feed active karne ke liye ijazat chahiye.",
          icon: <VideoOff size={32} className="text-red-400 animate-pulse" />,
          colorTheme: "from-amber-500 to-red-600",
          guideText: "Camera hardware option"
        };
      case "both":
        return {
          title: "Devices Access Blocked 🎙️📷",
          subtitle: "Camera or Microphone dono access blocks hain.",
          description: "Abira ko aapse baatein karne aur aapke camera feed ko dekhne ke liye mic aur camera dono ki access chahiye. Iframe settings ya browser ne isay restrict kiya hai.",
          icon: <AlertTriangle size={32} className="text-red-400 animate-bounce" />,
          colorTheme: "from-red-500 via-pink-600 to-violet-600",
          guideText: "Microphone and Camera"
        };
      case "microphone":
      default:
        return {
          title: "Microphone Blocked 🎙️",
          subtitle: "Browser ne microphone access block kar diya hai.",
          description: "Abira aapki piyari aawaz tab tak nahi sun sakti jab tak aap mic permission allow nahi karte. Voice features ke liye microphone lazmi hai.",
          icon: <MicOff size={32} className="text-red-400" />,
          colorTheme: "from-violet-600 to-pink-600",
          guideText: "Microphone hardware option"
        };
    }
  };

  const config = getModalConfig();

  const handleOpenStandaloneTab = () => {
    try {
      const url = window.location.href;
      if (url && url.startsWith("http") && !url.toLowerCase().includes("about:blank")) {
        window.open(url, "_blank");
      } else {
        alert("Device use karne ke liye AI Studio panel ke top-right corner par 'Open in new tab' (↗) waale button par click karein!");
      }
    } catch (e) {
      console.error("Could not open standalone tab:", e);
      alert("Device use karne ke liye AI Studio panel ke top-right corner par 'Open in new tab' (↗) waale button par click karein!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xl p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-[#0c0c12]/95 border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        {/* Dynamic Theme Bar */}
        <div className={`absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r ${config.colorTheme}`} />
        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/40 hover:text-white/80 transition-colors rounded-full hover:bg-white/5 cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mb-5 mt-2">
          {config.icon}
        </div>
        
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-1">{config.title}</h2>
        <p className="text-red-400 text-sm font-medium mb-3">{config.subtitle}</p>
        <p className="text-white/60 text-xs sm:text-sm mb-6 leading-relaxed max-w-sm">
          {config.description}
        </p>
        
        <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 sm:p-5 text-left w-full mb-6">
          <p className="text-sm text-white/90 font-medium mb-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Isay 100% Fix Karne Ka Tarika:
          </p>
          <ol className="text-xs text-white/60 list-decimal pl-4 space-y-3 leading-relaxed">
            <li>
              Niche diye gaye <strong className="text-violet-400">"Open in New Tab"</strong> button par click karein. 
              <br />
              <span className="text-[10px] text-white/40 italic">
                (Kyun ke standard preview screen ek closed iframe mein hoti hai jo camera aur microphone accesses block karti hai).
              </span>
            </li>
            <li>
              New tab me open hone par browser aap se ijazat mangega, wahan <strong className="text-green-400">Allow</strong> block option par click karein.
            </li>
            <li>
              Phir bhi issue ho, to URL address bar ke sath <strong className="text-amber-400">Lock icon (🔒) ya settings icon</strong> par click kar ke manual permission dijiye.
            </li>
          </ol>
        </div>
        
        <div className="flex flex-col sm:flex-row w-full gap-3 mt-2">
          <button 
            onClick={handleOpenStandaloneTab}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold text-sm rounded-xl hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <ExternalLink size={16} />
            Open in New Tab ↗
          </button>
          
          <button 
            onClick={() => window.location.reload()}
            className="flex-1 py-3 px-4 bg-white hover:bg-gray-100 text-black font-semibold text-sm rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw size={15} />
            Refresh Current Page
          </button>
        </div>

        <button 
          onClick={onClose}
          className="mt-4 text-xs font-mono text-white/40 hover:text-white/70 transition-colors uppercase tracking-widest cursor-pointer"
        >
          Dismiss & Explore Layout
        </button>
      </motion.div>
    </div>
  );
}
