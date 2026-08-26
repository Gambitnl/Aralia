/**
 * @file src/systems/healing/healersKit.ts
 * Resolver for the Healer's Kit Utilize action and the Healer feat rider.
 *
 * RULES SOURCE
 * A Healer's Kit has ten uses. As a Utilize action you spend one use to
 * stabilize a creature that has 0 Hit Points. The Healer feat adds a rider:
 * when the kit is used to stabilize or tend a creature, that creature may
 * immediately spend one of its own Hit Point Dice, rerolling any die that
 * shows a 1 (see src/data/feats/featsData.ts, feat id `healer`).
 *
 * DESIGN
 * This module is pure. It reads the user, the target and the kit item and
 * returns the outcome the caller applies through the reducer. Rolling is
 * injected through `rng`, so tests pin the dice instead of retrying a random
 * result. The out-of-combat handler (handleItemInteraction) owns the dispatch;
 * the combat ability factory has no Utilize/item-use path today, so nothing is
 * wired there.
 */

import type { PlayerCharacter, HitPointDicePool } from '../../types/character';
import type { Item } from '../../types/items';
import { getAbilityModifierValue } from '../../utils/character';

/** Registry id of the Healer's Kit (src/data/items/generatedGlossaryItems.ts). */
export const HEALERS_KIT_ITEM_ID = 'healer_s_kit';

/** A fresh Healer's Kit carries ten uses. */
export const HEALERS_KIT_MAX_USES = 10;

/** Feat id that grants the Hit Die rider. */
export const HEALER_FEAT_ID = 'healer';

export type HealersKitFailure =
  | 'no_kit'
  | 'kit_depleted'
  | 'no_target'
  | 'target_dead_or_full';

export interface HealersKitOutcome {
  ok: boolean;
  /** Set when `ok` is false; names why the Utilize action did nothing. */
  failure?: HealersKitFailure;
  /** Uses left on the kit after this action. */
  kitUsesRemaining: number;
  /** True when the target was at 0 HP and is now Stable. */
  stabilized: boolean;
  /** HP the target regains from the Healer feat rider, already capped at maxHp. */
  healing: number;
  /** Individual Hit Die results kept for the log; a rerolled 1 shows both rolls. */
  rolls: number[];
  /** Updated Hit Point Dice pools for the target, when a die was spent. */
  hitPointDice?: HitPointDicePool[];
  /** Player-facing summary of what happened. */
  message: string;
}

/** Returns true when the character holds the Healer feat. */
export function hasHealerFeat(character: Pick<PlayerCharacter, 'feats'>): boolean {
  return (character.feats || []).includes(HEALER_FEAT_ID);
}

/** Uses left on a kit item; an item with no tracker is treated as brand new. */
export function kitUsesRemaining(kit: Pick<Item, 'usesRemaining'> | undefined): number {
  if (!kit) return 0;
  return kit.usesRemaining ?? HEALERS_KIT_MAX_USES;
}

/**
 * Spends one Hit Point Die from the highest-sided pool that still has a die.
 * Returns null when the target has no dice left to spend.
 */
function spendOneHitDie(
  pools: HitPointDicePool[],
  rng: () => number
): { pools: HitPointDicePool[]; roll: number; rolls: number[] } | null {
  const spendIndex = pools.reduce<number>((best, pool, index) => {
    if (pool.current <= 0) return best;
    if (best === -1) return index;
    return pool.die > pools[best].die ? index : best;
  }, -1);

  if (spendIndex === -1) return null;

  const die = pools[spendIndex].die;
  const rolls: number[] = [];
  let roll = Math.floor(rng() * die) + 1;
  rolls.push(roll);

  // Healer lets the creature reroll a die showing a 1. The reroll stands, so a
  // second 1 is kept rather than rerolled again.
  if (roll === 1) {
    roll = Math.floor(rng() * die) + 1;
    rolls.push(roll);
  }

  const nextPools = pools.map((pool, index) =>
    index === spendIndex ? { ...pool, current: pool.current - 1 } : pool
  );

  return { pools: nextPools, roll, rolls };
}

export interface ResolveHealersKitArgs {
  /** The character taking the Utilize action. */
  user: Pick<PlayerCharacter, 'name' | 'feats'>;
  /** The creature being stabilized or tended. */
  target: Pick<PlayerCharacter, 'name' | 'hp' | 'maxHp' | 'finalAbilityScores' | 'hitPointDice'>;
  /** The kit item from the inventory. */
  kit: Pick<Item, 'id' | 'usesRemaining'> | undefined;
  /** Injected randomness; defaults to Math.random. */
  rng?: () => number;
}

/**
 * Resolves one Utilize action with a Healer's Kit.
 *
 * Without the Healer feat this only stabilizes a target at 0 HP. With the feat
 * the target also spends one Hit Point Die (rerolling a 1) and regains that
 * roll plus its Constitution modifier, minimum 1, capped by its HP maximum.
 */
export function resolveHealersKitUse({
  user,
  target,
  kit,
  rng = Math.random,
}: ResolveHealersKitArgs): HealersKitOutcome {
  const usesBefore = kitUsesRemaining(kit);

  if (!kit) {
    return {
      ok: false,
      failure: 'no_kit',
      kitUsesRemaining: 0,
      stabilized: false,
      healing: 0,
      rolls: [],
      message: 'You have no Healer\'s Kit to use.',
    };
  }

  if (usesBefore <= 0) {
    return {
      ok: false,
      failure: 'kit_depleted',
      kitUsesRemaining: 0,
      stabilized: false,
      healing: 0,
      rolls: [],
      message: 'The Healer\'s Kit is out of uses.',
    };
  }

  const healer = hasHealerFeat(user);
  const isDying = target.hp <= 0;

  // Without the feat the kit only does what its own text says: stabilize a
  // creature at 0 HP. Tending a healthy ally would burn a use for nothing, so
  // the action is refused instead.
  if (!isDying && !healer) {
    return {
      ok: false,
      failure: 'target_dead_or_full',
      kitUsesRemaining: usesBefore,
      stabilized: false,
      healing: 0,
      rolls: [],
      message: `${target.name} is not dying, so the Healer's Kit has nothing to stabilize.`,
    };
  }

  const kitUsesAfter = usesBefore - 1;
  const stabilized = isDying;

  let healing = 0;
  let rolls: number[] = [];
  let hitPointDice: HitPointDicePool[] | undefined;

  if (healer) {
    const pools = target.hitPointDice || [];
    const spend = spendOneHitDie(pools, rng);
    if (spend) {
      const conMod = getAbilityModifierValue(target.finalAbilityScores.Constitution);
      const rolled = Math.max(1, spend.roll + conMod);
      // A stabilized creature is still at 0 HP when the die is rolled, so the
      // headroom is measured from its current HP either way.
      const missing = Math.max(0, target.maxHp - target.hp);
      healing = Math.min(missing, rolled);
      rolls = spend.rolls;
      hitPointDice = spend.pools;
    }
  }

  const parts: string[] = [];
  if (stabilized) {
    parts.push(`${target.name} is stabilized and stops making death saves`);
  } else {
    parts.push(`${user.name} tends ${target.name}'s wounds`);
  }
  if (healing > 0) {
    const rollLabel = rolls.length > 1 ? `${rolls[0]} rerolled to ${rolls[1]}` : `${rolls[0]}`;
    parts.push(`${target.name} spends one Hit Die (${rollLabel}) and regains ${healing} HP`);
  } else if (healer && rolls.length === 0) {
    parts.push(`${target.name} has no Hit Dice left to spend`);
  }

  return {
    ok: true,
    kitUsesRemaining: kitUsesAfter,
    stabilized,
    healing,
    rolls,
    hitPointDice,
    message: `${parts.join('. ')}. (Healer's Kit: ${kitUsesAfter} use${kitUsesAfter === 1 ? '' : 's'} left.)`,
  };
}
