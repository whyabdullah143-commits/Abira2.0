export async function playPCM(base64Data: string, volumeScale: number = 1.0): Promise<void> {
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

    // Smooth boundary windowing (De-clicking) to remove pops on audio startup & close
    const fadeSamples = Math.min(40, Math.floor(buffer.length / 2));
    for (let i = 0; i < fadeSamples; i++) {
      const ramp = i / fadeSamples;
      channelData[i] *= ramp;
      channelData[buffer.length - 1 - i] *= ramp;
    }
    
    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;

    // Highpass to roll off speaker rumble under 80Hz
    const highpass = audioCtx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(80, audioCtx.currentTime);

    // Lowpass to roll off metallic high frequencies and white noise above 8.5kHz
    const lowpass = audioCtx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(8500, audioCtx.currentTime);

    // Low shelf boost to add natural warmth/body around 220Hz
    const warmth = audioCtx.createBiquadFilter();
    warmth.type = "lowshelf";
    warmth.frequency.setValueAtTime(220, audioCtx.currentTime);
    warmth.gain.setValueAtTime(2.5, audioCtx.currentTime);

    // Peaking filter to enhance focus/presence around 3kHz
    const clarity = audioCtx.createBiquadFilter();
    clarity.type = "peaking";
    clarity.frequency.setValueAtTime(3000, audioCtx.currentTime);
    clarity.Q.setValueAtTime(0.7, audioCtx.currentTime);
    clarity.gain.setValueAtTime(1.5, audioCtx.currentTime);

    // Dynamic Range Compressor to control voice bursts and level sentences professionaly 
    const compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-15, audioCtx.currentTime);
    compressor.knee.setValueAtTime(12, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(3, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.005, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.12, audioCtx.currentTime);

    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.setValueAtTime(volumeScale, audioCtx.currentTime);

    // Connect nodes in sequence:
    source.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(warmth);
    warmth.connect(clarity);
    clarity.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Dynamic Volume Tracking Loop
    const array = new Uint8Array(analyser.frequencyBinCount);
    let isFinished = false;
    const trackerInterval = setInterval(() => {
      if (isFinished) return;
      analyser.getByteTimeDomainData(array);
      let sum = 0;
      for (let i = 0; i < array.length; i++) {
        const v = (array[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / array.length);
      const volume = Math.min(100, rms * 400);
      window.dispatchEvent(new CustomEvent("abira-volume", { detail: { volume } }));
    }, 40);

    source.start();
    
    return new Promise<void>(resolve => {
      source.onended = () => {
        isFinished = true;
        clearInterval(trackerInterval);
        window.dispatchEvent(new CustomEvent("abira-volume", { detail: { volume: 0 } }));
        audioCtx.close().catch(() => {});
        resolve();
      };
    });
  } catch (error) {
    console.error("Error playing audio:", error);
  }
}
