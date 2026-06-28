
import { describe, it, expect } from 'vitest';
import { OpportunityAttackSystem } from '../OpportunityAttackSystem';
import { CombatCharacter } from '../../../../types/combat';
import { createMockCombatCharacter } from '../../../../utils/factories';
import summonBeast from '../../../../../public/data/spells/level-2/summon-beast.json';

/**
 * This test file proves when movement should create an Opportunity Attack.
 *
 * Opportunity Attacks are reaction windows that happen when a creature leaves
 * enemy reach. Spell-created summons can carry their own movement traits, so
 * these tests also protect the Summon Beast Flyby bridge that lets the Air form
 * avoid those reactions while Land and Water forms stay exposed.
 *
 * Called by: Vitest focused combat reaction checks.
 * Depends on: OpportunityAttackSystem and lightweight combat-character
 * factories.
 */

describe('OpportunityAttackSystem', () => {
  const system = new OpportunityAttackSystem();
  type SummonFormTraits = NonNullable<NonNullable<CombatCharacter['summonMetadata']>['formTraits']>;

  const createAttacker = (id: string, x: number, y: number, hasReaction: boolean = true): CombatCharacter => {
    const char = createMockCombatCharacter({ id, name: id, team: 'enemy' });
    char.position = { x, y };
    char.actionEconomy.reaction.used = !hasReaction;
    return char;
  };

  const createMover = (id: string, x: number, y: number, isDisengaged: boolean = false): CombatCharacter => {
    const char = createMockCombatCharacter({ id, name: id, team: 'player' });
    char.position = { x, y };
    if (isDisengaged) {
      char.statusEffects.push({
        id: 'disengage',
        name: 'Disengage',
        type: 'buff',
        duration: 1,
        effect: { type: 'stat_modifier' }
      });
    }
    return char;
  };

  it('detects OA when moving out of reach (5ft)', () => {
    // Attacker at 0,0. Reach 1.
    const attacker = createAttacker('orc', 0, 0);
    // Mover at 0,1 (in reach) moves to 0,2 (out of reach).
    const mover = createMover('hero', 0, 1);

    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);

    expect(results).toHaveLength(1);
    expect(results[0].attackerId).toBe('orc');
    expect(results[0].canAttack).toBe(true);
  });

  it('does NOT detect OA when moving within reach', () => {
    // Attacker at 0,0. Reach 1.
    const attacker = createAttacker('orc', 0, 0);
    // Mover at 1,0 (in reach) moves to 1,1 (still in reach - diagonal is dist 1 in Chebyshev).
    // Wait, 5e diagonals:
    // In Chebyshev (5-5-5), 1,1 is distance 1.
    // In Euclidean/5-10-5, 1,1 is distance 1.5 (approx 5ft, but logically adjacent).
    // The system uses `getDistance` which is Chebyshev.

    const mover = createMover('hero', 1, 0);
    const results = system.checkOpportunityAttacks(mover, { x: 1, y: 0 }, { x: 1, y: 1 }, [attacker]);

    expect(results).toHaveLength(0);
  });

  it('does NOT detect OA if attacker has no reaction', () => {
    const attacker = createAttacker('orc', 0, 0, false); // No reaction
    const mover = createMover('hero', 0, 1);

    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);
    expect(results).toHaveLength(0);
  });

  it('does NOT detect OA if mover Disengaged', () => {
    const attacker = createAttacker('orc', 0, 0);
    const mover = createMover('hero', 0, 1, true); // Disengaged

    const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);
    expect(results).toHaveLength(0);
  });

  it('does NOT detect OA if attacker is ally', () => {
     const attacker = createAttacker('ally', 0, 0);
     attacker.team = 'player'; // Same team as mover
     const mover = createMover('hero', 0, 1);

     const results = system.checkOpportunityAttacks(mover, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker]);
     expect(results).toHaveLength(0);
  });

  it('suppresses Opportunity Attacks only for the Summon Beast Air form Flyby trait', () => {
    const attacker = createAttacker('orc', 0, 0);
    const airSpirit = createMover('bestial-air', 0, 1);
    const landSpirit = createMover('bestial-land', 0, 1);
    const waterSpirit = createMover('bestial-water', 0, 1);
    const flybyTrait = {
      name: 'Flyby',
      appliesToForms: ['Air'],
      opportunityAttackPolicy: 'does_not_provoke_when_flying_out_of_reach' as const,
      movementModeRequired: 'fly' as const
    };

    // The Air spirit carries the same selected form metadata that SummoningCommand
    // writes after the player chooses the Summon Beast form. This should make
    // Flyby block enemy reactions when the spirit leaves reach.
    airSpirit.isSummon = true;
    airSpirit.summonMetadata = {
      casterId: 'caster',
      spellId: 'summon-beast',
      formName: 'Air',
      sourceName: 'Summon Beast',
      formTraits: [flybyTrait],
      dismissable: false
    };

    // Land carries the same trait list from spell data, but its selected form
    // does not match the Air-only Flyby row. It should provoke normally.
    landSpirit.isSummon = true;
    landSpirit.summonMetadata = {
      casterId: 'caster',
      spellId: 'summon-beast',
      formName: 'Land',
      sourceName: 'Summon Beast',
      formTraits: [flybyTrait],
      dismissable: false
    };

    // Water is another non-Air form in the same spell family. Keeping it in
    // the proof prevents the Flyby bridge from quietly becoming "any Summon
    // Beast form with a Flyby row" instead of the rules text's Air-only trait.
    waterSpirit.isSummon = true;
    waterSpirit.summonMetadata = {
      casterId: 'caster',
      spellId: 'summon-beast',
      formName: 'Water',
      sourceName: 'Summon Beast',
      formTraits: [flybyTrait],
      dismissable: false
    };

    // When the movement caller can name the movement mode, Air-form Flyby only
    // suppresses reactions for flight. This protects the source phrase "when
    // it flies out of an enemy's reach" instead of turning Flyby into blanket
    // walking immunity.
    expect(system.checkOpportunityAttacks(airSpirit, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker], null, { movementMode: 'fly' })).toHaveLength(0);
    expect(system.checkOpportunityAttacks(airSpirit, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker], null, { movementMode: 'walk' })).toHaveLength(1);

    // The opportunity system should not invent flight on its own. The map
    // action is responsible for carrying the selected movement mode; callers
    // that omit it should leave the Air form normally exposed rather than
    // granting blanket Flyby immunity from form metadata alone.
    expect(system.checkOpportunityAttacks(airSpirit, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker])).toHaveLength(1);
    expect(system.checkOpportunityAttacks(landSpirit, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker])).toHaveLength(1);
    expect(system.checkOpportunityAttacks(waterSpirit, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker])).toHaveLength(1);
  });

  it('uses live Summon Beast Flyby metadata only for explicit Air-form flight', () => {
    const attacker = createAttacker('orc-live-flyby', 0, 0);
    const airSpirit = createMover('live-bestial-air', 0, 1);
    const landSpirit = createMover('live-bestial-land', 0, 1);
    const summonEffect = summonBeast.effects.find(effect => effect.type === 'SUMMONING');
    const liveFlybyTrait = summonEffect?.summon?.formTraits?.find(trait => trait.name === 'Flyby');

    // This proof uses the actual Summon Beast packet rather than a local
    // facsimile. If the live Air Flyby trait loses its form restriction or
    // movement-mode requirement, the opportunity-attack boundary should fail
    // before the parent deferred row is closed.
    expect(liveFlybyTrait).toEqual(expect.objectContaining({
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
      formTraits: liveFlybyTrait ? [liveFlybyTrait] as SummonFormTraits : [],
      dismissable: false
    };
    landSpirit.isSummon = true;
    landSpirit.summonMetadata = {
      casterId: 'caster',
      spellId: summonBeast.id,
      formName: 'Land',
      sourceName: summonBeast.name,
      formTraits: liveFlybyTrait ? [liveFlybyTrait] as SummonFormTraits : [],
      dismissable: false
    };

    // The live trait should suppress only explicit Air-form flight. A Land
    // spirit with the same copied trait list and an Air spirit without a
    // flight movement action both remain normally exposed to reactions.
    expect(system.checkOpportunityAttacks(airSpirit, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker], null, { movementMode: 'fly' })).toHaveLength(0);
    expect(system.checkOpportunityAttacks(airSpirit, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker])).toHaveLength(1);
    expect(system.checkOpportunityAttacks(landSpirit, { x: 0, y: 1 }, { x: 0, y: 2 }, [attacker], null, { movementMode: 'fly' })).toHaveLength(1);
  });
});
