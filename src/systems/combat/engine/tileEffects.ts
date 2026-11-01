/**
 * @file systems/combat/engine/tileEffects.ts
 * Applies the effects of the map tile a character stands on.
 *
 * C2 (agora-9ed9.2): moved out of hooks/combat/engine/useCombatEngine.ts so the
 * rules can be read and tested without React. Bodies are unchanged; values the
 * hook used to close over now arrive through a context object under the same
 * names. The hook keeps a useCallback wrapper with the original dependency list,
 * so callback identity and phase ownership do not change.
 *
 * Called by: hooks/combat/engine/useCombatEngine.ts
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 24/10/2026, 22:14:42
 * Dependents: hooks/combat/engine/useCombatEngine.ts
 * Imports: 5 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatCharacter, Position } from '../../../types/combat';
import { generateId } from '../../../utils/combat';
import { applyRuntimeStatusCondition } from '../../../utils/combat/statusConditionUtils';
import { getStatusDiscriminator } from '../../../types/combatMessages';
import type { TileEffectContext } from './engineContextTypes';

export function resolveTileEffects(
    ctx: TileEffectContext,
    character: CombatCharacter,
    tilePos: Position,
): CombatCharacter {
    const { mapData, handleDamage, onLogEntry } = ctx;
    if (!mapData) return character;

    const tileKey = `${tilePos.x}-${tilePos.y}`;
    const tile = mapData.tiles.get(tileKey);
    const envEffect = tile ? tile.environmentalEffect : null;
    if (!tile || !envEffect) return character;

    let updatedChar = { ...character };
    const env = envEffect;
    const innerEffect = env.effect.effect;

    if (innerEffect?.type === 'damage_per_turn') {
        const damage = innerEffect.value || 0;
        if (damage > 0) {
            updatedChar = handleDamage(updatedChar, damage, env.effect.name, env.type === 'fire' ? 'fire' : 'bludgeoning');
        } else {
            onLogEntry({
                id: generateId(),
                timestamp: Date.now(),
                type: 'status',
                message: `${character.name} enters ${env.effect.name}.`,
                characterId: character.id
            });
        }
    } else if (innerEffect?.type === 'condition') {
        // Environmental conditions share the spell status refresh policy so
        // stepping through the same hazardous tile updates both mirrors
        // instead of leaving stale duplicate condition records behind.
        updatedChar = applyRuntimeStatusCondition(
            updatedChar,
            {
                ...env.effect,
                id: generateId(),
                duration: 1,
                source: env.effect.source || env.effect.name
            },
            {
                name: env.effect.name,
                duration: { type: 'rounds', value: 1 },
                appliedTurn: 0,
                source: env.effect.source || env.effect.name
            }
        ).character;
        onLogEntry({
            id: generateId(),
            timestamp: Date.now(),
            type: 'status',
            message: `${character.name} is affected by ${env.effect.name}.`,
            characterId: character.id,
            // agora-db71.10: the emitter knows which status it just applied, so it says so.
            // The adapter's live lookup can only classify a record whose named effect is still
            // on the character when the record is converted; a stamp survives that.
            eventClass: getStatusDiscriminator(env.effect.type)?.eventClass
        });
    }

    return updatedChar;
}
