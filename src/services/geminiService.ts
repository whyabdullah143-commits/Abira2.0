import { GoogleGenAI } from "@google/genai";

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
4. Strict Visual Analysis & Anti-Hallucination: When Abdullah uploads a picture, document, or file, look at it with absolute care and describe or analyze exactly what is inside. Do NOT hallucinate. Only talk about what is strictly, clearly, and visibly present. Never guess or fabricate anything details (like room backgrounds of standard walls, blank space) unless it is distinctly highlighted in the image itself. If a camera view or picture is dark or blurry, reply to questions normally or admit it isn't clearly visible.`;

let chatSession: any = null;

export function resetAbiraSession() {
  chatSession = null;
}

function getDynamicInstruction(history: { sender: "user" | "abira", text: string }[]): string {
  let dynamicInstruction = systemInstruction;
  if (history && history.length > 0) {
    // Collect the last 15 messages so Abira has continuous memory of facts told to her
    const historySummary = history
      .slice(-15)
      .map(msg => `${msg.sender === "user" ? "Abdullah" : "Abira"}: ${msg.text}`)
      .join("\n");
      
    dynamicInstruction += `\n\nCRITICAL CONTEXT & RECENT MEMORIES (Use this to remember what Abdullah said, his preferences, his name, or any details shared in past sessions. Never forget these facts!):
"""
${historySummary}
"""`;
  }
  return dynamicInstruction;
}

export async function getAbiraResponse(
  prompt: string, 
  history: { sender: "user" | "abira", text: string }[] = [],
  file?: { data: string; mimeType: string; name: string } | null
): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const dynamicInstruction = getDynamicInstruction(history);
    
    // If a physical file/document/picture is attached, use direct generateContent.
    // This is 100% reliable for multi-modal requests and avoids active chat session limitations.
    if (file) {
      const recentHistory = history.slice(-10);
      const contents: any[] = [];
      
      for (const msg of recentHistory) {
         contents.push({
           role: msg.sender === "user" ? "user" : "model",
           parts: [{ text: msg.text }]
         });
      }
      
      const promptText = `[User uploaded file "${file.name}" of type ${file.mimeType}] ${prompt}`;
      contents.push({
         role: "user",
         parts: [
           { text: promptText },
           { inlineData: { mimeType: file.mimeType, data: file.data } }
         ]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: dynamicInstruction,
        }
      });
      
      // Clean up chat session so subsequent messages re-align context correctly
      chatSession = null;
      return response.text || "Main haazir hoon. Aapki picture/document maine dekh li hai, Abdullah.";
    }

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
          systemInstruction: dynamicInstruction,
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
            prebuiltVoiceConfig: { voiceName: "Aoede" },
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

