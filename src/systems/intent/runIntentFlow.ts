/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/intent/runIntentFlow.ts
 *
 * Turns a read intent into what actually happens.
 *
 * Talk falls through to prose. An attempt rolls real dice against a real DC and
 * reports the number. Violence starts a fight. A bad enough failure in the wrong
 * scene starts one too.
 *
 * The flow does NOT send the conversation message itself. It returns a `note`
 * describing the mechanical outcome, and the caller attaches that note to the
 * player's line. The prose model then reads the note in the history and has the
 * NPCs answer the RESULT rather than the words — which is the whole point of
 * reading intent at all.
 *
 * Pure apart from the injected dice roll, combat launcher, and dispatch.
 */
import type React from 'react';
import type { AppAction } from '../../state/actionTypes';
import type { PlayerCharacter } from '../../types';
import type { SituationThreat } from '../gameEntry/types';
import type { PlayerIntent, SkillIntent } from './types';
import {
    computeSkillModifier,
    resolveCheck,
    getActiveCheckBoosts,
} from '../gameEntry/runDeEscalationCheck';
import { shouldEscalateToCombat } from './escalationRule';
import { sceneRosterToThreat, type SceneParticipant } from './sceneRosterToThreat';
import { startThreatCombat, type StartThreatCombatArgs } from './startThreatCombat';

/** A bonus die owed to the check by an active boost (Guidance's 1d4 etc.). */
export interface CheckDiceRequest {
    source: string;
    notation: string;
}

/** Everything the player physically rolled for one check. */
export interface CheckDiceResult {
    d20: number;
    bonuses: Array<{ source: string; value: number }>;
}

export type IntentOutcome =
    /** Ordinary speech. The caller sends it as prose, unchanged. */
    | 'talk'
    /** A check resolved and the scene continues. Attach `note` to the message. */
    | 'check'
    /** Combat started. The conversation is over; do not call the prose model. */
    | 'combat';

export interface IntentFlowResult {
    outcome: IntentOutcome;
    /** Mechanical line to show and to feed the prose model. Empty for `talk`. */
    note: string;
    /** Present when a check resolved. */
    success?: boolean;
}

export interface IntentFlowArgs {
    intent: PlayerIntent;
    character: PlayerCharacter;
    dispatch: React.Dispatch<AppAction>;
    /**
     * Rolls the whole check: the d20 (best of two on advantage) plus any active
     * bonus dice, as ONE dice-tray sequence.
     */
    rollCheckDice: (advantage: boolean, bonusDice: CheckDiceRequest[]) => Promise<CheckDiceResult>;
    /** The scene's authored threat, when it has one. */
    threat?: SituationThreat | null;
    /** Everyone present, used to build a roster when a peaceful scene turns. */
    participants: readonly SceneParticipant[];
    /** Short cue on what is at stake, used as the tension of a built threat. */
    tension: string;
    /**
     * Where a built threat is fought. Stamped by the caller from live game
     * state. An authored threat already carries its own; this covers the case
     * where a peaceful scene turns and the game must name the ground itself.
     */
    battlefieldSource?: SituationThreat['battlefieldSource'];
    /** Injectable for tests; forwarded to the shared combat launcher. */
    startEncounter?: StartThreatCombatArgs['startEncounter'];
    /** Injectable for tests; forwarded to the shared combat launcher. */
    prepareOpeningEncounter?: StartThreatCombatArgs['prepareOpeningEncounter'];
    /** Mounts the GroundWorld when none is live, so the fight gets real ground. */
    ensureGroundMounted?: StartThreatCombatArgs['ensureGroundMounted'];
}

/** Human-readable check line: "Performance check: 14 + 5 = 19 vs DC 13 — success." */
function formatCheckNote(args: {
    skill: string;
    d20: number;
    modifier: number;
    bonuses: CheckDiceResult['bonuses'];
    dc: number;
    success: boolean;
}): string {
    const bonusText = args.bonuses.map((b) => ` + ${b.value} (${b.source})`).join('');
    const bonusTotal = args.bonuses.reduce((sum, b) => sum + b.value, 0);
    const total = args.d20 + args.modifier + bonusTotal;
    const sign = args.modifier < 0 ? '−' : '+';
    return (
        `${args.skill} check: ${args.d20} ${sign} ${Math.abs(args.modifier)}${bonusText} = ${total} ` +
        `vs DC ${args.dc} — ${args.success ? 'success' : 'failure'}.`
    );
}

export async function runIntentFlow(args: IntentFlowArgs): Promise<IntentFlowResult> {
    const { intent, character, dispatch, rollCheckDice, participants, tension } = args;
    const launchCombat = (threat: SituationThreat) =>
        startThreatCombat({
            threat,
            dispatch,
            startEncounter: args.startEncounter,
            prepareOpeningEncounter: args.prepareOpeningEncounter,
            ensureGroundMounted: args.ensureGroundMounted,
        });
    const authoredThreat = args.threat ?? null;
    const sceneHostile = !!authoredThreat;

    // A resolved standoff must clear its threat. Leaving it in place let the
    // conversation re-trigger the SAME fight after the battle ended (verified
    // live — an infinite XP loop).
    const clearThreat = () => {
        if (sceneHostile) dispatch({ type: 'SKIP_OPENING_SITUATION' });
    };

    if (intent.kind === 'talk') {
        return { outcome: 'talk', note: '' };
    }

    // Violence. A hostile scene fights its authored roster; a peaceful one gets
    // a roster built from the people standing there.
    if (intent.kind === 'attack' || intent.kind === 'ambiguous') {
        const threat = authoredThreat
            ?? sceneRosterToThreat(participants, tension, args.battlefieldSource);
        if (!threat) {
            throw new Error('There is nobody here to fight.');
        }
        await launchCombat(threat);
        clearThreat();
        return { outcome: 'combat', note: '' };
    }

    const skillIntent: SkillIntent = intent;

    // A hostile scene keeps its AUTHORED difficulty. The model's proposal is only
    // consulted where the game has no number of its own.
    const dc = authoredThreat ? authoredThreat.deEscalationDC : skillIntent.dc;

    const boosts = getActiveCheckBoosts(character, skillIntent.skill);
    const advantage = boosts.some((b) => b.advantage);
    const modifier = computeSkillModifier(character, skillIntent.ability, skillIntent.skill);
    const bonusRequests: CheckDiceRequest[] = boosts
        .filter((b) => !!b.bonusDice)
        .map((b) => ({ source: b.source, notation: b.bonusDice as string }));

    const rolled = await rollCheckDice(advantage, bonusRequests);
    const bonusTotal = rolled.bonuses.reduce((sum, b) => sum + b.value, 0);
    const { success, total } = resolveCheck({
        d20: rolled.d20,
        modifier: modifier + bonusTotal,
        dc,
    });

    const note = formatCheckNote({
        skill: skillIntent.skill,
        d20: rolled.d20,
        modifier,
        bonuses: rolled.bonuses,
        dc,
        success,
    });

    if (success) {
        // Talking a standoff down ends it for good.
        clearThreat();
        return { outcome: 'check', note, success: true };
    }

    const escalation = shouldEscalateToCombat({
        sceneHostile,
        skill: skillIntent.skill,
        stakes: skillIntent.stakes,
        margin: total - dc,
    });

    if (!escalation.escalates) {
        return { outcome: 'check', note, success: false };
    }

    const threat = authoredThreat
        ?? sceneRosterToThreat(participants, escalation.reason, args.battlefieldSource);
    if (!threat) {
        // Nobody present to turn on. The failure stands as a failure.
        return { outcome: 'check', note, success: false };
    }

    await launchCombat(threat);
    clearThreat();
    return { outcome: 'combat', note: `${note} ${escalation.reason}`, success: false };
}
