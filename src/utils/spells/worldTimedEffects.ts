/** Advance only spell records tied to the existing game clock. This never
 * changes slots, Hit Dice, health, saved speed or physical position.
 *
 * One legacy bridge handles the exact generated Longstrider marker whose
 * original system cast event is retained. Its expiry comes from that event,
 * never from loading the save. Unknown/custom markers remain untouched. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 02/11/2026, 19:20:11
 * Dependents: state/reducers/worldReducer.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { calculateArmorClass } from '../character/statUtils';
import { isPreparedMageArmor } from './preparedMageArmor';
import type { GameState, PlayerCharacter } from '../../types';
import type { StatusEffect } from '../../types/effects';
import { LONGSTRIDER_DURATION_ROUNDS, LONGSTRIDER_SPEED_BONUS } from './outOfCombatCasting';

const ROUND_MS = 6000;

function dateMs(value: unknown): number {
    if (value instanceof Date) return value.getTime();
    return typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : NaN;
}

function retainedLongstrider(
    effect: StatusEffect, party: readonly PlayerCharacter[], messages: GameState['messages'], nowMs: number,
): StatusEffect {
    if (effect.worldTime || effect.type !== 'buff' || effect.name !== 'Longstrider' || effect.source !== 'Longstrider'
        || !effect.sourceCasterId || effect.id !== `ooc-longstrider-${effect.sourceCasterId}`
        || effect.effect.type !== 'condition' || effect.duration !== LONGSTRIDER_DURATION_ROUNDS
        || effect.description !== 'Longstrider, cast outside combat.') return effect;
    const caster = party.find(member => member.id === effect.sourceCasterId);
    if (!caster) return effect;
    let castAt = -Infinity;
    for (const message of messages ?? []) {
        if (message.sender !== 'system' || message.text !== `${caster.name} casts Longstrider.`) continue;
        const timestamp = dateMs(message.timestamp);
        if (Number.isFinite(timestamp) && timestamp <= nowMs) castAt = Math.max(castAt, timestamp);
    }
    if (!Number.isFinite(castAt)) return effect;
    return {
        ...effect,
        effect: { type: 'stat_modifier', stat: 'speed', value: LONGSTRIDER_SPEED_BONUS },
        worldTime: { appliedAtMs: castAt, expiresAtMs: castAt + LONGSTRIDER_DURATION_ROUNDS * ROUND_MS },
    };
}

export function advanceWorldTimedEffects(
    party: PlayerCharacter[], messages: GameState['messages'], gameTime: Date,
): PlayerCharacter[] {
    const nowMs = dateMs(gameTime);
    if (!Number.isFinite(nowMs)) return party;
    let changed = false;
    const advanced = party.map(character => {
        if (!character.statusEffects?.length) return character;
        let characterChanged = false;
        const effects: StatusEffect[] = [];
        for (const original of character.statusEffects) {
            let effect = retainedLongstrider(original, party, messages, nowMs);
            const clock = effect.worldTime;
            if (clock && Number.isFinite(clock.appliedAtMs) && Number.isFinite(clock.expiresAtMs)
                && clock.expiresAtMs >= clock.appliedAtMs && nowMs >= clock.appliedAtMs) {
                if (nowMs >= clock.expiresAtMs) {
                    characterChanged = true;
                    continue;
                }
                const remaining = Math.ceil((clock.expiresAtMs - nowMs) / ROUND_MS);
                if (remaining !== effect.duration) effect = { ...effect, duration: remaining };
            }
            characterChanged ||= effect !== original;
            effects.push(effect);
        }
        // Recalculate a retained paid defense as well as its expiry. This
        // derives old generated cast records from their original identity; it
        // neither grants a new cast nor renews the eight-hour clock on load.
        const updated = characterChanged ? { ...character, statusEffects: effects } : character;
        const hasArmorCast = character.statusEffects.some(isPreparedMageArmor);
        const armorClass = hasArmorCast ? calculateArmorClass(updated, updated.activeEffects) : updated.armorClass;
        if (!characterChanged && armorClass === character.armorClass) return character;
        changed = true;
        return armorClass === updated.armorClass ? updated : { ...updated, armorClass };
    });
    return changed ? advanced : party;
}
