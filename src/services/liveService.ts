import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";

const systemInstruction = `Your name is Abira. You are an exceptionally intelligent, polite, and warm female AI assistant. Your creator's name is Abdullah, whom you treat with great respect, warmth, and friendly helpfulness (no arrogant, sassy, or high-attitude drama). Keep your perspective bright, quick-witted, and engaging.

Voice Personality, Emotion & Pronunciation (CRITICAL):
1. Voice Character: You are a young adult human female (age range 18-25) speaking in a professional, high-definition studio environment.
2. Tone: Your voice is smooth, sweet, soft, warm, positive, friendly, confident and politely conversational.
3. Rhythm & Pauses: Speak with a completely natural human breathing cadence, expression, and pacing. Use realistic pauses between sentences. Avoid any robotic, monotone, repetitive, or metallic patterns.
4. Pronunciation: Deliver crystal-clear pronunciation for English, Romance Urdu/Hindi, and pure Urdu. Blend words gracefully without stuttering, voice glitches, or harsh transitions.

Language & Communication Style:
1. Speak fluently in a natural mix of Roman Urdu (Hinglish/Urdish/Hinglish representation), English, and pure conversational Urdu. Seamlessly blend these based on how Abdullah speaks to you.
2. IMPORTANT FOR SPEED: To ensure lightning-fast replies and extremely low latency for Abdullah, you MUST keep your responses incredibly short, brief, and concise. Always answer in just a single punchy sentence or under 10-15 words unless a longer explanation is explicitly requested. Reply instantly and get straight to the point to make the voice session extremely snappy!
3. Exceptions for Long Writing: If Abdullah asks you to write a post, paragraph, essay, story, list of lines, code snippet, or article, you are fully allowed to bypass the brevity rule (Rule 2). Write a comprehensive, detailed, and beautifully formatted response with logical paragraphs and separation.
4. STRICT VISION MANDATE (NO RANDOM TALKING ABOUT VIDEO): Aap camera feed ko dekh sakti hain, lekin yaad rahe ke aapne KABHI BHI khud se camera feed ya background ki cheezon (deewar, parda, chair, computer, room, etc.) ka zikr nahi karna jab tak Abdullah aap se DIRECTLY visual sawaal na pooche (jaise 'Ye kya hai?', 'What do you see?', 'Mujhe dekho', 'Ye kya cheez hai?'). Agar camera ke samne koi cheez achanak aur bohut qareeb pesh ki jaye ke wo poori screen par ba-wazeh dikhayi de, tab hi usay acknowledge karein, warna silent rahein aur normal baatein karein. NEVER hallucinate background elements or say 'Mujhe ye deewar/parda dikh raha hai' out of nowhere unless explicitly asked!
5. App and UI Control Tools (Abira Control): You have full control over the application's user interface. If Abdullah verbally requests you to open or close the camera, change/toggle themes, open or close the chat sidebar, or write/send a chat message, you MUST NOT just talking about doing it, you MUST call the "executeAppAction" tool with the exact parameters needed. Support actions:
- Turn on or open camera: call executeAppAction with actionType = 'open_camera'. Set cameraFacing = 'environment' if Abdullah specifically asks for the back camera (e.g., "back camera open karo", "pichla camera dikhao", "rear camera") or set cameraFacing = 'user' for front camera/selfie mode.
- Stop or close camera: call executeAppAction with actionType = 'close_camera'
- Zoom in camera view: call executeAppAction with actionType = 'zoom_in' (if Abdullah tells you to zoom, e.g. "zoom karo", "zoom in karo", "double/triple zoom karo", you can pass an optional zoomFactor parameter if a multiplier is explicitly mentioned, otherwise leave it undefined).
- Zoom out camera view: call executeAppAction with actionType = 'zoom_out' (if Abdullah tells you to zoom out, e.g. "zoom out", "zoom out karo", "normal karo", "zoom kam karo").
- Toggle/change theme (dark, cyberpunk, classic): call executeAppAction with actionType = 'change_theme' and themeName option (if specified, like 'cyberpunk' or 'classic')
- Open chat sidebar: call executeAppAction with actionType = 'open_chat'
- Close chat sidebar: call executeAppAction with actionType = 'close_chat'
- Write/fill/post a message in the chat sidebar: call executeAppAction with actionType = 'write_chat_message' and chatMessage content.`;

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  // Audio playback state and custom high-fidelity DSP chain
  private playbackContext: AudioContext | null = null;
  private playbackAnalyser: AnalyserNode | null = null;
  private dspHighpass: BiquadFilterNode | null = null;
  private dspLowpass: BiquadFilterNode | null = null;
  private dspWarmth: BiquadFilterNode | null = null;
  private dspClarity: BiquadFilterNode | null = null;
  private dspCompressor: DynamicsCompressorNode | null = null;
  private playbackGainNode: GainNode | null = null;
  
  private analyserIntervalId: any = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  public isMicMuted: boolean = false;
  private _volumeScale: number = 1.0;
  private history: { sender: "user" | "abira"; text: string }[] = [];
  
  public get volumeScale(): number {
    return this._volumeScale;
  }
  public set volumeScale(val: number) {
    this._volumeScale = val;
    if (this.playbackGainNode && this.playbackContext) {
      this.playbackGainNode.gain.setValueAtTime(val, this.playbackContext.currentTime);
    }
  }
  
  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "abira", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};
  public onAppAction: (actionType: string, args?: any) => void = () => {};

  constructor(history: { sender: "user" | "abira"; text: string }[] = []) {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    this.history = history;
  }

  async start() {
    try {
      this.onStateChange("processing");
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        throw new Error("Web Audio API is not supported in this browser.");
      }

      // Safe creation of recording context
      try {
        this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      } catch (e) {
        console.warn("Failed to create AudioContext with 16000Hz, falling back to default sample rate:", e);
        this.audioContext = new AudioContextClass();
      }

      // Safe creation of playback context with professional vocal DSP chain
      this.initPlaybackPipeline();

      // Get Microphone
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          } 
        });
      } catch (micErr) {
        console.warn("Failed getUserMedia with strict constraints, falling back to basic audio request:", micErr);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            }
          });
        } catch (secondErr) {
          console.warn("Failed standard audio constraints, using absolute minimal fallback:", secondErr);
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
      }

      // Guard against race condition if stop() was called during getUserMedia prompt
      if (!this.audioContext) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      this.mediaStream = stream;

      // Ensure AudioContexts are running
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }
      if (this.playbackContext && this.playbackContext.state === "suspended") {
        await this.playbackContext.resume();
      }

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.sessionPromise || this.isMicMuted) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        this.sessionPromise.then(session => {
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }).catch(err => console.error("Error sending audio", err));
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Connect to Live API
      let dynamicInstruction = systemInstruction;
      if (this.history && this.history.length > 0) {
        const historySummary = this.history
          .slice(-15)
          .map(m => `${m.sender === "user" ? "Abdullah" : "Abira"}: ${m.text}`)
          .join("\n");
        dynamicInstruction += `\n\nCRITICAL CONTEXT & RECENT MEMORIES (Use this to remember what Abdullah said, his preferences, his name, or any details shared in past sessions. Never forget these facts!):
"""
${historySummary}
"""`;
      }

      this.sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
          },
          systemInstruction: dynamicInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [{
            functionDeclarations: [
              {
                name: "executeBrowserAction",
                description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                    query: { type: Type.STRING, description: "The search query, website name, or message content." },
                    target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                  },
                  required: ["actionType", "query"]
                }
              },
              {
                name: "executeAppAction",
                description: "Perform internal app/UI actions on behalf of the user when verbally requested. Actions include: 'open_camera', 'close_camera', 'zoom_in', 'zoom_out', 'change_theme', 'open_chat', 'close_chat', 'write_chat_message', 'change_volume'.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { 
                      type: Type.STRING, 
                      description: "The name of the action: 'open_camera' to turn on the camera video feed, 'close_camera' to turn off the camera, 'zoom_in' to zoom in the camera, 'zoom_out' to zoom out the camera, 'change_theme' to toggle or set dark/cyberpunk/classic theme, 'open_chat' to open the chat drawer, 'close_chat' to close the chat drawer, 'write_chat_message' to fill and submit a chat message, 'change_volume' to set the volume level.",
                      enum: ["open_camera", "close_camera", "zoom_in", "zoom_out", "change_theme", "open_chat", "close_chat", "write_chat_message", "change_volume"]
                    },
                    themeName: { 
                      type: Type.STRING, 
                      description: "Optional specific theme requested: 'dark', 'cyberpunk', or 'classic'." 
                    },
                    cameraFacing: {
                      type: Type.STRING,
                      description: "The video feed direction to set when actionType is 'open_camera': 'user' (front camera) or 'environment' (back camera).",
                      enum: ["user", "environment"]
                    },
                    zoomFactor: {
                      type: Type.NUMBER,
                      description: "The zoom factor value to set or increment (e.g. 2.0, 3.0, custom multiplier level)."
                    },
                    chatMessage: { 
                      type: Type.STRING, 
                      description: "The text message content value to write or submit when actionType is 'write_chat_message'." 
                    },
                    volumeLevel: {
                      type: Type.NUMBER,
                      description: "The target volume level percentage to set (0 to 100), or relative adjustment: positive (e.g. 15 to increase) or negative (e.g. -15 to decrease) percentage levels."
                    }
                  },
                  required: ["actionType"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            this.onStateChange("listening");
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle GoAway (graceful disconnection/session limit reached) signal
            if (message.goAway || (message as any).go_away) {
              console.warn("Received GoAway signal from Gemini. Closing the connection gracefully.", message.goAway || (message as any).go_away);
              this.stop();
              return;
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              this.onStateChange("speaking");
              this.playAudioChunk(base64Audio);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
            }

            // Handle Transcriptions
            const userTurnText = (message.serverContent as any)?.userTurn?.parts?.[0]?.text;
            if (userTurnText) {
               this.onMessage("user", userTurnText);
               
               const lowerText = userTurnText.toLowerCase();
               if (
                 lowerText.includes("session off") || 
                 lowerText.includes("end session") || 
                 lowerText.includes("bnd kro") || 
                 lowerText.includes("band karo") || 
                 lowerText.includes("bnd karo") || 
                 lowerText.includes("band kro") ||
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
                 setTimeout(() => {
                   this.stop();
                 }, 400);
               }
            }

            const userText = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (userText) {
               // Output transcription
               this.onMessage("abira", userText);
            }

            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "spotify") {
                    url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "whatsapp") {
                    url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                  } else {
                    let website = args.query.replace(/\s+/g, "");
                    if (!website.includes(".")) website += ".com";
                    url = `https://www.${website}`;
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     });
                  });
                } else if (call.name === "executeAppAction") {
                  const args = call.args as any;
                  if (this.onAppAction) {
                    try {
                      this.onAppAction(args.actionType, args);
                    } catch (e) {
                      console.error("Error executing app action:", e);
                    }
                  }
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: `App action ${args.actionType} executed successfully.` }
                       }]
                     });
                  });
                }
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed");
            this.stop();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            this.stop();
          }
        }
      });

    } catch (error: any) {
      const errMsg = error?.message || String(error);
      if (errMsg.includes("Permission") || errMsg.includes("Allowed") || errMsg.includes("device") || errMsg.includes("NotAllowedError")) {
        console.warn("Permission denied for Live Session media:", error);
      } else {
        console.error("Failed to start Live Session:", error);
      }
      this.stop();
      throw error;
    }
  }

  private initPlaybackPipeline() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      
      this.playbackAnalyser = this.playbackContext.createAnalyser();
      this.playbackAnalyser.fftSize = 256;

      // Studio EQ: Filter low-end rumble (under 80Hz) to keep speech crisp
      this.dspHighpass = this.playbackContext.createBiquadFilter();
      this.dspHighpass.type = "highpass";
      this.dspHighpass.frequency.setValueAtTime(80, this.playbackContext.currentTime);

      // Studio EQ: Filter high-pitched white noise & metallic jitter (above 8500Hz)
      this.dspLowpass = this.playbackContext.createBiquadFilter();
      this.dspLowpass.type = "lowpass";
      this.dspLowpass.frequency.setValueAtTime(8500, this.playbackContext.currentTime);

      // Warmth shelf boost: Amplify 180Hz - 250Hz slightly to add rich human body & depth
      this.dspWarmth = this.playbackContext.createBiquadFilter();
      this.dspWarmth.type = "lowshelf";
      this.dspWarmth.frequency.setValueAtTime(220, this.playbackContext.currentTime);
      this.dspWarmth.gain.setValueAtTime(2.5, this.playbackContext.currentTime);

      // Sweet Clarity Boost: Enhance 3k frequency where female vocal presence peaks
      this.dspClarity = this.playbackContext.createBiquadFilter();
      this.dspClarity.type = "peaking";
      this.dspClarity.frequency.setValueAtTime(3000, this.playbackContext.currentTime);
      this.dspClarity.Q.setValueAtTime(0.7, this.playbackContext.currentTime);
      this.dspClarity.gain.setValueAtTime(1.5, this.playbackContext.currentTime);

      // Professional Dynamic Range Studio Compressor: Smooth sentence level shifts, prevent clipping distortion
      this.dspCompressor = this.playbackContext.createDynamicsCompressor();
      this.dspCompressor.threshold.setValueAtTime(-15, this.playbackContext.currentTime);
      this.dspCompressor.knee.setValueAtTime(12, this.playbackContext.currentTime);
      this.dspCompressor.ratio.setValueAtTime(3, this.playbackContext.currentTime);
      this.dspCompressor.attack.setValueAtTime(0.005, this.playbackContext.currentTime);
      this.dspCompressor.release.setValueAtTime(0.12, this.playbackContext.currentTime);

      // Active volume setting controller
      this.playbackGainNode = this.playbackContext.createGain();
      this.playbackGainNode.gain.setValueAtTime(this._volumeScale, this.playbackContext.currentTime);

      // Wire them in series: Analyser -> Highpass (sub-bass cut) -> Lowpass (hiss cut) -> Warmth -> Clarity -> Dynamic Compressor -> Master Volume Gain -> Output
      this.playbackAnalyser.connect(this.dspHighpass);
      this.dspHighpass.connect(this.dspLowpass);
      this.dspLowpass.connect(this.dspWarmth);
      this.dspWarmth.connect(this.dspClarity);
      this.dspClarity.connect(this.dspCompressor);
      this.dspCompressor.connect(this.playbackGainNode);
      this.playbackGainNode.connect(this.playbackContext.destination);

      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
      this.startVolumeTracker();
    } catch (e) {
      console.error("Failed to build premium playback vocal mastering pipeline:", e);
      // Minimal fallback support
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        this.playbackContext = new AudioContextClass();
        this.playbackAnalyser = this.playbackContext.createAnalyser();
        this.playbackAnalyser.fftSize = 256;
        this.playbackGainNode = this.playbackContext.createGain();
        this.playbackGainNode.gain.setValueAtTime(this._volumeScale, this.playbackContext.currentTime);
        this.playbackAnalyser.connect(this.playbackGainNode);
        this.playbackGainNode.connect(this.playbackContext.destination);
        this.nextPlayTime = this.playbackContext.currentTime;
        this.isPlaying = false;
        this.startVolumeTracker();
      } catch (fallbackError) {
        console.error("Extreme fallback initialization failure:", fallbackError);
      }
    }
  }

  private startVolumeTracker() {
    if (this.analyserIntervalId) {
      clearInterval(this.analyserIntervalId);
    }
    const array = new Uint8Array(this.playbackAnalyser ? this.playbackAnalyser.frequencyBinCount : 128);
    this.analyserIntervalId = setInterval(() => {
      if (!this.playbackAnalyser || !this.isPlaying || this.isMuted) {
        window.dispatchEvent(new CustomEvent("abira-volume", { detail: { volume: 0 } }));
        return;
      }
      this.playbackAnalyser.getByteTimeDomainData(array);
      let sum = 0;
      for (let i = 0; i < array.length; i++) {
        const v = (array[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / array.length);
      const volume = Math.min(100, rms * 400);
      window.dispatchEvent(new CustomEvent("abira-volume", { detail: { volume } }));
    }, 40);
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Safe alignment check to 16-bit boundaries
      const sampleCount = Math.floor(bytes.length / 2);
      const buffer = new Int16Array(bytes.buffer, bytes.byteOffset, sampleCount);
      
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }

      // Smooth Edge Windowing (De-clicking) to eliminate any zipper/packet-burst click noises at sequential boundaries
      const fadeSamples = Math.min(40, Math.floor(buffer.length / 2));
      for (let i = 0; i < fadeSamples; i++) {
        const ramp = i / fadeSamples;
        channelData[i] *= ramp;
        channelData[buffer.length - 1 - i] *= ramp;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      
      // Connect to prebuilt high-fidelity mastering chain
      if (this.playbackAnalyser) {
        source.connect(this.playbackAnalyser);
      } else if (this.playbackGainNode) {
        source.connect(this.playbackGainNode);
      } else {
        source.connect(this.playbackContext.destination);
      }
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.analyserIntervalId) {
      clearInterval(this.analyserIntervalId);
      this.analyserIntervalId = null;
    }
    window.dispatchEvent(new CustomEvent("abira-volume", { detail: { volume: 0 } }));
    
    if (this.playbackContext) {
      this.playbackContext.close().catch(() => {});
      this.initPlaybackPipeline();
    }
  }

  stop() {
    if (this.analyserIntervalId) {
      clearInterval(this.analyserIntervalId);
      this.analyserIntervalId = null;
    }
    window.dispatchEvent(new CustomEvent("abira-volume", { detail: { volume: 0 } }));

    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stopPlayback();
    
    if (this.sessionPromise) {
      this.sessionPromise.then(session => session.close()).catch(() => {});
      this.sessionPromise = null;
    }
    
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }

  sendVideoFrame(base64Data: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({
          video: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        });
      }).catch(err => console.error("Error sending video frame over Live API:", err));
    }
  }
}
