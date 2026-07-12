/**
 * @file recipeFromNpc.test.ts — rich NPCs and scene-cast members map to
 * entity recipes (slice 2: game-scene swap).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { recipeFromRichNpc } from '../recipeFromCharacter';
import { generateEntityBlueprint } from '../generateEntityBlueprint';
import { registerAllParts } from '../parts';
import { castMemberRecipe } from '../../../components/World3D/SceneCast';
import type { RichNPC } from '../../../types/world';

const npc = (over: Partial<RichNPC> & { id: string }): RichNPC =>
  ({
    name: 'Kael',
    baseDescription: '',
    initialPersonalityPrompt: '',
    role: 'civilian',
    biography: {
      age: 34,
      backgroundId: 'soldier',
      classId: 'fighter',
      level: 2,
      family: [],
      abilityScores: {} as never,
    },
    stats: {} as never,
    equippedItems: {},
    ...over,
  }) as RichNPC;

describe('recipeFromRichNpc', () => {
  beforeAll(() => registerAllParts());

  it('maps the biography class and equipped gear', () => {
    const r = recipeFromRichNpc(
      npc({
        id: 'npc-1',
        equippedItems: {
          MainHand: { id: 'battleaxe', name: 'Battleaxe', type: 'weapon' } as never,
          Torso: { id: 'chain_mail', name: 'Chain Mail', type: 'armor', armorCategory: 'Heavy' } as never,
        },
      }),
    );
    expect(r.kind).toBe('humanoid');
    if (r.kind !== 'humanoid') return;
    expect(r.classId).toBe('fighter');
    expect(r.raceId).toBe('human');
    const ids = (r.gearOverride ?? []).map((g) => g.partId);
    expect(ids).toContain('axeMain');
    expect(ids).toContain('pauldrons');
  });

  it('is seed-stable per npc id and yields a resolvable blueprint', () => {
    const a = recipeFromRichNpc(npc({ id: 'npc-2' }));
    const b = recipeFromRichNpc(npc({ id: 'npc-2' }));
    expect(a).toEqual(b);
    expect(generateEntityBlueprint(a)).toEqual(generateEntityBlueprint(b));
  });

  it('an NPC with no gear renders the class kit (no gearOverride)', () => {
    const r = recipeFromRichNpc(npc({ id: 'npc-3' }));
    if (r.kind !== 'humanoid') return;
    expect(r.gearOverride).toBeUndefined();
  });
});

describe('castMemberRecipe', () => {
  beforeAll(() => registerAllParts());

  it('uses the member recipe when present', () => {
    const recipe = { kind: 'humanoid', raceId: 'drow', classId: 'rogue', seed: 'x' } as const;
    expect(castMemberRecipe({ id: 'a', name: 'A', recipe })).toBe(recipe);
  });

  it('defaults an unspecified member to an unarmed human commoner, seeded by id', () => {
    const r = castMemberRecipe({ id: 'stranger-7', name: 'Mira' });
    expect(r.kind).toBe('humanoid');
    if (r.kind !== 'humanoid') return;
    expect(r.raceId).toBe('human');
    expect(r.gearOverride).toEqual([]); // empty override = carries nothing
    expect(r.seed).toContain('stranger-7');
    const bp = generateEntityBlueprint(r);
    // no gear parts on a commoner: only (possibly zero) race features
    expect(bp.parts.some((p) => p.partId.endsWith('Main') || p.partId === 'shieldOff')).toBe(false);
  });
});
