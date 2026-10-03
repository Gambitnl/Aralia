/**
 * @file SpellbookOverlay.tsx
 * A component for displaying a character's spellbook as a full-screen overlay.
 * Features a 2-column master-detail layout with spell list and inline glossary display.
 */
import React from 'react';
import { PlayerCharacter, Action } from '../../../types';
interface SpellbookOverlayProps {
    isOpen: boolean;
    character: PlayerCharacter;
    onClose: () => void;
    onAction: (action: Action) => void;
    /** Full party, used by the out-of-combat cast target picker. */
    party?: PlayerCharacter[];
}
declare const SpellbookOverlay: React.FC<SpellbookOverlayProps>;
export default SpellbookOverlay;
