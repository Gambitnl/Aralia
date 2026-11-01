import {describe, it, expect} from 'vitest';
import {CLASSES_DATA} from '../../../data/classes';
import {createMockPlayerCharacter} from '../../../utils/core/factories';
import {spellSlotsForClassLevel} from '../../character/spellSlotProgression';
import {completePreparation, preparationMinutes, preparationPlanError, preparationSpellError, togglePreparationPlan, usesRestPreparation} from '../spellPreparation';
import type {PlayerCharacter} from '../../../types';

function caster(classId = 'paladin', level = 1, active = ['detect-evil-and-good', 'cure-wounds']): PlayerCharacter {
  return createMockPlayerCharacter({class: CLASSES_DATA[classId], classLevels: {[classId]: level}, level,
    spellSlots: spellSlotsForClassLevel(classId, level),
    spellbook: {preparedSpells: active, knownSpells: [...active], cantrips: []}});
}
const levels = {'detect-evil-and-good': 1, 'cure-wounds': 1, bless: 1, 'shield-of-faith': 1, 'magic-missile': 1, shield: 1};
function replace(character: PlayerCharacter, from: string, to: string, edition: '2024'|'2014' = '2024') {
  const removed = togglePreparationPlan(character, from, levels, edition);
  expect(removed.error).toBeUndefined();
  const added = togglePreparationPlan(removed.character, to, levels, edition);
  expect(added.error).toBeUndefined();
  return added.character;
}

describe('saved preparation plans', () => {
  it('keeps active casting choices until a complete plan is committed after rest', () => {
    const before = caster();
    const planned = replace(before, 'detect-evil-and-good', 'bless');
    expect(planned.spellbook?.preparedSpells).toEqual(before.spellbook?.preparedSpells);
    expect(planned.spellbook?.preparationPlan?.preparedSpells).toEqual(['cure-wounds', 'bless']);
    const restored = JSON.parse(JSON.stringify(planned));
    const after = completePreparation(restored, '2024');
    expect(after.spellbook?.preparedSpells).toEqual(['cure-wounds', 'bless']);
    expect(after.spellbook?.preparationPlan).toBeUndefined();
    expect(completePreparation(after, '2024')).toBe(after);
  });
  it('retains an incomplete replacement and refuses a second replacement', () => {
    const removed = togglePreparationPlan(caster(), 'detect-evil-and-good', levels, '2024').character;
    expect(preparationPlanError(removed, removed.spellbook!.preparationPlan!, '2024')).toMatch(/replacement/);
    expect(completePreparation(removed, '2024')).toBe(removed);
    const planned = replace(caster(), 'detect-evil-and-good', 'bless');
    expect(togglePreparationPlan(planned, 'cure-wounds', levels, '2024').error).toMatch(/one spell/);
  });
  it('lets a player undo or reset a draft without changing the active list', () => {
    const before = caster();
    const removed = togglePreparationPlan(before, 'detect-evil-and-good', levels, '2024').character;
    expect(togglePreparationPlan(removed, 'detect-evil-and-good', levels, '2024').character.spellbook?.preparationPlan).toBeUndefined();
    const planned = replace(before, 'detect-evil-and-good', 'bless');
    const reset = togglePreparationPlan(planned, '', levels, '2024', true).character;
    expect(reset.spellbook).toEqual(before.spellbook);
  });
  it('rejects wrong source, cantrips, unavailable levels and unlearned wizard spells', () => {
    expect(preparationSpellError(caster(), 'magic-missile', 1, '2024')).toMatch(/class list/);
    expect(preparationSpellError(caster(), 'light', 0, '2024')).toMatch(/leveled/);
    expect(preparationSpellError(caster(), 'revivify', 3, '2024')).toMatch(/above/);
    const wizard = caster('wizard', 1, ['magic-missile']);
    expect(preparationSpellError(wizard, 'shield', 1, '2024')).toMatch(/learn/);
    expect(preparationSpellError(wizard, 'magic-missile', 1, '2024')).toBeNull();
  });
  it('uses class level rather than total multiclass level or aggregate slots', () => {
    const multiclass = {...caster('paladin', 1), level: 10, classLevels: {paladin: 1, wizard: 9}, spellSlots: spellSlotsForClassLevel('wizard', 9)};
    expect(preparationSpellError(multiclass, 'revivify', 3, '2024')).toMatch(/above/);
  });
  it('retains a plan when saved active spells or the campaign edition have changed', () => {
    const planned = replace(caster(), 'detect-evil-and-good', 'bless');
    expect(completePreparation(planned, '2014')).toBe(planned);
    const stale = {...planned, spellbook: {...planned.spellbook!, preparedSpells: ['shield-of-faith', 'cure-wounds']}};
    expect(completePreparation(stale, '2024')).toBe(stale);
  });
  it('treats Ranger as daily preparation only in 2024 and leaves level-up casters alone', () => {
    expect(usesRestPreparation(caster('ranger'), '2024')).toBe(true);
    expect(usesRestPreparation(caster('ranger'), '2014')).toBe(false);
    for (const id of ['bard', 'sorcerer', 'warlock']) expect(usesRestPreparation(caster(id), '2024')).toBe(false);
  });
  it('accounts for 2014 study from the entire new list, with verified spell levels', () => {
    const cleric = caster('cleric', 3, ['cure-wounds']);
    const planned = togglePreparationPlan(cleric, 'bless', levels, '2014').character;
    expect(preparationMinutes(planned, '2014')).toBe(2);
    const unknown = {...planned, spellbook: {...planned.spellbook!, preparationPlan: {...planned.spellbook!.preparationPlan!, spellLevels: {bless: 1}}}};
    expect(preparationMinutes(unknown, '2014')).toBe(0);
    expect(completePreparation(unknown, '2014')).toBe(unknown);
  });
  it('never grants 2014 Paladin spellcasting at level one', () => {
    expect(preparationSpellError(caster(), 'bless', 1, '2014')).toMatch(/level 2/);
  });
});
