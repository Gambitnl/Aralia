import { describe, expect, it } from 'vitest';
import { inferMovementModeForAction } from '../useBattleMap';
import { createMockCombatCharacter } from '../../utils/factories';
import type { CombatCharacter } from '../../types/combat';
import summonBeast from '../../../public/data/spells/level-2/summon-beast.json';

/**
 * This file protects the movement-mode handoff created by the battle-map hook.
 *
 * When a player clicks a movement tile, useBattleMap creates the movement action
 * that later feeds opportunity-attack checks. Spell-created actors such as
 * Summon Beast can carry selected-form traits, so this focused proof makes sure
 * the map action can mark an Air spirit as flying without hardcoding Summon
 * Beast directly into the opportunity-attack system.
 *
 * Called by: focused Vitest hook tests.
 * Depends on: useBattleMap movement-mode inference and mock combat-character
 * factories.
 */

describe('inferMovementModeForAction', () => {
  type SummonFormTraits = NonNullable<NonNullable<CombatCharacter['summonMetadata']>['formTraits']>;

  const flybyTrait = {
    name: 'Flyby',
    appliesToForms: ['Air'],
    opportunityAttackPolicy: 'does_not_provoke_when_flying_out_of_reach' as const,
    movementModeRequired: 'fly' as const
  };

  it('marks selected Air-form summon movement as flying for Flyby handoff', () => {
    const airSpirit = createMockCombatCharacter({ id: 'air-spirit', name: 'Air Spirit' });

    // The selected form and trait mirror the metadata written by SummoningCommand
    // after the player chooses Summon Beast's Air form. The map action should
    // carry "fly" forward so OpportunityAttackSystem can apply Flyby through a
    // shared movement-mode field.
    airSpirit.isSummon = true;
    airSpirit.summonMetadata = {
      casterId: 'caster',
      spellId: 'summon-beast',
      formName: 'Air',
      sourceName: 'Summon Beast',
      formTraits: [flybyTrait],
      dismissable: false
    };

    expect(inferMovementModeForAction(airSpirit)).toBe('fly');
  });

  it('uses live Summon Beast Air form trait data for Flyby movement handoff', () => {
    const airSpirit = createMockCombatCharacter({ id: 'live-air-spirit', name: 'Live Air Spirit' });
    const summonEffect = summonBeast.effects.find(effect => effect.type === 'SUMMONING');
    const flybyFromLiveData = summonEffect?.summon?.formTraits?.find(trait => trait.name === 'Flyby');

    // This case keeps the proof tied to the real spell packet instead of only
    // a hand-built fixture. If the public Summon Beast data loses the Air-only
    // Flyby trait or changes the required movement mode, the map handoff proof
    // should fail before the parent bucket row is closed.
    expect(flybyFromLiveData).toEqual(expect.objectContaining({
      appliesToForms: ['Air'],
      opportunityAttackPolicy: 'does_not_provoke_when_flying_out_of_reach',
      movementModeRequired: 'fly'
    }));

    airSpirit.isSummon = true;
    airSpirit.summonMetadata = {
      casterId: 'caster',
      spellId: summonBeast.id,
      formName: 'Air',
      sourceName: summonBeast.name,
      formTraits: flybyFromLiveData ? [flybyFromLiveData] as SummonFormTraits : [],
      dismissable: false
    };

    expect(inferMovementModeForAction(airSpirit)).toBe('fly');
  });

  it('does not apply live Summon Beast Air-only Flyby data to Land or Water forms', () => {
    const summonEffect = summonBeast.effects.find(effect => effect.type === 'SUMMONING');
    const flybyFromLiveData = summonEffect?.summon?.formTraits?.find(trait => trait.name === 'Flyby');
    const landSpirit = createMockCombatCharacter({ id: 'live-land-spirit', name: 'Live Land Spirit' });
    const waterSpirit = createMockCombatCharacter({ id: 'live-water-spirit', name: 'Live Water Spirit' });

    // This uses the same live Flyby trait as the Air case above. The important
    // guard is that selected form still matters: Land and Water are valid
    // Summon Beast forms, but the Air-only opportunity policy must not leak
    // into their movement actions.
    landSpirit.isSummon = true;
    landSpirit.summonMetadata = {
      casterId: 'caster',
      spellId: summonBeast.id,
      formName: 'Land',
      sourceName: summonBeast.name,
      formTraits: flybyFromLiveData ? [flybyFromLiveData] as SummonFormTraits : [],
      dismissable: false
    };
    waterSpirit.isSummon = true;
    waterSpirit.summonMetadata = {
      casterId: 'caster',
      spellId: summonBeast.id,
      formName: 'Water',
      sourceName: summonBeast.name,
      formTraits: flybyFromLiveData ? [flybyFromLiveData] as SummonFormTraits : [],
      dismissable: false
    };

    expect(inferMovementModeForAction(landSpirit)).toBeUndefined();
    expect(inferMovementModeForAction(waterSpirit)).toBeUndefined();
  });

  it('does not mark nonmatching summon forms as flying', () => {
    const landSpirit = createMockCombatCharacter({ id: 'land-spirit', name: 'Land Spirit' });
    const waterSpirit = createMockCombatCharacter({ id: 'water-spirit', name: 'Water Spirit' });

    // Land and Water belong to the same spell family, but neither matches the
    // Air-only Flyby trait. The map action must therefore stay silent instead
    // of giving either non-Air form flying movement for opportunity-attack
    // suppression.
    landSpirit.isSummon = true;
    landSpirit.summonMetadata = {
      casterId: 'caster',
      spellId: 'summon-beast',
      formName: 'Land',
      sourceName: 'Summon Beast',
      formTraits: [flybyTrait],
      dismissable: false
    };
    waterSpirit.isSummon = true;
    waterSpirit.summonMetadata = {
      casterId: 'caster',
      spellId: 'summon-beast',
      formName: 'Water',
      sourceName: 'Summon Beast',
      formTraits: [flybyTrait],
      dismissable: false
    };

    expect(inferMovementModeForAction(landSpirit)).toBeUndefined();
    expect(inferMovementModeForAction(waterSpirit)).toBeUndefined();
  });

  it('leaves ordinary creatures without summon form traits on normal movement', () => {
    const fighter = createMockCombatCharacter({ id: 'fighter', name: 'Fighter' });

    // Normal actors do not have a selected summon form, so the map should not
    // invent a movement mode for them. They continue through the existing
    // ordinary movement path.
    expect(inferMovementModeForAction(fighter)).toBeUndefined();
  });

  it('ignores movement-mode traits that keep normal opportunity exposure', () => {
    const climbingSpirit = createMockCombatCharacter({ id: 'climbing-spirit', name: 'Climbing Spirit' });

    // Movement-mode inference exists to hand special opportunity-attack facts
    // to the shared reaction system. A trait can mention a movement mode for
    // other reasons, but if its opportunity policy is normal, the map action
    // should not mark that mode as opportunity-proof movement.
    climbingSpirit.isSummon = true;
    climbingSpirit.summonMetadata = {
      casterId: 'caster',
      spellId: 'future-summon',
      formName: 'Climber',
      sourceName: 'Future Summon',
      formTraits: [{
        name: 'Spider Climb',
        appliesToForms: ['Climber'],
        opportunityAttackPolicy: 'normal',
        movementModeRequired: 'climb'
      }],
      dismissable: false
    };

    expect(inferMovementModeForAction(climbingSpirit)).toBeUndefined();
  });
});
