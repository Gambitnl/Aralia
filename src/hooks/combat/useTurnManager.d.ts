/**
 * ARCHITECTURAL ADVISORY:
 * SHARED UTILITY: Multiple systems rely on these exports.
 *
 * Last Sync: 23/07/2026, 21:41:39
 * Dependents: components/BattleMap/BattleMap.tsx, components/BattleMap/BattleMap3D.tsx, components/BattleMap/BattleMapDemo.tsx, components/Combat/CombatView.tsx, components/DesignPreview/steps/PreviewCombatScenarios.tsx, hooks/useBattleMap.ts
 * Imports: 13 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { CombatCharacter, CombatLogEntry, BattleMapData, LightSource, Ability } from '../../types/combat';
import { AI_THINKING_DELAY_MS } from '../../config/combatConfig';
interface UseTurnManagerProps {
    difficulty?: keyof typeof AI_THINKING_DELAY_MS;
    characters: CombatCharacter[];
    mapData: BattleMapData | null;
    onCharacterUpdate: (character: CombatCharacter) => void;
    onLogEntry: (entry: CombatLogEntry) => void;
    onRoundElapsed?: (seconds: number) => void;
    onCharacterRemove?: (characterId: string) => void;
    autoCharacters?: Set<string>;
    onMapUpdate?: (mapData: BattleMapData) => void;
    /** Optional deterministic full initiative total for visual/replay harnesses. */
    initiativeRoller?: (character: CombatCharacter) => number;
    requestReaction?: (attackerId: string, targetId: string, triggerType: 'on_hit' | 'on_cast' | 'on_move' | 'on_take_damage' | 'opportunity_attack', reactionSpells?: Array<import('../../types/spells').Spell | Ability>, reactionWeapons?: import('../../types/combat').Ability[]) => Promise<string | null>;
    executeReactionSpell?: (attacker: CombatCharacter, target: CombatCharacter, spellAbility: Ability) => Promise<void> | void;
}
export declare const advanceTurnEndConditionExpiry: (character: CombatCharacter) => {
    character: CombatCharacter;
    expiredNames: string[];
};
export declare const useTurnManager: ({ characters, mapData, onCharacterUpdate, onLogEntry, onRoundElapsed, onCharacterRemove, autoCharacters, onMapUpdate, initiativeRoller, difficulty, requestReaction, executeReactionSpell }: UseTurnManagerProps) => {
    turnState: import("../../types/combat").TurnState;
    initializeCombat: (initialCharacters: CombatCharacter[]) => void;
    joinCombat: (character: CombatCharacter, options?: {
        initiative?: number;
    }) => void;
    executeAction: (action: import("../../types/combat").CombatAction) => Promise<boolean>;
    endTurn: () => Promise<void>;
    skipToCharacter: (characterId: string) => void;
    getCurrentCharacter: () => CombatCharacter;
    isCharacterTurn: (characterId: string) => boolean;
    canAffordAction: (character: CombatCharacter | undefined, cost: import("../../types/combat").AbilityCost) => boolean;
    addDamageNumber: (value: number, position: import("../../types").Position, type: import("../../types/combat").DamageNumber["type"]) => void;
    damageNumbers: import("../../types/combat").DamageNumber[];
    animations: import("../../types/combat").Animation[];
    addSpellZone: (zone: import("../../systems/spells/effects").ActiveSpellZone) => void;
    addMovementDebuff: (debuff: import("../../systems/spells/effects").MovementTriggerDebuff) => void;
    removeSpellZone: (zoneId: string) => void;
    setSpellZones: import("react").Dispatch<import("react").SetStateAction<import("../../systems/spells/effects").ActiveSpellZone[]>>;
    addReactiveTrigger: (trigger: import("../../types/combat").ReactiveTrigger) => void;
    setReactiveTriggers: import("react").Dispatch<import("react").SetStateAction<import("../../types/combat").ReactiveTrigger[]>>;
    spellZones: import("../../systems/spells/effects").ActiveSpellZone[];
    scheduledSpellEffects: import("../../systems/spells/effects").ScheduledSpellEffect[];
    movementDebuffs: import("../../systems/spells/effects").MovementTriggerDebuff[];
    reactiveTriggers: import("../../types/combat").ReactiveTrigger[];
    addScheduledSpellEffect: (scheduledEffect: import("../../systems/spells/effects").ScheduledSpellEffect) => void;
    removeScheduledSpellEffect: (scheduledEffectId: string) => void;
    activeLightSources: LightSource[];
    setActiveLightSources: import("react").Dispatch<import("react").SetStateAction<LightSource[]>>;
    spellMovementVisuals: import("../../types/combat").SpellMovementVisual[];
    addSpellMovementVisual: (visual: Omit<import("../../types/combat").SpellMovementVisual, "id" | "createdAt">) => void;
    spellDeliveryVisuals: import("../../types/combat").SpellDeliveryVisual[];
    addSpellDeliveryVisual: (visual: Omit<import("../../types/combat").SpellDeliveryVisual, "id" | "createdAt">) => void;
};
export {};
