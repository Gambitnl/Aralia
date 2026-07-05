/**
 * @file hooks/combat/useCombatOutcome.ts
 * Manages the combat state (Victory/Defeat) and reward generation.
 * Extracts logic previously in CombatView to improve testability and separation of concerns.
 */
import { useCallback, useMemo, useState } from 'react';
import { CombatCharacter } from '../../types/combat';
import { Item, Monster } from '../../types';
import { generateLoot } from '../../services/lootService';
import { xpForChallengeRating } from '../../utils/combat/xpForChallengeRating';

export interface CombatRewards {
  gold: number;
  items: Item[];
  xp: number;
}

export type BattleOutcome = 'active' | 'victory' | 'defeat';

interface UseCombatOutcomeProps {
  characters: CombatCharacter[];
  initialEnemies: CombatCharacter[]; // Needed to know if there were enemies to fight
}

export const useCombatOutcome = ({ characters, initialEnemies }: UseCombatOutcomeProps) => {
  const [forcedOutcome, setForcedOutcome] = useState<BattleOutcome | null>(null);
  const [forcedRewards, setForcedRewards] = useState<CombatRewards | null>(null);

  const players = characters.filter(c => c.team === 'player');
  const activeEnemies = characters.filter(c => c.team === 'enemy' && c.currentHP > 0);
  const activePlayers = players.filter(c => c.currentHP > 0);

  let computedOutcome: BattleOutcome = 'active';
  if (activeEnemies.length === 0 && initialEnemies.length > 0) {
    computedOutcome = 'victory';
  } else if (activePlayers.length === 0 && players.length > 0) {
    computedOutcome = 'defeat';
  }

  const battleState = forcedOutcome ?? computedOutcome;
  const buildRewards = useCallback((): CombatRewards => {
    // We map CombatCharacter back to a partial Monster structure for loot generation
    const originalMonsters: Monster[] = initialEnemies.map(e => ({
      id: e.id, // Add required id
      name: e.name,
      cr: (e.level || 0).toString(), // CombatCharacter uses 'level' for CR/Level. Safe fallback.
      stats: e.stats,
      description: e.name, // Use name as description fallback for tags
      alignment: e.alignment || 'Unaligned',
      type: (e.creatureTypes?.[0] || 'Unknown'),
      ac: e.baseAC || 10,
      hp: e.maxHP,
      quantity: 1,
      actions: [], // Not needed for loot
      xp: 0 // Will be calculated
    }));

    const loot = generateLoot(originalMonsters);
    // CR-driven XP: sum each defeated enemy's XP by its Challenge Rating (the
    // CombatCharacter carries CR on stats.cr, falling back to its level field).
    const xp = initialEnemies.reduce(
      (total, enemy) => total + xpForChallengeRating(enemy.stats?.cr ?? enemy.level ?? 0),
      0,
    );

    return {
      gold: loot.gold,
      items: loot.items,
      xp
    };
  }, [initialEnemies]);

  const rewards = useMemo(() => {
    if (battleState !== 'victory') return null;
    if (forcedOutcome === 'victory' && forcedRewards) return forcedRewards;
    return buildRewards();
  }, [battleState, forcedOutcome, forcedRewards, buildRewards]);

  // Debug/Manual override helper
  const forceOutcome = (outcome: BattleOutcome) => {
    setForcedOutcome(outcome);
    if (outcome === 'victory' && !forcedRewards) {
      // Generate dummy rewards if forced
      setForcedRewards({ gold: 100, items: [], xp: 100 });
    }
    if (outcome !== 'victory') {
      setForcedRewards(null);
    }
  };

  return {
    battleState,
    rewards,
    forceOutcome
  };
};

// [Steward] Extracted from CombatView.tsx to encapsulate victory conditions and loot generation.
