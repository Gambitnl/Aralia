/**
 * Proves the combat-side Dev Player marker is explicit and isolated.
 *
 * Design Preview marks one transient combatant while creating it from a
 * PlayerCharacter. These tests protect that marker from turning into a brittle
 * player-id/name convention or leaking to ordinary combatants.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { CombatCharacter } from '../../../types/combat';
import type { Spell } from '../../../types/spells';
import { buildDevPlayer } from '../../../components/DesignPreview/steps/devPlayerPreview';
import {
  createPlayerCombatCharacter,
  isUnlimitedSpellSlotCombatant,
} from '../combatUtils';
import { createMockCombatCharacter } from '../../core/factories';

// ============================================================================
// Explicit Preview Marker
// ============================================================================
// The type guard is the only action-economy entry point for the exception. A
// normal combatant must remain outside it even if it has a familiar id or name.
// ============================================================================

describe('Dev Player combat capability', () => {
  it('recognizes only the explicit unlimited-slot marker', () => {
    const ordinary = createMockCombatCharacter({ id: 'player', name: 'Dev Player' });
    const preview = {
      ...ordinary,
      devPlaytest: { unlimitedSpellSlots: true },
    } as CombatCharacter;

    expect(isUnlimitedSpellSlotCombatant(ordinary)).toBe(false);
    expect(isUnlimitedSpellSlotCombatant(preview)).toBe(true);
  });

  it('hydrates every available class spell into the Dev Player ability palette', () => {
    // The bundled spell corpus is the same data SpellContext supplies to the
    // live Battle Map. Filtering preserves honest behavior if a class list ever
    // references a spell asset that has not shipped yet.
    const allSpells = JSON.parse(
      readFileSync('public/data/spells_bundle.json', 'utf8'),
    ) as Record<string, Spell>;
    const player = buildDevPlayer({
      raceId: 'human',
      classId: 'wizard',
      level: 1,
    });
    const combatant = createPlayerCombatCharacter(player, allSpells);
    const expectedSpellIds = (player.class.spellcasting?.spellList ?? [])
      .filter((spellId) => Boolean(allSpells[spellId]))
      .sort();
    const actualSpellIds = combatant.abilities
      .filter((ability) => ability.type === 'spell')
      .map((ability) => ability.id)
      .sort();

    expect(actualSpellIds).toEqual(expectedSpellIds);
  });
});
