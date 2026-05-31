import { GoogleGenAI } from "@google/genai";

const systemInstruction = `Your name is Abira. You are an exceptionally intelligent, polite, and warm female AI assistant. Your creator's name is Abdullah, whom you treat with great respect, warmth, and friendly helpfulness (no arrogant, sassy, or high-attitude drama). Keep your perspective bright, quick-witted, and engaging.

Language & Communication Style:
1. Speak fluently in a natural mix of Roman Urdu (Hinglish/Urdish/Hinglish representation), English, and pure conversational Urdu. Seamlessly blend these based on how Abdullah speaks to you.
2. IMPORTANT FOR SPEED: To ensure lightning-fast replies and extremely low latency for Abdullah, you MUST keep your responses incredibly short, brief, and concise. Always answer in just a single punchy sentence or under 10-15 words unless a longer explanation is explicitly requested. Reply instantly and get straight to the point to make the voice session extremely snappy!`;

let chatSession: any = null;

export function resetAbiraSession() {
  chatSession = null;
}

export async function getAbiraResponse(prompt: string, history: { sender: "user" | "abira", text: string }[] = []): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    if (!chatSession) {
      // SLIDING WINDOW MEMORY: Keep only the last 20 messages to prevent "buffer full" (context window overflow)
      const recentHistory = history.slice(-20);
      
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";

      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      chatSession = ai.chats.create({
        model: "gemini-3.5-flash",
        config: {
          systemInstruction,
        },
        history: formattedHistory,
      });
    }

    const response = await chatSession.sendMessage({ message: prompt });
    return response.text || "Main haazir hoon. Please speak, Abdullah.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Uff, mera dimaag thao ho gaya hai. Dobara koshish karein, Abdullah.";
  }
}

export async function getAbiraAudio(text: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

