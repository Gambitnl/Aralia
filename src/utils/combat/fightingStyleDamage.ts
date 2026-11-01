/**
 * Quotes Dueling from the owned style and actual held weapons for both sheet
 * feedback and weapon damage. Inventory weapons and a held shield do not count
 * as a second weapon. Missing hand facts never grant an assumed bonus.
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 12:14:17
 * Dependents: commands/factory/AbilityCommandFactory.ts, components/CharacterSheet/Overview/EquipmentMannequin.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { Item, PlayerCharacter } from '../../types';
import { hasWeaponProperty, isRangedWeapon } from './weaponRange';

type DuelingSubject = Pick<PlayerCharacter, 'selectedFightingStyle' | 'feats'> & {
  equippedItems?: PlayerCharacter['equippedItems'];
};

export function getDuelingDamageBonus(subject: DuelingSubject, weapon: Item): number {
  const ownsStyle = subject.selectedFightingStyle?.id === 'dueling' || subject.feats?.includes('dueling_style');
  if (!ownsStyle || weapon.type !== 'weapon' || isRangedWeapon(weapon) || hasWeaponProperty(weapon, 'two-handed')) return 0;
  const held = [subject.equippedItems?.MainHand, subject.equippedItems?.OffHand]
    .filter((item): item is Item => item?.type === 'weapon');
  // Compare the stable item identity, not a display name. Identical weapons in
  // both hands still count twice; a thrown melee weapon keeps its weapon type.
  return held.length === 1 && held[0].id === weapon.id ? 2 : 0;
}
