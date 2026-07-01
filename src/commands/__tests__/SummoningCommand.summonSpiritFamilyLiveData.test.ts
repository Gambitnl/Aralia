import { describe, expect, it } from 'vitest';
import { SummoningCommand } from '../effects/SummoningCommand';
import type { CommandContext } from '../base/SpellCommand';
import type { CombatCharacter, CombatState } from '../../types/combat';
import type { SummoningEffect } from '../../types/spells';
import summonAberration from '../../../public/data/spells/level-4/summon-aberration.json';
import summonBeast from '../../../public/data/spells/level-2/summon-beast.json';
import summonCelestial from '../../../public/data/spells/level-5/summon-celestial.json';
import summonConstruct from '../../../public/data/spells/level-4/summon-construct.json';
import summonDragon from '../../../public/data/spells/level-5/summon-dragon.json';
import summonElemental from '../../../public/data/spells/level-4/summon-elemental.json';
import summonFey from '../../../public/data/spells/level-3/summon-fey.json';
import summonFiend from '../../../public/data/spells/level-6/summon-fiend.json';
import summonUndead from '../../../public/data/spells/level-3/summon-undead.json';

/**
 * This proof covers the modern summon spirit family that carries authored stat
 * blocks, chosen forms, special actions, and shared-initiative metadata.
 *
 * The generic summon runtime already supports these packets. These tests pin
 * the live behavior so later changes do not flatten the actor back into a
 * generic summon without the selected form, entity type, or spell-authored
 * action surface.
 */

type SummonSpiritCase = {
  spell: {
    id: string;
    name: string;
    effects: Array<SummoningEffect | { type: string }>;
  };
  selectedForm: string;
  entityType: string;
  statType: string;
  expectedActions: string[];
  expectedSpeeds?: Record<string, number>;
};

// These are the authored "Summon X Spirit" spells that share the same combat
// bridge: choose a form, create one allied actor, preserve its stat block, and
// expose its spell-authored action surface. Other controlled-entity spells have
// their own proof files because their cleanup or command models are different.
const summonSpiritCases: SummonSpiritCase[] = [
  {
    spell: summonAberration,
    selectedForm: 'Slaad',
    entityType: 'creature',
    statType: 'Aberration',
    expectedActions: ['Aberrant Attack'],
    expectedSpeeds: { fly: 30, swim: 30 }
  },
  {
    spell: summonBeast,
    selectedForm: 'Air',
    entityType: 'creature',
    statType: 'Beast',
    expectedActions: ['Rend'],
    expectedSpeeds: { fly: 60 }
  },
  {
    spell: summonCelestial,
    selectedForm: 'Defender',
    entityType: 'creature',
    statType: 'Celestial',
    expectedActions: ['Radiant Attack', 'Healing Touch'],
    expectedSpeeds: { fly: 40 }
  },
  {
    spell: summonConstruct,
    selectedForm: 'Stone',
    entityType: 'construct',
    statType: 'Construct',
    expectedActions: ['Slam']
  },
  {
    spell: summonDragon,
    selectedForm: 'Gem',
    entityType: 'creature',
    statType: 'Dragon',
    expectedActions: ['Multiattack', 'Breath Weapon (Recharge 5-6)'],
    expectedSpeeds: { fly: 60, swim: 30 }
  },
  {
    spell: summonElemental,
    selectedForm: 'Air',
    entityType: 'creature',
    statType: 'Elemental',
    expectedActions: ['Slam']
  },
  {
    spell: summonFey,
    selectedForm: 'Tricksy',
    entityType: 'creature',
    statType: 'Fey',
    expectedActions: ['Fey Aura'],
    expectedSpeeds: { fly: 40 }
  },
  {
    spell: summonFiend,
    selectedForm: 'Devil',
    entityType: 'creature',
    statType: 'Fiend',
    expectedActions: ['Fiendish Attack'],
    expectedSpeeds: { fly: 60 }
  },
  {
    spell: summonUndead,
    selectedForm: 'Skeletal',
    entityType: 'undead',
    statType: 'Undead',
    expectedActions: ['Deathly Touch'],
    expectedSpeeds: { fly: 40 }
  }
];

describe('SummoningCommand live summon spirit family metadata bridge', () => {
  it.each(summonSpiritCases)('preserves selected $selectedForm form metadata and stat/action data for $spell.name', ({
    spell,
    selectedForm,
    entityType,
    statType,
    expectedActions,
    expectedSpeeds
  }) => {
    const caster = {
      id: `${spell.id}-caster`,
      name: `${spell.name} Caster`,
      team: 'player',
      position: { x: 0, y: 0 },
      currentHP: 30,
      maxHP: 30
    } as unknown as CombatCharacter;
    const summonEffect = spell.effects.find(effect => effect.type === 'SUMMONING') as SummoningEffect;
    const context = {
      spellId: spell.id,
      spellName: spell.name,
      castAtLevel: Math.max(1, Number(summonEffect.scaling?.customFormula?.match(/spell level above (\d+)/)?.[1] ?? 1)),
      caster,
      targets: [],
      playerInput: selectedForm,
      gameState: {}
    } as CommandContext;
    const state = {
      characters: [caster],
      currentTurn: 1,
      round: 1,
      combatLog: []
    } as CombatState;

    const nextState = new SummoningCommand(summonEffect, context).execute(state);
    const summonedActor = nextState.characters.find(character =>
      character.isSummon &&
      character.summonMetadata?.spellId === spell.id
    );

    expect(summonedActor?.summonMetadata).toEqual(expect.objectContaining({
      spellId: spell.id,
      sourceName: spell.name,
      entityType,
      formName: selectedForm,
      initiativePolicy: 'shared',
      commandCost: 'none',
      commandsPerTurn: 1
    }));
    expect(summonedActor?.creatureTypes).toEqual(expect.arrayContaining([statType]));
    expect(summonedActor?.abilities?.map(ability => ability.name)).toEqual(expect.arrayContaining(expectedActions));

    if (expectedSpeeds) {
      expect(summonedActor?.stats.extraMovementSpeeds).toEqual(expect.objectContaining(expectedSpeeds));
    }
  });
});
