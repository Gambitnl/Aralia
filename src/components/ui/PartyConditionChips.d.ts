/**
 * @file PartyConditionChips.tsx
 * PRV6: visible surface for party status conditions ('starving', 'fatigued',
 * 'poisoned' — applied party-wide by the travel-provisioning gate via
 * SET_PARTY_CONDITION, cleared via CLEAR_PARTY_CONDITION). Before this, the
 * conditions lived on each PlayerCharacter.conditions but rendered nowhere.
 *
 * Shared by the PLAYING left-column status strip (GameLayout) and the party
 * roster cards (PartyMemberCard). Plain-language copy: each chip's title says
 * what the condition means AND how to recover from it.
 */
import React from 'react';
export interface ConditionInfo {
    /** Player-facing name. */
    label: string;
    /** Small leading glyph. */
    icon: string;
    /** Tailwind classes for the chip (bg + border + text). */
    chipClass: string;
    /** Plain-language: what it means + how to recover. Used as the chip title. */
    description: string;
    /**
     * Glossary entry id, when this condition is also a canonical rules term.
     * Set it and the chip links to the live glossary entry (hover excerpt +
     * click-through) instead of relying on the hardcoded `description`, so the
     * copy can never drift out of sync with the rulebook. Homebrew travel
     * conditions (starving, fatigued) have no entry and stay plain chips.
     */
    glossaryTermId?: string;
}
/** Copy + styling for every condition the travel gate can apply. */
export declare const CONDITION_INFO: Record<string, ConditionInfo>;
interface ConditionChipsProps {
    /** Active condition ids (deduped by the caller or not — deduped here too). */
    conditions: string[];
    /** Compact chips for dense card layouts. */
    size?: 'sm' | 'md';
    /**
     * Opens the full glossary entry for a linked condition. When omitted, a
     * linked chip still shows the live glossary excerpt on hover but does not
     * navigate on click.
     */
    onNavigateToGlossary?: (termId: string) => void;
}
/**
 * A row of labeled status chips, one per active condition. Renders nothing
 * when the list is empty so callers can include it unconditionally.
 */
export declare const ConditionChips: React.FC<ConditionChipsProps>;
export default ConditionChips;
