type AddMessageFn = (text: string, sender?: 'system' | 'player' | 'npc') => void;
export declare function useAudio(addMessage: AddMessageFn): {
    playPcmAudio: (base64PcmData: string) => Promise<void>;
    cleanupAudioContext: () => void;
    volume: number;
    isMuted: boolean;
    setVolume: (volume: number) => void;
    toggleMute: () => void;
};
export {};
