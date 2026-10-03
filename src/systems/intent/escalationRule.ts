/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intent/escalationRule.ts
 *
 * Decides when a failed check turns a scene violent.
 *
 * Combat used to need a flag: only a scene the generator marked hostile could
 * ever produce a fight. A peaceful scene was safe forever, whatever the player
 * did in it. This rule replaces the flag with a consequence.
 *
 * Two ways a scene turns:
 *  - The player commits violence. That is not this module's job; an `attack`
 *    intent starts combat directly.
 *  - The player fails a serious, provocative attempt badly. That is this rule.
 *
 * Pure and deterministic so the threshold is pinned by test, not by feel.
 */
import type { IntentStakes } from './types';

/**
 * Skills whose failure is witnessed and resented. Failing Persuasion is
 * embarrassing; failing Intimidation names you a threat, and failing Sleight of
 * Hand names you a thief. Only these can flip a peaceful scene.
 */
export const PROVOCATIVE_SKILLS: readonly string[] = [
    'Intimidation',
    'Deception',
    'Sleight of Hand',
    'Stealth',
];

/**
 * How far below the DC counts as a hard failure. Missing by 1 is a near miss and
 * must stay recoverable; missing by 5 or more is a scene the player has lost.
 */
export const HARD_FAILURE_MARGIN = -5;

export interface EscalationDecision {
    escalates: boolean;
    /** Player-facing cause, written into the narrator line. */
    reason: string;
}

export interface EscalationArgs {
    /** True when the scene already carries an authored threat. */
    sceneHostile: boolean;
    skill: string;
    stakes: IntentStakes;
    /** Check total minus DC. Negative means the check failed. */
    margin: number;
}

/**
 * Judge one failed check.
 *
 * A hostile scene keeps its original rule: any failed de-escalation drops
 * straight into the fight that was already coming. A peaceful scene needs all
 * three conditions — serious stakes, a provocative skill, and a hard miss.
 */
export function shouldEscalateToCombat(args: EscalationArgs): EscalationDecision {
    const { sceneHostile, skill, stakes, margin } = args;

    if (margin >= 0) {
        return { escalates: false, reason: '' };
    }

    if (sceneHostile) {
        return { escalates: true, reason: 'The standoff breaks.' };
    }

    const provocative = PROVOCATIVE_SKILLS.some(
        (s) => s.toLowerCase() === skill.trim().toLowerCase(),
    );
    if (stakes === 'serious' && provocative && margin <= HARD_FAILURE_MARGIN) {
        return { escalates: true, reason: `The ${skill} attempt fails badly, and the mood turns.` };
    }

    return { escalates: false, reason: '' };
}
