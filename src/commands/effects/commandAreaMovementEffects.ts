// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/06/2026, 23:03:21
 * Dependents: commands/effects/MovementCommand.ts, commands/effects/UtilityCommand.ts
 * Imports: 4 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { CombatState, Position, StatusEffect } from '@/types/combat'
import { rollDice } from '../../utils/combatUtils'
import { generateId } from '../../utils/idGenerator'
import { ActiveSpellZone, processAreaMoveWithinTriggers } from '../../systems/spells/effects/triggerHandler'

type SpellZoneWithTracking = NonNullable<CombatState['spellZones']>[number] &
    Partial<Pick<ActiveSpellZone, 'triggeredThisTurn' | 'triggeredEver' | 'expiresAtRound' | 'saveDC'>>

/**
 * Applies area-trigger effects after a command moves a creature through spell zones.
 *
 * Normal voluntary movement runs through useActionExecutor and AreaEffectTracker.
 * Some spell commands update CombatState directly, so this helper gives those
 * command-side moves the same Spike Growth-style damage, healing, and status
 * behavior without inventing a second area-trigger system.
 */
export function applyCommandAreaMovementEffects(
    state: CombatState,
    characterId: string,
    previousPosition: Position,
    newPosition: Position,
    movementPath: Position[]
): CombatState {
    if (!state.spellZones || state.spellZones.length === 0 || movementPath.length < 2) {
        return state
    }

    const character = state.characters.find(candidate => candidate.id === characterId)
    if (!character) {
        return state
    }

    // CombatState carries a compact zone shape for command execution, while the
    // shared trigger helper expects runtime tracking sets. Preserve existing
    // sets when live state provides them; otherwise create temporary sets so one
    // command can still evaluate frequency gates.
    const zones: ActiveSpellZone[] = state.spellZones.map(zone => {
        const trackedZone = zone as SpellZoneWithTracking
        return {
            ...trackedZone,
            triggeredThisTurn: trackedZone.triggeredThisTurn ?? new Set<string>(),
            triggeredEver: trackedZone.triggeredEver ?? new Set<string>()
        }
    })
    const triggerResults = processAreaMoveWithinTriggers(zones, character, newPosition, previousPosition, movementPath)

    let nextState = state
    let currentCharacter = character

    for (const result of triggerResults) {
        for (const effect of result.effects) {
            if (effect.type === 'damage') {
                const damage = effect.dice ? rollDice(effect.dice) : effect.value ?? 0
                if (damage <= 0) {
                    continue
                }

                const nextHP = Math.max(0, currentCharacter.currentHP - damage)
                currentCharacter = { ...currentCharacter, currentHP: nextHP }
                nextState = updateCharacter(nextState, characterId, { currentHP: nextHP })
                nextState = addLogEntry(nextState, {
                    type: 'damage',
                    message: `${character.name} takes ${damage} ${effect.damageType ?? 'damage'} damage from zone effect!`,
                    characterId,
                    data: {
                        damage,
                        damageType: effect.damageType,
                        trigger: result.triggerType ?? 'on_move_in_area'
                    }
                })
                continue
            }

            if (effect.type === 'heal') {
                const healing = effect.dice ? rollDice(effect.dice) : effect.value ?? 0
                if (healing <= 0) {
                    continue
                }

                const nextHP = Math.min(currentCharacter.maxHP, currentCharacter.currentHP + healing)
                const actualHealing = nextHP - currentCharacter.currentHP
                if (actualHealing <= 0) {
                    continue
                }

                currentCharacter = { ...currentCharacter, currentHP: nextHP }
                nextState = updateCharacter(nextState, characterId, { currentHP: nextHP })
                nextState = addLogEntry(nextState, {
                    type: 'heal',
                    message: `${character.name} heals ${actualHealing} HP from zone effect!`,
                    characterId,
                    data: {
                        healing: actualHealing,
                        trigger: result.triggerType ?? 'on_move_in_area'
                    }
                })
                continue
            }

            if (effect.type === 'status_condition' && effect.statusName) {
                const existingStatusEffects = currentCharacter.statusEffects ?? []
                if (existingStatusEffects.some(status => status.name === effect.statusName && status.source === 'zone effect')) {
                    continue
                }

                const statusEffect: StatusEffect = {
                    id: `zone-${effect.statusName}-${characterId}-${newPosition.x}-${newPosition.y}`,
                    name: effect.statusName,
                    type: 'debuff',
                    duration: effect.duration ?? { type: 'rounds', value: 1 },
                    description: `${effect.statusName} from zone effect`,
                    source: 'zone effect',
                    effect: { type: 'condition' },
                    repeatSave: effect.repeatSave,
                    escapeCheck: effect.escapeCheck,
                    breakTriggers: effect.breakTriggers
                }
                const nextStatusEffects = [...existingStatusEffects, statusEffect]

                currentCharacter = { ...currentCharacter, statusEffects: nextStatusEffects }
                nextState = updateCharacter(nextState, characterId, { statusEffects: nextStatusEffects })
                nextState = addLogEntry(nextState, {
                    type: 'status',
                    message: `${character.name} gains ${effect.statusName} from zone effect!`,
                    characterId,
                    data: {
                        status: effect.statusName,
                        trigger: result.triggerType ?? 'on_move_in_area'
                    }
                })
            }
        }
    }

    return nextState
}

function updateCharacter(
    state: CombatState,
    characterId: string,
    updates: Partial<CombatState['characters'][number]>
): CombatState {
    return {
        ...state,
        characters: state.characters.map(character =>
            character.id === characterId ? { ...character, ...updates } : character
        )
    }
}

function addLogEntry(
    state: CombatState,
    entry: Omit<CombatState['combatLog'][number], 'id' | 'timestamp'>
): CombatState {
    return {
        ...state,
        combatLog: [
            ...state.combatLog,
            {
                ...entry,
                id: generateId(),
                timestamp: Date.now()
            }
        ]
    }
}
