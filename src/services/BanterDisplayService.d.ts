import { Companion } from '../types/companions';
export declare const BanterDisplayService: {
    queueBanter: (lines: {
        text: string;
        speakerId: string;
        delay?: number;
    }[], addMessage: (text: string, sender: string) => void, companions: Record<string, Companion>) => void;
    cancelActiveBanter: () => void;
};
