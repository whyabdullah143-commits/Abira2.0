import React from 'react';
import { motion } from 'motion/react';
import { MicOff } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export default function PermissionModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-orange-500" />
        
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
          <MicOff size={32} className="text-red-400" />
        </div>
        
        <h2 className="text-2xl font-serif font-medium text-white mb-3">Microphone Blocked 🎙️</h2>
        <p className="text-white/60 text-sm mb-6 leading-relaxed">
          Browser ne microphone access block kar diya hai. Abira aapki aawaz tab tak nahi sun sakti jab tak aap mic permission allow nahi karte.
        </p>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-left w-full mb-8">
          <p className="text-sm text-white/80 font-medium mb-3">Isay fix karne ka aasan tarika:</p>
          <ol className="text-xs text-white/60 list-decimal pl-4 space-y-3">
            <li>Niche diye gaye <strong className="text-violet-400">"Open in Standalone Tab"</strong> button par click karein taake app new tab me open ho jaye.</li>
            <li>Agar phir bhi block ho, to browser ke address bar me <strong className="text-pink-400">Lock icon (🔒) ya Setting icon (⚙️)</strong> par click karein.</li>
            <li>Wahan <strong className="text-violet-400">Microphone</strong> option ko <strong className="text-green-400">Allow</strong> karein aur page ko refresh karein.</li>
          </ol>
          <p className="text-xs text-amber-300 font-medium mt-3">💡 Tip: Aap typing ke zariye bhi Abira se chat kar sakte hain! Screen par keyboard icon par click karein.</p>
        </div>
        
        <div className="flex flex-col w-full gap-3">
          <button 
            onClick={() => window.open(window.location.href, "_blank")}
            className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-medium rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
          >
            Open in Standalone Tab ↗
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-white text-black font-medium rounded-xl hover:bg-gray-200 transition-colors"
          >
            Refresh Current Page
          </button>
          <button 
            onClick={onClose}
            className="w-full py-3 px-4 bg-white/5 text-white/70 font-medium rounded-xl hover:bg-white/10 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
