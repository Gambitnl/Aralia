/**
 * @file UnifiedDebugLogViewer.tsx
 * Combines Banter Debug Log and Ollama Log into a single window with tabs.
 */
import React from 'react';
import { OllamaLogEntry } from '../../types';
interface BanterDebugLogEntry {
    timestamp: Date;
    check: string;
    result: boolean | string;
    details?: string;
}
interface UnifiedDebugLogViewerProps {
    isOpen: boolean;
    onClose: () => void;
    banterLogs: BanterDebugLogEntry[];
    onClearBanterLogs: () => void;
    onForceBanterTrigger?: () => void;
    ollamaLogs: OllamaLogEntry[];
    isBanterPaused?: boolean;
    onToggleBanterPause?: () => void;
}
export declare const UnifiedDebugLogViewer: React.FC<UnifiedDebugLogViewerProps>;
export {};
