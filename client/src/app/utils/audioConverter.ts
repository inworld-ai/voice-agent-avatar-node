/**
 * Audio converter utilities for HeyGen integration
 * Converts WAV audio (24kHz from Inworld TTS) to PCM format (24kHz, 16-bit, mono)
 * No resampling needed since Inworld TTS already outputs 24kHz!
 */

/**
 * Converts base64-encoded WAV audio to base64-encoded PCM audio
 * @param base64Wav - Base64 encoded WAV audio data (24kHz from Inworld)
 * @returns Promise<string> - Base64 encoded raw PCM audio (16-bit signed, 24kHz, mono)
 */
export async function convertWavToPcm24k(base64Wav: string): Promise<string> {
  try {
    // Decode base64 to binary
    const binaryString = atob(base64Wav);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Create AudioContext for decoding WAV
    const audioContext = new (window.AudioContext ||
      (window as any).webkitAudioContext)();

    // Decode WAV to AudioBuffer (already 24kHz from Inworld TTS)
    const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);

    // Extract audio data (first channel for mono)
    const float32Data = audioBuffer.getChannelData(0);

    // Convert Float32 (-1.0 to 1.0) to Int16 PCM for HeyGen
    const int16Array = new Int16Array(float32Data.length);
    for (let i = 0; i < float32Data.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Data[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    // Convert Int16Array to base64
    const pcmBytes = new Uint8Array(int16Array.buffer);
    let binaryPcm = "";
    for (let i = 0; i < pcmBytes.length; i++) {
      binaryPcm += String.fromCharCode(pcmBytes[i]);
    }

    return btoa(binaryPcm);
  } catch (error) {
    console.error("Error converting WAV to PCM:", error);
    throw error;
  }
}
