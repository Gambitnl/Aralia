// @dependencies-start
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
// @dependencies-end

import { useState, useCallback } from 'react';
import { DamageNumber, Animation, Position, SpellDeliveryVisual, SpellMovementVisual } from '../../types/combat';
import { createDamageNumber } from '../../utils/combatUtils';

/**
 * Hook to manage visual feedback in combat (damage numbers, animations).
 * Separates visual state from core turn logic.
 */
export const useCombatVisuals = () => {
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [animations, setAnimations] = useState<Animation[]>([]);
  const [spellMovementVisuals, setSpellMovementVisuals] = useState<SpellMovementVisual[]>([]);
  const [spellDeliveryVisuals, setSpellDeliveryVisuals] = useState<SpellDeliveryVisual[]>([]);

  const addDamageNumber = useCallback((value: number, position: Position, type: DamageNumber['type']) => {
    const newDn: DamageNumber = createDamageNumber(value, position, type);
    setDamageNumbers(prev => [...prev, newDn]);
    setTimeout(() => {
      setDamageNumbers(prev => prev.filter(dn => dn.id !== newDn.id));
    }, newDn.duration);
  }, []);

  const queueAnimation = useCallback((animation: Animation) => {
    setAnimations(prev => [...prev, animation]);
    setTimeout(() => {
      setAnimations(prev => prev.filter(anim => anim.id !== animation.id));
    }, animation.duration);
  }, []);

  const addSpellMovementVisual = useCallback((visual: Omit<SpellMovementVisual, 'id' | 'createdAt'>) => {
    const newVisual: SpellMovementVisual = {
      ...visual,
      id: `spell-move-${visual.spellId}-${Date.now()}`,
      createdAt: Date.now()
    };
    setSpellMovementVisuals(prev => [...prev, newVisual]);
    setTimeout(() => {
      setSpellMovementVisuals(prev => prev.filter(item => item.id !== newVisual.id));
    }, 1400);
  }, []);

  const addSpellDeliveryVisual = useCallback((visual: Omit<SpellDeliveryVisual, 'id' | 'createdAt'>) => {
    const newVisual: SpellDeliveryVisual = {
      ...visual,
      id: `spell-delivery-${visual.spellId}-${Date.now()}`,
      createdAt: Date.now()
    };
    setSpellDeliveryVisuals(prev => [...prev, newVisual]);
    setTimeout(() => {
      setSpellDeliveryVisuals(prev => prev.filter(item => item.id !== newVisual.id));
    }, 1600);
  }, []);

  return {
    damageNumbers,
    animations,
    addDamageNumber,
    queueAnimation,
    spellMovementVisuals,
    addSpellMovementVisual,
    spellDeliveryVisuals,
    addSpellDeliveryVisual
  };
};
