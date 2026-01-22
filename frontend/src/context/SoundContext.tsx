import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';

interface SoundContextType {
  isMuted: boolean;
  toggleMute: () => void;
  playCorrectSound: () => void;
  playWrongSound: () => void;
  playBonusSound: () => void;
  playTickSound: () => void;
  playGameOverSound: () => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [isMuted, setIsMuted] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const soundsRef = useRef<{ [key: string]: Audio.Sound | null }>({});
  
  // Web Audio API context (for web only)
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio
  useEffect(() => {
    const init = async () => {
      if (Platform.OS !== 'web') {
        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });
          console.log('[Sound] Audio mode set successfully');
        } catch (e) {
          console.warn('[Sound] Failed to set audio mode:', e);
        }
      }
      setIsReady(true);
    };
    init();

    return () => {
      // Cleanup
      Object.values(soundsRef.current).forEach(sound => {
        if (sound) sound.unloadAsync().catch(() => {});
      });
    };
  }, []);

  // Web Audio API context getter
  const getAudioContext = useCallback(() => {
    if (Platform.OS === 'web') {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      return audioContextRef.current;
    }
    return null;
  }, []);

  // Play sound using Web Audio API (for web)
  const playWebSound = useCallback((frequencies: number[], durations: number[], waveType: OscillatorType = 'sine') => {
    if (isMuted) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    let time = ctx.currentTime;
    frequencies.forEach((freq, i) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.type = waveType;
      oscillator.frequency.setValueAtTime(freq, time);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      gainNode.gain.setValueAtTime(0.3, time);
      gainNode.gain.exponentialRampToValueAtTime(0.01, time + durations[i]);
      
      oscillator.start(time);
      oscillator.stop(time + durations[i]);
      
      time += durations[i] * 0.8;
    });
  }, [isMuted, getAudioContext]);

  // Play sound using expo-av (for native)
  const playNativeBeep = useCallback(async (frequency: number, durationMs: number, soundKey: string) => {
    if (isMuted || !isReady || Platform.OS === 'web') return;
    
    try {
      // Unload previous sound if exists
      if (soundsRef.current[soundKey]) {
        await soundsRef.current[soundKey]?.unloadAsync();
      }

      // Create a simple audio buffer with beep
      const sampleRate = 44100;
      const numSamples = Math.floor(sampleRate * (durationMs / 1000));
      
      // Generate WAV header + audio data
      const wavBuffer = generateWavBuffer(frequency, numSamples, sampleRate);
      const base64 = arrayBufferToBase64(wavBuffer);
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/wav;base64,${base64}` },
        { shouldPlay: true, volume: 0.5 }
      );
      
      soundsRef.current[soundKey] = sound;
      
      // Auto cleanup after playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync().catch(() => {});
          soundsRef.current[soundKey] = null;
        }
      });
    } catch (error) {
      console.warn('[Sound] Native sound error:', error);
    }
  }, [isMuted, isReady]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const playCorrectSound = useCallback(() => {
    if (Platform.OS === 'web') {
      playWebSound([523.25, 659.25, 783.99, 1046.50], [0.12, 0.12, 0.12, 0.2], 'sine');
    } else {
      playNativeBeep(783.99, 300, 'correct');
    }
  }, [playWebSound, playNativeBeep]);

  const playWrongSound = useCallback(() => {
    if (Platform.OS === 'web') {
      playWebSound([400, 350, 300, 250], [0.12, 0.12, 0.12, 0.2], 'sawtooth');
    } else {
      playNativeBeep(250, 400, 'wrong');
    }
  }, [playWebSound, playNativeBeep]);

  const playBonusSound = useCallback(() => {
    if (Platform.OS === 'web') {
      playWebSound([523.25, 659.25, 783.99, 1046.50, 1318.51], [0.08, 0.08, 0.08, 0.08, 0.15], 'triangle');
    } else {
      playNativeBeep(1046.50, 300, 'bonus');
    }
  }, [playWebSound, playNativeBeep]);

  const playTickSound = useCallback(() => {
    if (Platform.OS === 'web') {
      playWebSound([880], [0.05], 'square');
    } else {
      playNativeBeep(880, 50, 'tick');
    }
  }, [playWebSound, playNativeBeep]);

  const playGameOverSound = useCallback(() => {
    if (Platform.OS === 'web') {
      playWebSound([392.00, 349.23, 329.63, 293.66, 261.63], [0.15, 0.15, 0.15, 0.15, 0.3], 'triangle');
    } else {
      playNativeBeep(261.63, 500, 'gameOver');
    }
  }, [playWebSound, playNativeBeep]);

  return (
    <SoundContext.Provider value={{
      isMuted,
      toggleMute,
      playCorrectSound,
      playWrongSound,
      playBonusSound,
      playTickSound,
      playGameOverSound,
    }}>
      {children}
    </SoundContext.Provider>
  );
}

// Generate a WAV buffer with a sine wave
function generateWavBuffer(frequency: number, numSamples: number, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = numSamples * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  // Write WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  
  // Generate sine wave with envelope
  const volume = 0.4;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const fadeIn = Math.min(1, i / (sampleRate * 0.01));
    const fadeOut = Math.min(1, (numSamples - i) / (sampleRate * 0.02));
    const envelope = fadeIn * fadeOut;
    const sample = Math.sin(2 * Math.PI * frequency * t) * volume * envelope;
    const intSample = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, intSample, true);
  }
  
  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function useSound() {
  const context = useContext(SoundContext);
  if (!context) {
    throw new Error('useSound must be used within a SoundProvider');
  }
  return context;
}
