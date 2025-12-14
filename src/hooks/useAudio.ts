/**
 * @file src/hooks/useAudio.ts
 * Custom hook for managing audio context and PCM audio playback.
 */
import { useRef, useCallback } from 'react';
import { GameMessage } from '../types';

const AUDIO_CONTEXT_SAMPLE_RATE = 24000;
const PCM_AUDIO_SAMPLE_RATE = 24000;
const PCM_AUDIO_BIT_DEPTH = 16;
const PCM_NORMALIZATION_FACTOR = 32768.0;
const NUMBER_OF_CHANNELS = 1;

type AddMessageFn = (text: string, sender?: 'system' | 'player' | 'npc') => void;

export function useAudio(addMessage: AddMessageFn) {
  const audioContextRef = useRef<AudioContext | null>(null);

  // TODO: Suspend/resume the AudioContext on tab visibility changes (Reason: background tabs keep the context alive and waste CPU/battery; Expectation: automatically pause playback pipeline until the user returns).
  const playPcmAudio = useCallback(
    async (base64PcmData: string) => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new AudioContext({ sampleRate: AUDIO_CONTEXT_SAMPLE_RATE });
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
      if (!audioContext) return;

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
        source.connect(audioContext.destination);
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
    [addMessage],
  );

  const cleanupAudioContext = useCallback(() => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(e => console.error("Error closing AudioContext: ", e));
      audioContextRef.current = null;
    }
  }, []);

  return { playPcmAudio, cleanupAudioContext };
}
