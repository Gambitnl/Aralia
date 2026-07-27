/**
 * @file src/components/CharacterSheet/JournalSpread.tsx
 * Parchment-styled two-page journal spread with narrative entries and session recaps.
 */
import React from 'react';
import { JournalEntry } from '../../../types/journal';
import './JournalTab.css';
interface JournalSpreadProps {
    entry: JournalEntry | null;
    onPreviousPage?: () => void;
    onNextPage?: () => void;
    hasPreviousPage?: boolean;
    hasNextPage?: boolean;
}
export declare const JournalSpread: React.FC<JournalSpreadProps>;
export default JournalSpread;
