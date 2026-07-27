/**
 * ARCHITECTURAL CONTEXT:
 * This component is an artisanal spell selection tool used exclusively
 * within the 'Feat Selection' workflow. It handles multi-spell requirements
 * with granular filtering (school, name) and rich visual feedback.
 *
 * Recent updates focus on 'UI Polish' and 'Selection Ergonomics'.
 * - Refined selection behavior to use a 'FIFO' (First-In, First-Out)
 *   replacement model when the maximum spell count is reached. This
 *   allows for quick selection adjustments without requiring manual
 *   de-selection of previous choices.
 * - Standardized control styling (search input, school filter) to use
 *   subtle transparency (`bg-gray-900/60`) and consistent sky-themed
 *   focus states, aligning with the premium 'Aralia' design language.
 * - Integrated `AnimatePresence` with `popLayout` to ensure that
 *   filtering and expansion transitions feel smooth and non-jarring.
 *
 * @file src/components/CharacterCreator/FeatSpellPicker.tsx
 */
import React from 'react';
import { FeatSpellRequirement } from '../../types';
interface FeatSpellPickerProps {
    /** The spell requirement configuration */
    requirement: FeatSpellRequirement;
    /** Currently selected spell IDs */
    selectedSpellIds: string[];
    /** Callback when selection changes */
    onSelectionChange: (spellIds: string[]) => void;
    /** Optional class source for Magic Initiate filtering */
    selectedSpellSource?: string;
    /** Whether the picker is disabled */
    disabled?: boolean;
    /**
     * Spell ids the character already knows from other sources (class picks,
     * racial grants). These are filtered out so a feat slot can't be wasted on
     * a duplicate the assembler would silently dedupe (GAPS.md G12).
     */
    knownSpellIds?: string[];
}
declare const FeatSpellPicker: React.FC<FeatSpellPickerProps>;
export default FeatSpellPicker;
