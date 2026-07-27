import { describe, it, expect } from 'vitest';
import { ALL_ITEMS, ITEMS, WEAPONS_DATA } from '../index';
import { GENERATED_GLOSSARY_ITEMS } from '../generatedGlossaryItems';
import { ADVENTURING_GEAR } from '../adventuringGear';
import { HOUSEHOLD_GOODS } from '../householdGoods';
import { GATHERABLE_ITEMS } from '../../gatherableItems';
import { CRAFTING_MATERIALS } from '../../craftingMaterials';

/**
 * Hand-authored item definitions must always win over the auto-generated
 * glossary stubs (generatedGlossaryItems.ts). The bulk-ingested glossary
 * redefines dozens of authored ids with mechanically-incomplete versions —
 * e.g. it turns a hooded lantern, a torch, and a tinderbox into an equippable
 * "Ring" accessory, and strips slot/cost off amulets and cloaks. If the merge
 * order ever regresses so the glossary wins, those stubs silently corrupt the
 * live catalog (wrong types, lost combat stats, mis-grouped inventory UI).
 *
 * The glossary is still allowed to *fill gaps* — ids it alone defines stay.
 */
describe('ALL_ITEMS: hand-authored items win over generated glossary stubs', () => {
  // Authored precedence mirrors the internal order in index.ts. The glossary is
  // NOT in this list — that is the whole point.
  const authoredMerged: Record<string, any> = {
    ...ITEMS,
    ...WEAPONS_DATA,
    ...ADVENTURING_GEAR,
    ...GATHERABLE_ITEMS,
    ...HOUSEHOLD_GOODS,
    ...CRAFTING_MATERIALS,
  };

  const collisions = Object.keys(authoredMerged).filter(
    (id) => id in GENERATED_GLOSSARY_ITEMS,
  );

  it('has a meaningful set of authored/glossary id collisions to guard', () => {
    // Sanity: if this drops to ~0 the guard below is silently vacuous.
    expect(collisions.length).toBeGreaterThan(40);
  });

  it('resolves every colliding id to its hand-authored definition, not the glossary stub', () => {
    for (const id of collisions) {
      expect(ALL_ITEMS[id]).toEqual(authoredMerged[id]);
      // And explicitly NOT the glossary version (guards against them being equal by luck).
      expect(ALL_ITEMS[id]).not.toBe(GENERATED_GLOSSARY_ITEMS[id]);
    }
  });

  it('still includes glossary-only ids (gap-filling is preserved)', () => {
    const glossaryOnly = Object.keys(GENERATED_GLOSSARY_ITEMS).filter(
      (id) => !(id in authoredMerged),
    );
    expect(glossaryOnly.length).toBeGreaterThan(500);
    for (const id of glossaryOnly.slice(0, 20)) {
      expect(ALL_ITEMS[id]).toBe(GENERATED_GLOSSARY_ITEMS[id]);
    }
  });

  // Concrete spot-checks — the ids the glossary was actively corrupting.
  it('keeps hooded_lantern a light_source (not a glossary "accessory" Ring)', () => {
    expect(ALL_ITEMS['hooded_lantern'].type).toBe('light_source');
    expect(ALL_ITEMS['hooded_lantern'].slot).toBeUndefined();
    expect(ALL_ITEMS['hooded_lantern'].icon).toBe('🏮');
  });

  it('keeps dagger a weapon with its authored combat stats', () => {
    const dagger = ALL_ITEMS['dagger'];
    expect(dagger.type).toBe('weapon');
    expect(dagger.damageDice).toBe('1d4');
    expect(dagger.damageType).toBe('Piercing');
    expect(dagger.mastery).toBe('Nick');
  });

  it('keeps torch a consumable and tinderbox / component_pouch / herbalism_kit tools', () => {
    expect(ALL_ITEMS['torch'].type).toBe('consumable');
    expect(ALL_ITEMS['tinderbox'].type).toBe('tool');
    expect(ALL_ITEMS['component_pouch'].type).toBe('tool');
    expect(ALL_ITEMS['herbalism_kit'].type).toBe('tool');
  });

  it('keeps amulet_of_health and cloak_of_protection wearable with their authored slots', () => {
    expect(ALL_ITEMS['amulet_of_health'].slot).toBe('Neck');
    expect(ALL_ITEMS['amulet_of_health'].cost).toBe('500 GP');
    expect(ALL_ITEMS['cloak_of_protection'].slot).toBe('Cloak');
  });

  it('keeps gathered poisons as reagents (not equippable Rings)', () => {
    expect(ALL_ITEMS['wyvern_poison'].type).toBe('reagent');
    expect(ALL_ITEMS['purple_worm_poison'].type).toBe('reagent');
  });
});
