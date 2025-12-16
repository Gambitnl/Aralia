import { useState, useCallback } from 'react';
import { DamageNumber, Animation, Position } from '../../types/combat';
import { createDamageNumber } from '../../utils/combatUtils';

/**
 * Hook to manage visual feedback in combat (damage numbers, animations).
 * Separates visual state from core turn logic.
 */
export const useCombatVisuals = () => {
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [animations, setAnimations] = useState<Animation[]>([]);

  const addDamageNumber = useCallback((value: number, position: Position, type: 'damage' | 'heal' | 'miss') => {
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

  return {
    damageNumbers,
    animations,
    addDamageNumber,
    queueAnimation
  };
};
