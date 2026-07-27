/**
 * @file GeminiLogViewer.tsx
 * This component displays a modal with a log of prompts sent to and responses received from Gemini.
 */
import React from 'react';
import { GeminiLogEntry } from '../../types';
interface GeminiLogViewerProps {
    isOpen: boolean;
    onClose: () => void;
    logEntries: GeminiLogEntry[];
}
declare const GeminiLogViewer: React.FC<GeminiLogViewerProps>;
export default GeminiLogViewer;
