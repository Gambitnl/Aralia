/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 18:57:09
 * Dependents: hooks/combat/useTurnManager.ts
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
import { DamageNumber, Animation, Position, SpellDeliveryVisual, SpellMovementVisual } from '../../types/combat';
/**
 * Hook to manage visual feedback in combat (damage numbers, animations).
 * Separates visual state from core turn logic.
 */
export declare const useCombatVisuals: () => {
    damageNumbers: DamageNumber[];
    animations: Animation[];
    addDamageNumber: (value: number, position: Position, type: DamageNumber["type"]) => void;
    queueAnimation: (animation: Animation) => void;
    spellMovementVisuals: SpellMovementVisual[];
    addSpellMovementVisual: (visual: Omit<SpellMovementVisual, "id" | "createdAt">) => void;
    spellDeliveryVisuals: SpellDeliveryVisual[];
    addSpellDeliveryVisual: (visual: Omit<SpellDeliveryVisual, "id" | "createdAt">) => void;
};
