/**
 * ARCHITECTURAL CONTEXT:
 * This component handles the 'Spell Source' selection for complex feats
 * like 'Magic Initiate'. It maps abstract spellcasting requirements to
 * concrete Class identities (Bard, Cleric, etc.).
 *
 * Recent updates focus on 'Thematic Identity' and 'Premium UI Feedback'.
 * - Integrated `SOURCE_INFO` with hand-crafted flavour text. This adds
 *   narrative depth to mechanical choices, helping the player feel
 *   the impact of choosing a 'Wizard' source vs a 'Warlock' source.
 * - Refined styling to use `SOURCE_ACCENT` and `SOURCE_SIGIL_BG` per-class.
 *   Each source now has its own color signature (e.g., Emerald for Druid,
 *   Sky for Wizard) which permeates the button border and icon badge.
 * - Added `motion.button` wrapper for tactile feedback, using the
 *   established 'Amber Glow' for selection persistence.
 *
 * @file src/components/CharacterCreator/SpellSourceSelector.tsx
 */
import React from 'react';
import { MagicInitiateSource } from '../../types';
interface SpellSourceSelectorProps {
    /** Available spell sources to choose from */
    availableSources: MagicInitiateSource[];
    /** Currently selected source */
    selectedSource: MagicInitiateSource | undefined;
    /** Callback when a source is selected */
    onSourceSelect: (source: MagicInitiateSource) => void;
}
declare const SpellSourceSelector: React.FC<SpellSourceSelectorProps>;
export default SpellSourceSelector;
