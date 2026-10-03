/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 10/07/2026, 14:01:25
 * Dependents: components/ActionPane/index.tsx, components/DesignPreview/steps/PreviewComponents.tsx, components/layout/GameModals.tsx
 * Imports: 3 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file RestModal.tsx
 * Short rest modal for spending Hit Point Dice across the party.
 *
 * The blocking-dialog skeleton (document-root portal, dim backdrop, focus trap,
 * centered panel) is delegated to the shared {@link ModalDialog} shell. This
 * component only supplies the Short Rest title/close, the per-character Hit Dice
 * spend form, and the Cancel / Begin Rest footer.
 * @component-owner Gameplay Team / Core UI
 */
import React from 'react';
import { PlayerCharacter, HitPointDiceSpendMap } from '../../types';
interface RestModalProps {
    isOpen: boolean;
    party: PlayerCharacter[];
    onClose: () => void;
    onConfirm: (spend: HitPointDiceSpendMap) => void;
}
declare const RestModal: React.FC<RestModalProps>;
export default RestModal;
