/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 23/07/2026, 20:44:08
 * Dependents: hooks/combat/useTurnManager.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
/**
 * @file hooks/combat/useActionExecutor.ts
 * Encapsulates the logic for executing combat actions.
 * Decouples the "How" of action execution from the "When" of turn management.
 */
import { type Dispatch, type SetStateAction } from 'react';
import { CombatCharacter, CombatAction, CombatLogEntry, BattleMapData, TurnState, DamageNumber, Animation, AbilityCost, ReactiveTrigger, Ability } from '../../types/combat';
import { Spell } from '../../types/spells';
import { ActiveSpellZone, MovementTriggerDebuff } from '../../systems/spells/effects';
export interface UseActionExecutorProps {
    characters: CombatCharacter[];
    turnState: TurnState;
    mapData: BattleMapData | null;
    onCharacterUpdate: (character: CombatCharacter) => void;
    onCharacterRemove?: (characterId: string) => void;
    onLogEntry: (entry: CombatLogEntry) => void;
    endTurn: () => void | Promise<void>;
    canAfford: (c: CombatCharacter, cost: AbilityCost) => boolean;
    consumeAction: (c: CombatCharacter, cost: AbilityCost) => CombatCharacter;
    recordAction: (action: CombatAction) => void;
    addDamageNumber: (val: number, pos: {
        x: number;
        y: number;
    }, type: DamageNumber['type']) => void;
    queueAnimation: (anim: Animation) => void;
    handleDamage: (c: CombatCharacter, amt: number, src: string, type?: string) => CombatCharacter;
    processRepeatSaves: (c: CombatCharacter, timing: 'turn_end' | 'turn_start' | 'on_damage' | 'on_action', effectId?: string) => CombatCharacter;
    processTileEffects: (c: CombatCharacter, pos: {
        x: number;
        y: number;
    }) => CombatCharacter;
    spellZones: ActiveSpellZone[];
    setSpellZones?: Dispatch<SetStateAction<ActiveSpellZone[]>>;
    movementDebuffs: MovementTriggerDebuff[];
    reactiveTriggers: ReactiveTrigger[];
    setMovementDebuffs: React.Dispatch<React.SetStateAction<MovementTriggerDebuff[]>>;
    requestReaction?: (attackerId: string, targetId: string, triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack', reactionSpells?: Array<Spell | Ability>, reactionWeapons?: Ability[]) => Promise<string | null>;
    executeReactionSpell?: (attacker: CombatCharacter, target: CombatCharacter, spellAbility: Ability) => Promise<void> | void;
}
interface ImmediateAbilityEffectResult {
    character: CombatCharacter;
    followUpLogs: CombatLogEntry[];
}
export declare const applyImmediateAbilityTurnEffects: (character: CombatCharacter, ability: Ability, currentTurn: number) => ImmediateAbilityEffectResult;
export declare const useActionExecutor: ({ characters, turnState, mapData, onCharacterUpdate, onCharacterRemove, onLogEntry, endTurn, canAfford, consumeAction, recordAction, addDamageNumber, queueAnimation, handleDamage, processRepeatSaves, processTileEffects, spellZones, setSpellZones, movementDebuffs, reactiveTriggers, setMovementDebuffs, requestReaction, executeReactionSpell }: UseActionExecutorProps) => {
    executeAction: (action: CombatAction) => Promise<boolean>;
};
export {};
