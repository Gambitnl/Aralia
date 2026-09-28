import { describe, it, expect } from 'vitest';
import { buildRacialTraitLibrary } from '../racialTraits';
import { GOLIATH_DATA } from '../goliath';
import { RAVENITE_DRAGONBORN_DATA } from '../ravenite_dragonborn';
import { HARENGON_DATA } from '../harengon';

describe('Racial Reaction Parser', () => {
  it('should extract Stone\'s Endurance reaction from Goliath ancestry benefits', () => {
    // Actually, I should test extractRacialReactions directly or via a mock race.
    const mockRace = {
      id: 'mock_goliath',
      name: 'Mock Goliath',
      traits: [
        "Stone's Endurance: When you take damage, you can take a Reaction to roll 1d12. Add your Constitution modifier to the number rolled and reduce the damage by that total. You can use this benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest."
      ]
    };
    
    const library = buildRacialTraitLibrary({ mock: mockRace as any });
    const trait = library.byRaceId['mock_goliath'][0] as any;
    
    expect(trait.modifierBuckets.reactions).toBeDefined();
    expect(trait.modifierBuckets.reactions.length).toBe(1);
    
    const reaction = trait.modifierBuckets.reactions[0];
    expect(reaction.name).toBe("Stone's Endurance");
    expect(reaction.trigger.type).toBe('on_target_takes_damage');
    expect(reaction.effect.type).toBe('DEFENSIVE');
    expect(reaction.effect.damageReduction.dice).toBe('1d12');
    expect(reaction.effect.damageReduction.abilityModifier).toBe('Constitution');
  });

  it('should extract Storm\'s Thunder reaction from Goliath ancestry benefits', () => {
    const mockRace = {
      id: 'mock_goliath',
      name: 'Mock Goliath',
      traits: [
        "Storm's Thunder: When you take damage from a creature within 60 feet of you, you can take a Reaction to deal 1d8 Thunder damage to that creature. You can use this benefit a number of times equal to your Proficiency Bonus, and you regain all expended uses when you finish a Long Rest."
      ]
    };
    
    const library = buildRacialTraitLibrary({ mock: mockRace as any });
    const trait = library.byRaceId['mock_goliath'][0] as any;
    
    expect(trait.modifierBuckets.reactions).toBeDefined();
    expect(trait.modifierBuckets.reactions.length).toBe(1);
    
    const reaction = trait.modifierBuckets.reactions[0];
    expect(reaction.name).toBe("Storm's Thunder");
    expect(reaction.trigger.type).toBe('on_target_takes_damage');
    expect(reaction.effect.type).toBe('DAMAGE');
    expect(reaction.effect.damage.dice).toBe('1d8');
    expect(reaction.effect.damage.type).toBe('Thunder');
  });

  it("should fire Harengon's Lucky Footwork on the failed save, not on damage taken", () => {
    const library = buildRacialTraitLibrary({ harengon: HARENGON_DATA });
    const trait = library.byRaceId['harengon'].find(t => t.traitName === 'Lucky Footwork') as any;

    const reaction = trait.modifierBuckets.reactions[0];
    expect(reaction.name).toBe('Lucky Footwork');
    // A damage trigger made this reaction offer itself on every hit taken; the
    // trait only fires on the Dexterity save it adds its d4 to.
    expect(reaction.trigger.type).toBe('on_failed_saving_throw');
    expect(reaction.condition).toEqual({ type: 'save', saveType: 'Dexterity' });
    expect(reaction.effect.savingThrowModifier.dice).toBe('d4');
  });

  it('should extract Vengeful Assault reaction from Ravenite Dragonborn', () => {
    const library = buildRacialTraitLibrary({ ravenite: RAVENITE_DRAGONBORN_DATA });
    const trait = library.byRaceId['ravenite_dragonborn'].find(t => t.traitName === 'Vengeful Assault') as any;
    
    expect(trait.modifierBuckets.reactions).toBeDefined();
    const reaction = trait.modifierBuckets.reactions[0];
    expect(reaction.trigger.type).toBe('on_target_takes_damage');
    expect(reaction.effect.type).toBe('REACTIVE');
    expect(reaction.effect.trigger.type).toBe('on_target_attack');
  });
});
