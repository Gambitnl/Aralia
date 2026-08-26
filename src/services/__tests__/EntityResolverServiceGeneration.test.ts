/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/services/__tests__/EntityResolverServiceGeneration.test.ts
 * Covers the formalized stub generation in `EntityResolverService`:
 * faction rank/perk ladders (board task agora-02c9) and dynamic location biome
 * plus NPC role/personality seeding (board task agora-6e72).
 *
 * Kept separate from `EntityResolverService.test.ts`, which covers resolution
 * (proper-noun extraction, existence checks) rather than generation.
 */

import { describe, it, expect } from 'vitest';
import { EntityResolverService, ENTITY_RESOLVER_TABLES } from '../EntityResolverService';
import { GameState, Faction, Location, NPC, FactionType } from '../../types';
import { FACTIONS } from '../../data/factions';
import { BIOMES } from '../../data/biomes';
import { ARCHETYPES } from '../../systems/npcPersonality/index.js';

const mockState = {
  factions: { ...FACTIONS },
  dynamicLocations: {},
} as unknown as GameState;

async function createFaction(name: string, context?: string): Promise<Faction> {
  const result = await EntityResolverService.ensureEntityExists('faction', name, mockState, context);
  expect(result.created).toBe(true);
  return result.entity as Faction;
}

async function createLocation(name: string, context?: string): Promise<Location> {
  const result = await EntityResolverService.ensureEntityExists('location', name, mockState, context);
  expect(result.created).toBe(true);
  return result.entity as Location;
}

async function createNPC(name: string, context?: string): Promise<NPC> {
  const result = await EntityResolverService.ensureEntityExists('npc', name, mockState, context);
  expect(result.created).toBe(true);
  return result.entity as NPC;
}

describe('EntityResolverService generation tables', () => {
  it('only emits biome ids that exist in BIOMES', () => {
    const emitted = [
      ...ENTITY_RESOLVER_TABLES.BIOME_WORD_CUES.map(([biomeId]) => biomeId),
      ...ENTITY_RESOLVER_TABLES.BIOME_NAME_STEMS.map(([biomeId]) => biomeId),
      ENTITY_RESOLVER_TABLES.DEFAULT_BIOME_ID,
    ];

    const unknown = emitted.filter(biomeId => !BIOMES[biomeId]);
    expect(unknown).toEqual([]);
  });

  it('gives every faction type a five-rung ladder with perks on every rung', () => {
    const factionTypes = Object.keys(ENTITY_RESOLVER_TABLES.FACTION_RANK_LADDERS) as FactionType[];
    expect(factionTypes.length).toBe(7);

    for (const factionType of factionTypes) {
      const ladder = ENTITY_RESOLVER_TABLES.FACTION_RANK_LADDERS[factionType];
      expect(ladder.length).toBe(5);
      for (const rung of ladder) {
        expect(rung.perks.length).toBeGreaterThan(0);
        expect(rung.description.length).toBeGreaterThan(0);
      }
      // Every faction type the keyword table can produce must also have a disposition
      // and a trade profile, or the generator would emit an undefined field.
      expect(ENTITY_RESOLVER_TABLES.FACTION_DISPOSITIONS[factionType]).toBeDefined();
      expect(ENTITY_RESOLVER_TABLES.FACTION_TRADE_PRIORITIES[factionType].length).toBeGreaterThan(0);
    }
  });

  it('only names faction types that the ladders cover', () => {
    for (const [factionType] of ENTITY_RESOLVER_TABLES.FACTION_TYPE_KEYWORDS) {
      expect(ENTITY_RESOLVER_TABLES.FACTION_RANK_LADDERS[factionType]).toBeDefined();
    }
  });

  it('only names archetypes the personality system knows', () => {
    for (const [archetype] of ENTITY_RESOLVER_TABLES.RELATIONSHIP_ARCHETYPE_CUES) {
      expect(ARCHETYPES).toContain(archetype);
    }
  });
});

describe('EntityResolverService.createFaction (agora-02c9)', () => {
  it('infers the faction type from the name', async () => {
    expect((await createFaction('The Ashen Syndicate')).type).toBe('CRIMINAL_SYNDICATE');
    expect((await createFaction('The Order of the Pale Flame')).type).toBe('RELIGIOUS_ORDER');
    expect((await createFaction('House Ferrant')).type).toBe('NOBLE_HOUSE');
    expect((await createFaction('The Ninth Legion')).type).toBe('MILITARY');
    expect((await createFaction('The Ashfall Council')).type).toBe('GOVERNMENT');
    expect((await createFaction('The Quiet Cabal')).type).toBe('SECRET_SOCIETY');
    expect((await createFaction('The Stonecutters Guild')).type).toBe('GUILD');
  });

  it('falls back to GUILD when the name says nothing', async () => {
    const faction = await createFaction('Vethrun');
    expect(faction.type).toBe('GUILD');
  });

  it('reads the faction type out of the narrative context when the name is bare', async () => {
    const faction = await createFaction('Vethrun', 'The thieves of Vethrun run every dock in the city.');
    expect(faction.type).toBe('CRIMINAL_SYNDICATE');
  });

  it('builds a five-rung ladder with ascending levels and non-empty perks', async () => {
    const faction = await createFaction('The Stonecutters Guild');
    expect(faction.ranks.length).toBe(5);
    expect(faction.ranks.map(r => r.level)).toEqual([1, 2, 3, 4, 5]);
    for (const rank of faction.ranks) {
      expect(rank.perks.length).toBeGreaterThan(0);
      expect(rank.id).not.toBe('');
    }
  });

  it('gives each faction type its own ladder rather than one shared stub', async () => {
    const guild = await createFaction('The Stonecutters Guild');
    const syndicate = await createFaction('The Ashen Syndicate');
    expect(guild.ranks.map(r => r.id)).not.toEqual(syndicate.ranks.map(r => r.id));
  });

  it('does not share perk arrays between two factions of the same type', async () => {
    const first = await createFaction('The Stonecutters Guild');
    const second = await createFaction('The Glassblowers Guild');
    first.ranks[0].perks.push('mutation_probe');
    expect(second.ranks[0].perks).not.toContain('mutation_probe');
  });

  it('fills the values, hates, policy and trade fields the old stub left empty', async () => {
    const faction = await createFaction('The Ashen Syndicate');
    expect(faction.values.length).toBeGreaterThan(0);
    expect(faction.hates.length).toBeGreaterThan(0);
    expect(faction.tradeGoodPriorities.length).toBeGreaterThan(0);
    expect(faction.economicPolicy).toBe('exploitative');
  });

  it('rolls power inside the type band and is deterministic for a given name', async () => {
    const first = await createFaction('The Ashfall Council');
    const second = await createFaction('The Ashfall Council');
    const [min, max] = ENTITY_RESOLVER_TABLES.FACTION_DISPOSITIONS.GOVERNMENT.powerBand;

    expect(first.power).toBeGreaterThanOrEqual(min);
    expect(first.power).toBeLessThanOrEqual(max);
    expect(second.power).toBe(first.power);
    expect(second.treasury).toBe(first.treasury);
  });

  it('gives different names different rolls', async () => {
    const a = await createFaction('The Ashfall Council');
    const b = await createFaction('The Weatherstone Council');
    expect(a.treasury).not.toBe(b.treasury);
  });
});

describe('EntityResolverService.createLocation (agora-6e72)', () => {
  it('infers the biome from a terrain word in the name', async () => {
    expect((await createLocation('The Sunken Marsh')).biomeId).toBe('wetland_marsh');
    expect((await createLocation('Ashfall Caverns')).biomeId).toBe('cave');
    expect((await createLocation('Greyspire Peaks')).biomeId).toBe('mountain');
    expect((await createLocation('The Salt Dunes')).biomeId).toBe('desert');
  });

  it('infers the biome from a compound fantasy name', async () => {
    expect((await createLocation('Mirkwood')).biomeId).toBe('forest');
    expect((await createLocation('Blackmere')).biomeId).toBe('wetland_marsh');
  });

  it('infers the biome from the narrative context when the name is bare', async () => {
    const location = await createLocation('Veshen', 'You push through the dense forest until Veshen appears.');
    expect(location.biomeId).toBe('forest');
  });

  it('keeps plains as the default when nothing indicates terrain', async () => {
    const location = await createLocation('Castle Ravenloft');
    expect(location.biomeId).toBe('plains');
  });

  it('names the terrain in the generated description', async () => {
    const location = await createLocation('Ashfall Caverns');
    expect(location.baseDescription).toContain('Ashfall Caverns');
    expect(location.baseDescription.toLowerCase()).toContain(BIOMES['cave'].name.toLowerCase());
  });

  it('still emits no exits and no grid coordinates', async () => {
    const location = await createLocation('Mirkwood') as Location & { mapCoordinates?: unknown };
    expect(location.exits).toEqual({});
    expect(location.mapCoordinates).toBeUndefined();
  });
});

describe('EntityResolverService.createNPC (agora-6e72)', () => {
  it('infers the role from a trade or title word in the name', async () => {
    expect((await createNPC('Bramwell the Blacksmith')).role).toBe('merchant');
    expect((await createNPC('Sergeant Hale')).role).toBe('guard');
    expect((await createNPC('Elder Maroth')).role).toBe('quest_giver');
    expect((await createNPC('Lord Cassian')).role).toBe('unique');
  });

  it('infers the role from the narrative context when the name is bare', async () => {
    const npc = await createNPC('Hale', 'Hale is the watchman who keeps the north gate.');
    expect(npc.role).toBe('guard');
  });

  it('keeps civilian as the default for a plain name', async () => {
    const npc = await createNPC('Deralt');
    expect(npc.role).toBe('civilian');
  });

  it('seeds a full personality rather than a bare prompt line', async () => {
    const npc = await createNPC('Bramwell the Blacksmith');
    expect(npc.personality).toBeDefined();
    expect(ARCHETYPES).toContain(npc.personality!.archetype);
    expect(npc.personality!.quirks.length).toBeGreaterThan(0);
    expect(npc.personality!.traits.openness).toBeGreaterThanOrEqual(0);
    expect(npc.personality!.traits.openness).toBeLessThanOrEqual(10);
  });

  it('lets a relationship cue in the context override the archetype', async () => {
    const kin = await createNPC('Deralt', 'Deralt, your brother, waves you over.');
    const foe = await createNPC('Deralt', 'Deralt, the traitor who sold your camp, waves you over.');
    expect(kin.personality!.archetype).toBe('friendly');
    expect(foe.personality!.archetype).toBe('suspicious');
  });

  it('is deterministic for the same name', async () => {
    const first = await createNPC('Bramwell the Blacksmith');
    const second = await createNPC('Bramwell the Blacksmith');
    expect(second.personality).toEqual(first.personality);
    expect(second.initialPersonalityPrompt).toBe(first.initialPersonalityPrompt);
  });

  it('still populates the prompt fields dialogue reads', async () => {
    const npc = await createNPC('Sergeant Hale');
    expect(npc.initialPersonalityPrompt).toContain('Sergeant Hale');
    expect(npc.dialoguePromptSeed).toContain('Sergeant Hale');
    expect(npc.baseDescription).toContain('Sergeant Hale');
  });
});
