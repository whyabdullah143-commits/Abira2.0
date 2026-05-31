export async function playPCM(base64Data: string): Promise<void> {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("AudioContext not supported");
      return;
    }
    const audioCtx = new AudioContextClass({ sampleRate: 24000 });
    
    // Ensure context is running (fixes browser gesture audio blocks)
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Safe alignment to 16-bit boundaries
    const sampleCount = Math.floor(bytes.length / 2);
    const buffer = new Int16Array(bytes.buffer, bytes.byteOffset, sampleCount);
    
    const audioBuffer = audioCtx.createBuffer(1, buffer.length, 24000);
    const channelData = audioBuffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
      channelData[i] = buffer[i] / 32768.0;
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start();
    
    return new Promise<void>(resolve => {
      source.onended = () => {
        audioCtx.close().catch(() => {});
        resolve();
      };
    });
  } catch (error) {
    console.error("Error playing audio:", error);
  }
}
