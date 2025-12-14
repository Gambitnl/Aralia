/**
 * @file src/hooks/useAudio.ts
 * Custom hook for managing audio context and PCM audio playback.
 *
 * Manages persisted volume settings and handles audio context lifecycle.
 */
import { useRef, useCallback, useEffect } from 'react';
import { GameMessage } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { z } from 'zod';

const AUDIO_CONTEXT_SAMPLE_RATE = 24000;
const PCM_AUDIO_SAMPLE_RATE = 24000;
const PCM_AUDIO_BIT_DEPTH = 16;
const PCM_NORMALIZATION_FACTOR = 32768.0;
const NUMBER_OF_CHANNELS = 1;

type AddMessageFn = (text: string, sender?: 'system' | 'player' | 'npc') => void;

// Define schema for audio settings
const audioSettingsSchema = z.object({
  volume: z.number().min(0).max(1), // Volume from 0.0 to 1.0
  isMuted: z.boolean().default(false),
});

type AudioSettings = z.infer<typeof audioSettingsSchema>;

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  volume: 1.0,
  isMuted: false,
};

export function useAudio(addMessage: AddMessageFn) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Persist audio settings with validation
  const [audioSettings, setAudioSettings] = useLocalStorage<AudioSettings>(
    'aralia_audio_settings',
    DEFAULT_AUDIO_SETTINGS,
    { schema: audioSettingsSchema }
  );

  // Update gain node when volume changes
  useEffect(() => {
    if (gainNodeRef.current && audioContextRef.current) {
      const targetVolume = audioSettings.isMuted ? 0 : audioSettings.volume;
      gainNodeRef.current.gain.setValueAtTime(targetVolume, audioContextRef.current.currentTime);
    }
  }, [audioSettings.volume, audioSettings.isMuted]);

  // TODO: Suspend/resume the AudioContext on tab visibility changes (Reason: background tabs keep the context alive and waste CPU/battery; Expectation: automatically pause playback pipeline until the user returns).
  const playPcmAudio = useCallback(
    async (base64PcmData: string) => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new AudioContext({ sampleRate: AUDIO_CONTEXT_SAMPLE_RATE });
          // Create a global gain node for volume control
          gainNodeRef.current = audioContextRef.current.createGain();
          gainNodeRef.current.connect(audioContextRef.current.destination);

          // Apply initial volume
          const targetVolume = audioSettings.isMuted ? 0 : audioSettings.volume;
          gainNodeRef.current.gain.value = targetVolume;

        } catch (e) {
          console.error('Error creating AudioContext: ', e);
          addMessage(
            `(Audio playback not available: ${
              e instanceof Error ? e.message : String(e)
            })`,
            'system',
          );
          return;
        }
      }
      const audioContext = audioContextRef.current;
      const gainNode = gainNodeRef.current;

      if (!audioContext || !gainNode) return;

      try {
        const pcmString = atob(base64PcmData);
        const pcmDataBuffer = new ArrayBuffer(pcmString.length);
        const pcmDataView = new Uint8Array(pcmDataBuffer);
        for (let i = 0; i < pcmString.length; i++) {
          pcmDataView[i] = pcmString.charCodeAt(i);
        }

        const pcmFloat32Data = new Float32Array(
          pcmDataBuffer.byteLength / (PCM_AUDIO_BIT_DEPTH / 8),
        );
        const dataView = new DataView(pcmDataBuffer);
        for (let i = 0; i < pcmFloat32Data.length; i++) {
          const sample = dataView.getInt16(i * (PCM_AUDIO_BIT_DEPTH / 8), true);
          pcmFloat32Data[i] = sample / PCM_NORMALIZATION_FACTOR;
        }
        const audioBuffer = audioContext.createBuffer(
          NUMBER_OF_CHANNELS,
          pcmFloat32Data.length,
          PCM_AUDIO_SAMPLE_RATE,
        );
        audioBuffer.copyToChannel(pcmFloat32Data, 0);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;

        // Connect source -> GainNode -> Destination
        source.connect(gainNode);

        source.start();
      } catch (error) {
        console.error('Failed to play PCM audio:', error);
        addMessage(
          `(Error playing synthesized speech: ${
            error instanceof Error ? error.message : String(error)
          })`,
          'system',
        );
      }
    },
    [addMessage, audioSettings.volume, audioSettings.isMuted]
  );

  const cleanupAudioContext = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.error("Error closing AudioContext: ", e));
      audioContextRef.current = null;
      gainNodeRef.current = null;
    }
  }, []);

  const setVolume = useCallback((volume: number) => {
    setAudioSettings(prev => ({ ...prev, volume: Math.max(0, Math.min(1, volume)) }));
  }, [setAudioSettings]);

  const toggleMute = useCallback(() => {
    setAudioSettings(prev => ({ ...prev, isMuted: !prev.isMuted }));
  }, [setAudioSettings]);

  return {
    playPcmAudio,
    cleanupAudioContext,
    volume: audioSettings.volume,
    isMuted: audioSettings.isMuted,
    setVolume,
    toggleMute
  };
}
