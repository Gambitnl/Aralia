/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:27:35
 * Dependents: PartyEditorModal.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import React from 'react';
import { TempPartyMember } from '../../types';
interface PartyManagerProps {
    party: TempPartyMember[];
    onPartyChange: (newParty: TempPartyMember[]) => void;
}
export declare const PartyManager: React.FC<PartyManagerProps>;
export {};
