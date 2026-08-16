/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intent/types.ts
 *
 * Contract for the universal player-intent reader.
 *
 * Every free-text line a player sends to a conversation passes through this
 * system. The reader decides what the line MEANS in game terms: pure talk, a
 * skill attempt with a real chance of failure, an attack, or an escape.
 *
 * Before this system existed, only a hostile opening scene read player intent.
 * Every other conversation in the game answered free text with prose alone, so
 * nothing the player typed could succeed, fail, or start a fight.
 *
 * NO FALLBACK (docs/projects/worldforge/DECISIONS.md D-NOFB): the reader is a
 * model call. A transport or parse failure throws; the caller surfaces an
 * honest retry. There is no canned classifier behind it.
 */
import type { AbilityScoreName } from '../../types';

/**
 * How much the attempt costs the player if it goes wrong. The model proposes
 * the stakes; the game uses them to clamp the difficulty and to decide whether
 * a failure can turn a peaceful scene violent.
 */
export type IntentStakes = 'trivial' | 'moderate' | 'serious';

/** One skill the character could bring to bear, with its live modifier. */
export interface IntentSkillInfo {
    name: string;
    ability: AbilityScoreName;
    proficient: boolean;
    modifier: number;
}

/**
 * A line that carries no mechanical weight. Greetings, questions, and ordinary
 * roleplay land here and flow to the normal conversation path untouched.
 */
export interface TalkIntent {
    kind: 'talk';
}

/** The player commits violence. This starts combat. */
export interface AttackIntent {
    kind: 'attack';
}

/**
 * The player attempts something concrete that can fail. `flee` is the same
 * shape: an attempt to leave the scene entirely.
 */
export interface SkillIntent {
    kind: 'skill' | 'flee';
    skill: string;
    ability: AbilityScoreName;
    /** Difficulty AFTER the game clamped the model's proposal. */
    dc: number;
    stakes: IntentStakes;
    rationale: string;
}

/** Two or more skills fit the line. The player picks. */
export interface AmbiguousIntent {
    kind: 'ambiguous';
    candidateSkills: string[];
}

export type PlayerIntent = TalkIntent | AttackIntent | SkillIntent | AmbiguousIntent;

/**
 * What the reader knows about the scene it is judging. The same shape serves an
 * opening standoff, a shopkeeper's counter, and a campfire with a companion.
 */
export interface IntentScene {
    /** Short cue on what is at stake right now. A hostile scene passes its tension. */
    tension: string;
    /** True when violence is already the next beat, e.g. an authored threat. */
    hostile: boolean;
    /** Names of the people present, so the model can read "I shove Gorin". */
    participants: string[];
}
