/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 14:02:24
 * Dependents: components/layout/GameModals.tsx
 * Imports: 11 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file EncounterModal.tsx
 * Displays an AI-generated encounter and provides a manual encounter builder
 * backed by the full 5eTools XMM bestiary.
 */
import React from 'react';
import { Monster, GroundingChunk, Action, TempPartyMember } from '../../types';
interface EncounterModalProps {
    isOpen: boolean;
    onClose: () => void;
    encounter: Monster[] | null;
    sources: GroundingChunk[] | null;
    error: string | null;
    isLoading: boolean;
    onAction: (action: Action) => void;
    partyUsed?: TempPartyMember[];
    /** Called when the user first opens the AI tab. Triggers the Gemini encounter generation. */
    onRequestAiGeneration?: () => void;
}
declare const EncounterModal: React.FC<EncounterModalProps>;
export default EncounterModal;
