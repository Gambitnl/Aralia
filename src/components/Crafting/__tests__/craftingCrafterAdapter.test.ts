import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createCraftingCrafter, resolveCraftingCrafter } from '../crafterAdapter';
import { PlayerCharacter } from '../../../types';

vi.mock('../../../utils/combatUtils', () => ({
  rollDice: vi.fn(() => 10),
}));

const makeCharacter = (overrides: Partial<PlayerCharacter> = {}): PlayerCharacter => ({
  id: 'hero-1',
  name: 'Hero One',
  level: 5,
  proficiencyBonus: 3,
  abilityScores: {
    Strength: 10,
    Dexterity: 14,
    Constitution: 12,
    Intelligence: 16,
    Wisdom: 11,
    Charisma: 8,
  },
  finalAbilityScores: {
    Strength: 10,
    Dexterity: 14,
    Constitution: 12,
    Intelligence: 16,
    Wisdom: 11,
    Charisma: 8,
  },
  skills: [{ id: 'nature', name: 'Nature', ability: 'Intelligence' }],
  toolProficiencies: ['Herbalism Kit'],
  featChoices: {
    herbalist: {
      selectedTools: ["Poisoner's Kit"],
    },
  },
  race: { id: 'human', name: 'Human', description: '', traits: [] },
  class: {
    id: 'wizard',
    name: 'Wizard',
    description: '',
    hitDie: 6,
    primaryAbility: ['Intelligence'],
    savingThrowProficiencies: [],
    skillProficienciesAvailable: [],
    numberOfSkillProficiencies: 0,
    armorProficiencies: [],
    weaponProficiencies: [],
    features: [],
  },
  statusEffects: [],
  hp: 10,
  maxHp: 10,
  armorClass: 10,
  speed: 30,
  darkvisionRange: 0,
  transportMode: 'foot',
  equippedItems: {},
  ...overrides,
});

describe('craftingCrafterAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers the selected character when the gathering panel passes one in', () => {
    const selected = makeCharacter({ id: 'sheet-hero', name: 'Sheet Hero' });
    const lead = makeCharacter({ id: 'party-lead', name: 'Party Lead' });

    const result = resolveCraftingCrafter(
      {
        party: [lead],
        characterSheetModal: { isOpen: true, character: selected },
      },
      { selectedCharacter: selected, allowCharacterSheetSelection: true }
    );

    expect(result.sourceLabel).toBe('selected_character');
    expect(result.sourceCharacter).toBe(selected);
    expect(result.crafter.id).toBe('sheet-hero');
    expect(result.crafter.name).toBe('Sheet Hero');
  });

  it('falls back to the party lead when no selected character is supplied', () => {
    const lead = makeCharacter({ id: 'party-lead', name: 'Party Lead' });
    const selected = makeCharacter({ id: 'sheet-hero', name: 'Sheet Hero' });

    const result = resolveCraftingCrafter(
      {
        party: [lead],
        characterSheetModal: { isOpen: true, character: selected },
      },
      { allowCharacterSheetSelection: false }
    );

    expect(result.sourceLabel).toBe('party_lead');
    expect(result.sourceCharacter).toBe(lead);
  });

  it('uses the real character stats and proficiency for skill and tool checks', () => {
    const crafter = createCraftingCrafter(makeCharacter());

    expect(crafter.rollSkill('Nature')).toBe(16);
    expect(crafter.rollSkill('Herbalism Kit')).toBe(16);
    expect(crafter.rollSkill("Poisoner's Kit")).toBe(16);
    expect(crafter.rollSkill('Sleight of Hand')).toBe(12);
  });
});
