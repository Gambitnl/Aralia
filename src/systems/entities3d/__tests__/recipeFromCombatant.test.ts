/**
 * @file recipeFromCombatant.test.ts — combat-map combatants map to entity
 * recipes (slice 3: combat token swap).
 *
 * PCs and humanoid monsters take the humanoid path (race resolved from the
 * creatureTypes tags + name); everything else takes the creature path via
 * canonical creature type + size + name cues.
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { recipeFromCombatant, raceIdFromTags } from '../recipeFromCombatant';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';
import { __setEntriesForTests, type AcceptedEntity } from '../library/acceptedEntities';
import type { CreaturePlan } from '../textPlan/planSchema';
import type { CombatCharacter } from '../../../types/combat';

const combatant = (over: Partial<CombatCharacter> & { id: string; name: string }): CombatCharacter =>
  ({
    level: 3,
    class: { id: 'wizard', name: 'Wizard' },
    position: { x: 0, y: 0 },
    stats: { size: 'Medium' },
    abilities: [],
    team: 'player',
    currentHP: 10,
    maxHP: 10,
    ...over,
  }) as unknown as CombatCharacter;

describe('raceIdFromTags', () => {
  it('resolves race tags to real race ids', () => {
    expect(raceIdFromTags(['Humanoid', 'Elf'], 'Aelar')).toBe('high_elf');
    expect(raceIdFromTags(['Humanoid', 'Goblinoid'], 'Goblin Scout')).toBe('goblin');
    expect(raceIdFromTags(['Humanoid'], 'Duergar Soldier')).toBe('duergar');
    expect(raceIdFromTags(['Humanoid'], 'Bandit Captain')).toBe('human');
  });
});

describe('recipeFromCombatant', () => {
  beforeAll(() => registerAllParts());

  it('maps a party wizard to a humanoid recipe with their class', () => {
    const r = recipeFromCombatant(
      combatant({ id: 'pc1', name: 'Mira', creatureTypes: ['Humanoid', 'Hill Dwarf'] }),
    );
    expect(r.kind).toBe('humanoid');
    if (r.kind !== 'humanoid') return;
    expect(r.raceId).toBe('hill_dwarf');
    expect(r.classId).toBe('wizard');
    expect(() => generateEntityBlueprint(r)).not.toThrow();
  });

  it('falls back to fighter for a monster class id that is not a real class', () => {
    const r = recipeFromCombatant(
      combatant({
        id: 'g1',
        name: 'Goblin',
        class: { id: 'monster', name: 'Monster' } as never,
        creatureTypes: ['Humanoid', 'Goblinoid'],
        team: 'enemy',
      }),
    );
    if (r.kind !== 'humanoid') return;
    expect(r.raceId).toBe('goblin');
    expect(r.classId).toBe('fighter');
  });

  it('maps a beast monster to a plan-bodied creature of its size', () => {
    const r = recipeFromCombatant(
      combatant({
        id: 'w1',
        name: 'Dire Wolf',
        class: { id: 'monster', name: 'Monster' } as never,
        creatureTypes: ['Beast'],
        stats: { size: 'Large' } as never,
        team: 'enemy',
      }),
    );
    expect(r.kind).toBe('creature');
    if (r.kind !== 'creature') return;
    expect(r.creatureType).toBe('Beast');
    expect(r.size).toBe('Large');
    expect(r.cues).toContain('wolf');
    expect(generateEntityBlueprint(r).gait).toBe('plan');
  });

  it('maps undead and dragons through their canonical types', () => {
    const skeleton = recipeFromCombatant(
      combatant({ id: 's1', name: 'Skeleton', class: { id: 'monster', name: 'M' } as never, creatureTypes: ['Undead'], team: 'enemy' }),
    );
    expect(skeleton.kind).toBe('creature');
    const dragon = recipeFromCombatant(
      combatant({
        id: 'd1',
        name: 'Young Red Dragon',
        class: { id: 'monster', name: 'M' } as never,
        creatureTypes: ['Dragon'],
        stats: { size: 'Large' } as never,
        team: 'enemy',
      }),
    );
    if (dragon.kind !== 'creature') return;
    expect(generateEntityBlueprint(dragon).gait).toBe('plan');
  });

  it('is deterministic per combatant id', () => {
    const a = recipeFromCombatant(combatant({ id: 'x', name: 'X', creatureTypes: ['Humanoid'] }));
    const b = recipeFromCombatant(combatant({ id: 'x', name: 'X', creatureTypes: ['Humanoid'] }));
    expect(a).toEqual(b);
  });

  it('throws on a combatant with no recognizable creature type — no fallback', () => {
    expect(() =>
      recipeFromCombatant(
        combatant({ id: 'z', name: 'Blorb', class: { id: 'monster', name: 'M' } as never, creatureTypes: ['Slaadi'], team: 'enemy' }),
      ),
    ).toThrow(/Blorb/);
  });
});

describe('recipeFromCombatant — approved library priority', () => {
  /** Minimal valid plan (shape copied from textPlan/fixtures.ts floatingEye). */
  const makePlan = (name: string): CreaturePlan => ({
    name,
    frame: { heightFt: 3.5, bulk: 0.95, stance: 'floating' },
    spine: { segments: 2, taper: 0.9, arch: 0 },
    appendages: [],
    heads: [{ sizeScale: 1.6, eyes: { count: 1, sizeScale: 2 } }],
    palette: { bodyHex: '#6b5b8f', accentHex: '#a08cc4', eyeHex: '#7fd4c1' },
  });

  const libEntry = (id: string, name: string): AcceptedEntity => ({ id, name, plan: makePlan(name) });

  afterEach(() => __setEntriesForTests(null));

  it('a monster whose name matches an approved entry gets that planned recipe, seeded by the entry id', () => {
    const entry = libEntry('lib-beetle-1', 'Basalt Ember Beetle');
    __setEntriesForTests([entry]);
    const r = recipeFromCombatant(
      combatant({
        id: 'm1',
        name: 'Basalt Ember Beetle',
        class: { id: 'monster', name: 'M' } as never,
        creatureTypes: ['Beast'],
        team: 'enemy',
      }),
    );
    expect(r).toEqual({ kind: 'planned', plan: entry.plan, seed: 'lib-beetle-1' });
  });

  it('the library match ignores case and padding on the combatant name', () => {
    __setEntriesForTests([libEntry('lib-beetle-2', 'Basalt Ember Beetle')]);
    const r = recipeFromCombatant(
      combatant({
        id: 'm2',
        name: '  BASALT ember beetle ',
        class: { id: 'monster', name: 'M' } as never,
        creatureTypes: ['Beast'],
        team: 'enemy',
      }),
    );
    expect(r.kind).toBe('planned');
    if (r.kind !== 'planned') return;
    expect(r.seed).toBe('lib-beetle-2');
  });

  it('a monster with no library match still takes the legacy creature path unchanged', () => {
    // Library holds an unrelated creature — the Dire Wolf misses and must come
    // out exactly as the legacy test above expects.
    __setEntriesForTests([libEntry('lib-other', 'Basalt Ember Beetle')]);
    const r = recipeFromCombatant(
      combatant({
        id: 'w1',
        name: 'Dire Wolf',
        class: { id: 'monster', name: 'Monster' } as never,
        creatureTypes: ['Beast'],
        stats: { size: 'Large' } as never,
        team: 'enemy',
      }),
    );
    expect(r.kind).toBe('creature');
    if (r.kind !== 'creature') return;
    expect(r.creatureType).toBe('Beast');
    expect(r.size).toBe('Large');
    expect(r.seed).toBe('combat:w1');
    expect(r.cues).toContain('wolf');
  });

  it('the PC/humanoid path never consults the library, even on a name hit', () => {
    // An approved entry named after a PC must not hijack the humanoid body.
    __setEntriesForTests([libEntry('lib-mira', 'Mira')]);
    const r = recipeFromCombatant(
      combatant({ id: 'pc1', name: 'Mira', creatureTypes: ['Humanoid', 'Hill Dwarf'] }),
    );
    expect(r.kind).toBe('humanoid');
    if (r.kind !== 'humanoid') return;
    expect(r.raceId).toBe('hill_dwarf');
  });
});
