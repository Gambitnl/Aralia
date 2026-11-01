import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import CharacterOverview from '../CharacterOverview';
import { createMockPlayerCharacter } from '../../../../utils/core';
import { LIZARDFOLK_DATA } from '../../../../data/races/lizardfolk';
import { TABAXI_DATA } from '../../../../data/races/tabaxi';
import { MOUNTAIN_DWARF_DATA } from '../../../../data/races/mountain_dwarf';
import { ALL_ITEMS } from '../../../../data/items';

// useCharacterProficiencies pulls real class/race data; stub it to keep the
// overview render focused on the GG-7 alternate-movement-speed display.
vi.mock('../../../../hooks/useCharacterProficiencies', () => ({
  useCharacterProficiencies: () => ({
    skills: [],
    tools: [],
    armor: [],
    weapons: [],
    languages: [],
  }),
}));

describe('CharacterOverview movement speeds (GG-7)', () => {
  // GG-259 changed the reader. The overview now calls
  // `getRacialMovementSpeedsForLevel`, which resolves a character's race
  // through the shared racial trait library BY ID so it can see each trait's
  // level window. An ad-hoc race object with invented trait prose therefore no
  // longer contributes, and this case used to pin exactly that: a lizardfolk
  // record carrying a climbing sentence the canonical lizardfolk never had.
  // Both modes are still covered, now from canonical races that really grant
  // them - swim from Lizardfolk, climb from Tabaxi's Cat's Claws.
  it('renders the canonical swim speed alongside base speed', () => {
    const character = createMockPlayerCharacter({
      finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      modifiers: { advantage: [], disadvantage: [], bonuses: [] },
      skills: [],
      race: LIZARDFOLK_DATA,
    });

    render(<CharacterOverview character={character} />);

    expect(screen.getByText(/Speed:/)).toBeInTheDocument();
    expect(screen.getByText(/swim:/i)).toBeInTheDocument();
  });

  it('renders the canonical climbing speed alongside base speed', () => {
    const character = createMockPlayerCharacter({
      finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      modifiers: { advantage: [], disadvantage: [], bonuses: [] },
      skills: [],
      race: TABAXI_DATA,
    });

    render(<CharacterOverview character={character} />);

    expect(screen.getByText(/climb:/i)).toBeInTheDocument();
  });

  it('does not render the alternate-speed line when a race has walking speed only', () => {
    const character = createMockPlayerCharacter({
      finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      modifiers: { advantage: [], disadvantage: [], bonuses: [] },
      skills: [],
      race: { id: 'human', name: 'Human', description: '', traits: ['Speed: 30 feet'] },
    });

    render(<CharacterOverview character={character} />);

    expect(screen.queryByText(/swim:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/climb:/i)).not.toBeInTheDocument();
  });
it('shows heavy-armor speed penalty warning for characters with insufficient Strength (GG-19)', () => {
    const character = createMockPlayerCharacter({
      finalAbilityScores: { Strength: 10, Dexterity: 10, Constitution: 10, Intelligence: 10, Wisdom: 10, Charisma: 10 },
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      modifiers: { advantage: [], disadvantage: [], bonuses: [] },
      skills: [],
      equippedItems: {
        Torso: {
          id: 'plate-armor',
          name: 'Plate Armor',
          type: 'armor',
          slot: 'Torso',
          weight: 65,
          armorCategory: 'Heavy',
          baseArmorClass: 18,
          addsDexterityModifier: false,
          strengthRequirement: 15,
        } as any,
      },
      race: { id: 'human', name: 'Human', description: '', traits: ['Speed: 30 feet'] },
    });

    render(<CharacterOverview character={character} />);

    // The warning icon "warning" text is rendered by material-symbols-outlined
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText(/Speed:/)).toBeInTheDocument();
  });
});

it('shows the same exhausted walking speed as the combat allowance', () => {
  const character = createMockPlayerCharacter({ speed: 30, conditions: ['exhaustion'] });
  render(<CharacterOverview character={character} />);
  expect(screen.getByText('25ft')).toBeInTheDocument();
  expect(screen.getByText(/Exhaustion reduces walking speed by 5ft/)).toBeInTheDocument();
});


it('shows a timed speed bonus while preserving an honest exhaustion explanation', () => {
  const character=createMockPlayerCharacter({speed:30,conditions:['exhaustion'],statusEffects:[{
    id:'ooc-longstrider-caster',name:'Longstrider',source:'Longstrider',sourceCasterId:'caster',type:'buff',duration:600,
    effect:{type:'stat_modifier',stat:'speed',value:10},worldTime:{appliedAtMs:0,expiresAtMs:3600000},
  }]});
  render(<CharacterOverview character={character}/>);
  expect(screen.getByText('35ft')).toBeInTheDocument();
  expect(screen.getByText('Exhaustion reduces walking speed by 5ft (40ft before exhaustion).')).toBeInTheDocument();
});

it('does not warn that an explicitly exempt Mountain Dwarf loses speed to Chain Mail', () => {
  const character=createMockPlayerCharacter({race:MOUNTAIN_DWARF_DATA,speed:30,feats:[],
    finalAbilityScores:{Strength:12,Dexterity:13,Constitution:10,Intelligence:10,Wisdom:10,Charisma:10},
    equippedItems:{Torso:{...ALL_ITEMS.chain_mail}}});
  render(<CharacterOverview character={character}/>);
  expect(screen.getByText('30ft')).toBeInTheDocument();
  expect(screen.queryByText('warning')).not.toBeInTheDocument();
});

describe('earned persistent conditions on the overview', () => {
  it('shows earned exhaustion without needing a racial modifier or an extra click', () => {
    const character=createMockPlayerCharacter({speed:30,conditions:['exhaustion'],modifiers:{advantage:[],disadvantage:[],bonuses:[]}});
    const original=JSON.stringify(character);
    render(<CharacterOverview character={character}/>);
    expect(screen.getByText('Exhaustion (level 1)')).toBeVisible();
    expect(screen.getByText('25ft')).toBeVisible();
    expect(JSON.stringify(character)).toBe(original);
  });

  it('uses the shared highest exhaustion level while retaining other saved conditions', () => {
    const character=createMockPlayerCharacter({speed:30,conditions:['exhaustion','exhaustion_2','fatigued'],modifiers:{advantage:[],disadvantage:[],bonuses:[]}});
    render(<CharacterOverview character={character}/>);
    expect(screen.getAllByText('Exhaustion (level 2)')).toHaveLength(1);
    expect(screen.getByText('Fatigued')).toBeVisible();
    expect(screen.getByText('20ft')).toBeVisible();
  });

  it('does not invent an active condition for an unaffected character', () => {
    render(<CharacterOverview character={createMockPlayerCharacter({conditions:[],modifiers:{advantage:[],disadvantage:[],bonuses:[]}})}/>);
    expect(screen.queryByText('Active conditions')).not.toBeInTheDocument();
    expect(screen.queryByText(/Exhaustion \(level/)).not.toBeInTheDocument();
  });
});

it('shows exhausted save and spell attack totals while retaining the spell DC and scores',()=>{
 const character=createMockPlayerCharacter({speed:30,conditions:['exhaustion'],spellcastingAbility:'wisdom',
  finalAbilityScores:{Strength:13,Dexterity:12,Constitution:14,Intelligence:8,Wisdom:16,Charisma:10},
  class:{...createMockPlayerCharacter().class,savingThrowProficiencies:['Wisdom','Charisma']}});
 const {container}=render(<CharacterOverview character={character}/>);
 const saves=Array.from(container.querySelectorAll('h4')).find(e=>e.textContent?.includes('Saving Throws'))?.parentElement;
 expect(saves?.textContent).toContain('Con: +0');expect(saves?.textContent).toContain('Wis: +3');
 const spellcasting=Array.from(container.querySelectorAll('h4')).find(e=>e.textContent?.includes('Spellcasting'))?.parentElement;
 expect(spellcasting?.textContent).toContain('Save DC13');expect(spellcasting?.textContent).toContain('Attack+3');
 expect(screen.getByText('Exhaustion subtracts 2 from D20 tests: attacks, checks and saves.')).toBeVisible();
});
