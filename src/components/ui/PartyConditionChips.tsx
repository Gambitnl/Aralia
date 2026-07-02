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
}

/** Copy + styling for every condition the travel gate can apply. */
export const CONDITION_INFO: Record<string, ConditionInfo> = {
    starving: {
        label: 'Starving',
        icon: '🍖',
        chipClass: 'bg-red-950/80 border-red-500/50 text-red-200',
        description:
            'The party ran out of food on the road. Starvation wears everyone down and sours companions. Recover by eating properly again — stock up on rations and water.',
    },
    fatigued: {
        label: 'Fatigued',
        icon: '😮‍💨',
        chipClass: 'bg-amber-950/80 border-amber-500/50 text-amber-200',
        description:
            'Worn down from marching on half rations. Recovers with proper food and a good rest.',
    },
    poisoned: {
        label: 'Poisoned',
        icon: '🤢',
        chipClass: 'bg-green-950/80 border-green-500/50 text-green-200',
        description:
            'Something tainted was eaten or drunk — foraged food is not always safe. Weakens the party until it is cured or rested off.',
    },
};

/** Fallback for a condition id with no registered copy: still show it honestly. */
const fallbackInfo = (condition: string): ConditionInfo => ({
    label: condition.charAt(0).toUpperCase() + condition.slice(1),
    icon: '⚠️',
    chipClass: 'bg-gray-800 border-gray-500/50 text-gray-200',
    description: `The party is affected by: ${condition}.`,
});

interface ConditionChipsProps {
    /** Active condition ids (deduped by the caller or not — deduped here too). */
    conditions: string[];
    /** Compact chips for dense card layouts. */
    size?: 'sm' | 'md';
}

/**
 * A row of labeled status chips, one per active condition. Renders nothing
 * when the list is empty so callers can include it unconditionally.
 */
export const ConditionChips: React.FC<ConditionChipsProps> = ({ conditions, size = 'md' }) => {
    const unique = Array.from(new Set(conditions));
    if (unique.length === 0) return null;
    const sizing = size === 'sm' ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-xs';
    return (
        <div className="flex flex-wrap gap-1.5" data-testid="condition-chips" aria-label="Active party conditions">
            {unique.map((condition) => {
                const info = CONDITION_INFO[condition] ?? fallbackInfo(condition);
                return (
                    <span
                        key={condition}
                        title={info.description}
                        className={`inline-flex cursor-help items-center gap-1 rounded-full border font-semibold ${sizing} ${info.chipClass}`}
                    >
                        <span aria-hidden="true">{info.icon}</span>
                        <span>{info.label}</span>
                    </span>
                );
            })}
        </div>
    );
};

export default ConditionChips;
