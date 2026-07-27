import React from 'react';
import { Spell, CastingTime, Range } from '../../types';
export type SpellSummaryCardDensity = 'card' | 'row';
interface SpellSummaryCardProps {
    spell: Spell;
    selected?: boolean;
    disabled?: boolean;
    density?: SpellSummaryCardDensity;
    inputId?: string;
    showCheckbox?: boolean;
    onToggle?: () => void;
    onSelect?: () => void;
    leadingIcon?: React.ReactNode;
    trailing?: React.ReactNode;
    statusBadges?: React.ReactNode;
    className?: string;
}
export declare const formatSpellCastingTime: (ct: CastingTime) => string;
export declare const formatSpellRange: (range: Range) => string;
export declare const getSpellEffectSummary: (spell: Spell) => {
    label: string;
    text: string;
    color: string;
} | null;
/**
 * SpellSummaryCard is the shared spell list/selection surface for Character Creator
 * and Character Sheet spell lists. Variants preserve each host flow's behavior while
 * keeping names, school tags, components, timing, range, and effect summaries aligned.
 */
export declare const SpellSummaryCard: React.FC<SpellSummaryCardProps>;
export {};
