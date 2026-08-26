import { describe, it, expect } from 'vitest';
import {
  generateBackgroundBrief,
  selectBackgroundPack,
  backgroundBriefSeedPath,
  SEEDED_BIOME_ROLE_COMBINATIONS,
  type BackgroundBriefInput,
} from '../backgroundBrief';

/**
 * Unit tests for the deterministic NPC background generator.
 *
 * The load-bearing property is determinism: the same context must produce the
 * same brief on every world regeneration. The rest of the suite pins the data
 * model (four populated fields), the five seeded biome/role combinations, and
 * the family-tie substitution in the relationship hook.
 */

const BASE: BackgroundBriefInput = {
  worldSeed: 1337,
  identity: 'Doran Halvek',
  role: 'merchant',
  biome: 'coastal',
  culture: 'stoic',
  age: 41,
  maturityAge: 18,
  gender: 'male',
  familyTies: [
    { name: 'Mara Halvek', relation: 'parent', isAlive: true },
    { name: 'Sella Halvek', relation: 'child', isAlive: true },
  ],
};

describe('NPC BackgroundBrief', () => {
  it('produces all four brief fields with content', () => {
    const brief = generateBackgroundBrief(BASE);

    expect(brief.history.length).toBeGreaterThan(20);
    expect(brief.motivation.length).toBeGreaterThan(10);
    expect(brief.secret.length).toBeGreaterThan(10);
    expect(brief.relationshipHook.length).toBeGreaterThan(10);
    expect(brief.sourcePackId).toBe('coastal:merchant');
    expect(brief.seedPath).toContain('wf:1337');
  });

  it('writes a two-sentence history', () => {
    const brief = generateBackgroundBrief(BASE);
    const sentences = brief.history.split(/(?<=\.)\s+/).filter(Boolean);
    expect(sentences).toHaveLength(2);
  });

  it('is deterministic: same inputs produce an identical brief', () => {
    const a = generateBackgroundBrief(BASE);
    const b = generateBackgroundBrief({ ...BASE, familyTies: [...(BASE.familyTies ?? [])] });
    expect(b).toEqual(a);
  });

  it('varies with the world seed', () => {
    const a = generateBackgroundBrief(BASE);
    const b = generateBackgroundBrief({ ...BASE, worldSeed: 9001 });
    expect(b.seedPath).not.toBe(a.seedPath);
    // Different seed paths must not collapse to the same four strings.
    const same =
      a.history === b.history &&
      a.motivation === b.motivation &&
      a.secret === b.secret &&
      a.relationshipHook === b.relationshipHook;
    expect(same).toBe(false);
  });

  it('gives two NPCs in the same context different briefs', () => {
    const a = generateBackgroundBrief(BASE);
    const b = generateBackgroundBrief({ ...BASE, identity: 'Ivet Sarn' });
    expect(b.history).not.toBe(a.history);
  });

  it('ships the five seeded biome/role combinations', () => {
    expect(SEEDED_BIOME_ROLE_COMBINATIONS).toHaveLength(5);
    expect(SEEDED_BIOME_ROLE_COMBINATIONS).toEqual(
      expect.arrayContaining([
        'coastal:merchant',
        'temperate:civilian',
        'highland:guard',
        'arid:quest_giver',
        'swampy:unique',
      ]),
    );
    for (const combo of SEEDED_BIOME_ROLE_COMBINATIONS) {
      const [biome, role] = combo.split(':');
      const pack = selectBackgroundPack(role as never, biome as never);
      expect(pack.id).toBe(combo);
      expect(pack.origins.length).toBeGreaterThan(0);
      expect(pack.turningPoints.length).toBeGreaterThan(0);
      expect(pack.motivations.length).toBeGreaterThan(0);
      expect(pack.secrets.length).toBeGreaterThan(0);
      expect(pack.hooks.length).toBeGreaterThan(0);
    }
  });

  it('keeps origins and turning points paired 1:1 in every pack', () => {
    // The two history sentences are drawn with ONE index, so a pack whose
    // arrays drift out of alignment would silently start reusing entry 0.
    const packIds = [
      ...SEEDED_BIOME_ROLE_COMBINATIONS.map((c) => c.split(':') as [string, string]),
      ...(['merchant', 'quest_giver', 'guard', 'civilian', 'unique'] as const).map(
        (r) => [undefined, r] as [undefined, string],
      ),
    ];
    for (const [biome, role] of packIds) {
      const pack = selectBackgroundPack(role as never, biome as never);
      expect(pack.turningPoints.length, pack.id).toBe(pack.origins.length);
    }
  });

  it('falls back to a role pack when the biome has no seeded combination', () => {
    const pack = selectBackgroundPack('merchant', 'polar');
    expect(pack.id).toBe('role:merchant');
  });

  it('still produces a brief with no biome, culture, age, or family', () => {
    const brief = generateBackgroundBrief({ identity: 'Nobody', role: 'guard' });
    expect(brief.sourcePackId).toBe('role:guard');
    expect(brief.history).not.toContain('{');
    expect(brief.relationshipHook).not.toContain('{kin}');
  });

  it('names a living family member in the relationship hook', () => {
    const brief = generateBackgroundBrief(BASE);
    const named =
      brief.relationshipHook.includes('Mara Halvek') || brief.relationshipHook.includes('Sella Halvek');
    expect(named).toBe(true);
  });

  it('never points the hook at a dead relative', () => {
    const brief = generateBackgroundBrief({
      ...BASE,
      familyTies: [
        { name: 'Ghost Halvek', relation: 'parent', isAlive: false },
        { name: 'Sella Halvek', relation: 'child', isAlive: true },
      ],
    });
    expect(brief.relationshipHook).not.toContain('Ghost Halvek');
    expect(brief.relationshipHook).toContain('Sella Halvek');
  });

  it('leaves no unresolved placeholders in any field', () => {
    const roles = ['merchant', 'quest_giver', 'guard', 'civilian', 'unique'] as const;
    const biomes = ['coastal', 'temperate', 'highland', 'arid', 'swampy', 'tundra'] as const;
    const cultures = ['stoic', 'festive', 'scholarly', 'martial'] as const;

    for (const role of roles) {
      for (const biome of biomes) {
        for (const culture of cultures) {
          const brief = generateBackgroundBrief({
            worldSeed: 7,
            identity: `${role}-${biome}-${culture}`,
            role,
            biome,
            culture,
            age: 33,
            maturityAge: 18,
            gender: 'female',
            familyTies: [{ name: 'Kesh', relation: 'spouse', isAlive: true }],
          });
          const all = [brief.history, brief.motivation, brief.secret, brief.relationshipHook].join(' ');
          expect(all).not.toMatch(/\{[A-Za-z]+\}/);
          expect(all).not.toContain('undefined');
        }
      }
    }
  });

  it('keeps verb agreement for every pronoun across the matrix', () => {
    const roles = ['merchant', 'quest_giver', 'guard', 'civilian', 'unique'] as const;
    const biomes = ['coastal', 'temperate', 'highland', 'arid', 'swampy', 'tundra'] as const;
    const genders = ['male', 'female', undefined] as const;
    // Templates are authored in the neutral "they" voice; these are the
    // mismatches that appear if a verb-agreement placeholder is missed.
    const bad = /\b(he|she) (are|have|were|do)\b|\bthey (is|has|was|does)\b/i;

    for (const role of roles) {
      for (const biome of biomes) {
        for (const gender of genders) {
          // Sweep several seeds so every entry in each list gets drawn.
          for (let seed = 0; seed < 12; seed++) {
            const brief = generateBackgroundBrief({
              worldSeed: seed,
              identity: `${role}-${biome}-${gender ?? 'neutral'}-${seed}`,
              role,
              biome,
              culture: 'stoic',
              age: 40,
              maturityAge: 18,
              gender,
              familyTies: [{ name: 'Kesh', relation: 'sibling', isAlive: true }],
            });
            const all = [brief.history, brief.motivation, brief.secret, brief.relationshipHook].join(' ');
            expect(all, `${role}/${biome}/${gender}/${seed}: ${all}`).not.toMatch(bad);
          }
        }
      }
    }
  });

  it('reflects culture in the motivation clause', () => {
    const stoic = generateBackgroundBrief({ ...BASE, culture: 'stoic' });
    const scholarly = generateBackgroundBrief({ ...BASE, culture: 'scholarly' });
    expect(stoic.motivation).toContain('will not be the one to bring it up');
    expect(scholarly.motivation).toContain('written down exactly what it would cost');
  });

  it('reflects age band relative to race maturity', () => {
    // A 120-year-old elf (maturity 100) is young; a 60-year-old human is a veteran.
    const elf = generateBackgroundBrief({ ...BASE, age: 120, maturityAge: 100 });
    const human = generateBackgroundBrief({ ...BASE, age: 60, maturityAge: 18 });
    expect(elf.history).toMatch(/Barely out of apprenticeship|Young enough/);
    expect(human.history).toMatch(/After decades at it|Old enough now/);
  });

  it('encodes the context in the seed path', () => {
    const path = backgroundBriefSeedPath(BASE);
    expect(path).toContain('npc:Doran Halvek');
    // Only caller-stable context keys the path: role, biome, culture. Age and
    // the family tree shape the output but are generated inside generateNPC,
    // so keying on them would re-roll the brief on every call.
    expect(path).toContain('ctx:merchant-coastal-stoic');
    expect(backgroundBriefSeedPath({ ...BASE, age: 62 })).toBe(path);
  });
});
