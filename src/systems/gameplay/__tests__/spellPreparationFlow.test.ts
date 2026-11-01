/** Actual reducer/handler contracts; no browser recovery is claimed by fixtures. */
import {describe, it, expect, vi} from 'vitest';
import {characterReducer} from '../../../state/reducers/characterReducer';
import {handleLongRest, handleTogglePreparedSpell} from '../../../hooks/actions/handleResourceActions';
import {spellService} from '../../../services/SpellService';
import {createMockGameState, createMockPlayerCharacter} from '../../../utils/core/factories';
import {CLASSES_DATA} from '../../../data/classes';
import {spellSlotsForClassLevel} from '../../character/spellSlotProgression';
import {togglePreparationPlan} from '../spellPreparation';
import type {AppAction} from '../../../state/actionTypes';
import type {PlayerCharacter} from '../../../types';

vi.mock('../../../hooks/actions/handleWorldEvents', () => ({
  handleResidueChecks: vi.fn(async () => {}), handleLongRestWorldEvents: vi.fn(() => ({})),
  handleGossipEvent: vi.fn(async () => {}), handleFactPropagationEvent: vi.fn(),
  handleTownRoutineEvents: vi.fn(async () => {}),
}));
const levels = {'cure-wounds': 1, bless: 1};
function planned(id: string, edition: '2014'|'2024' = '2024'): PlayerCharacter {
  const character = createMockPlayerCharacter({id, class: CLASSES_DATA.cleric, level: 3, classLevels: {cleric: 3},
    spellSlots: spellSlotsForClassLevel('cleric', 3),
    spellbook: {cantrips: [], knownSpells: ['cure-wounds'], preparedSpells: ['cure-wounds']}});
  return togglePreparationPlan(character, 'bless', levels, edition).character;
}

describe('preparation through production recovery', () => {
  it('saves a draft in the current reducer without granting immediate casting readiness', () => {
    const character = planned('cleric');
    const state = createMockGameState({party: [character]});
    const short = characterReducer(state, {type: 'SHORT_REST', payload: {}});
    expect(short.party?.[0].spellbook).toEqual(character.spellbook);
    const loaded = JSON.parse(JSON.stringify(state));
    const rested = characterReducer(loaded, {type: 'LONG_REST', payload: {}});
    expect(rested.party?.[0].spellbook?.preparedSpells).toEqual(['cure-wounds', 'bless']);
    expect(rested.party?.[0].spellbook?.preparationPlan).toBeUndefined();
    const repeated = characterReducer({...loaded, ...rested}, {type: 'LONG_REST', payload: {}});
    expect(repeated.party?.[0].spellbook?.preparedSpells).toEqual(['cure-wounds', 'bless']);
  });
  it('commits only eligible members and retains denied, downed and cooldown-refused plans', () => {
    const eligible = planned('eligible'), denied = planned('denied'), downed = {...planned('downed'), hp: 0};
    const state = createMockGameState({party: [eligible, denied, downed]});
    const rested = characterReducer(state, {type: 'LONG_REST', payload: {deniedCharacterIds: ['denied']}});
    expect(rested.party?.[0].spellbook?.preparationPlan).toBeUndefined();
    expect(rested.party?.[1]).toBe(denied);
    expect(rested.party?.[2]).toBe(downed);
    const cooldown = {...state, lastLongRestAt: state.gameTime.toISOString()};
    expect(characterReducer(cooldown, {type: 'LONG_REST'})).toBe(cooldown);
  });
  it('fails closed when direct internal toggles do not carry verified spell levels', () => {
    const character = planned('cleric');
    const state = createMockGameState({party: [character]});
    expect(characterReducer(state, {type: 'TOGGLE_PREPARED_SPELL', payload: {characterId: 'cleric', spellId: 'bless'}})).toEqual({});
  });
  it('uses canonical manifest levels for a normal public toggle and supports reset without loading it', async () => {
    const character = planned('cleric');
    const gameState = createMockGameState({party: [character]});
    const manifest = vi.spyOn(spellService, 'getAllSpellInfo').mockResolvedValue({
      bless: {name: 'Bless', level: 1, school: 'enchantment', path: 'bless.json'},
      'cure-wounds': {name: 'Cure Wounds', level: 1, school: 'abjuration', path: 'cure-wounds.json'},
    });
    const dispatch = vi.fn<(action: AppAction) => void>();
    await handleTogglePreparedSpell(dispatch, {characterId: 'cleric', spellId: 'bless'}, gameState, vi.fn());
    expect(dispatch).toHaveBeenCalledWith({type: 'TOGGLE_PREPARED_SPELL', payload: {characterId: 'cleric', spellId: 'bless', spellLevels: levels}});
    manifest.mockClear();
    await handleTogglePreparedSpell(dispatch, {characterId: 'cleric', spellId: '', resetPlan: true}, gameState, vi.fn());
    expect(manifest).not.toHaveBeenCalled();
    manifest.mockRestore();
  });
  it('advances the real long-rest handler by eight hours plus parallel 2014 preparation time', async () => {
    const member = planned('cleric', '2014');
    const gameState = createMockGameState({party: [member, {...member, id: 'other'}], rulesEdition: '2014',
      playerGroundPos: null, entry3DAnchor: null, lastLongRestAt: null});
    const dispatch = vi.fn();
    await handleLongRest({gameState, dispatch, addMessage: vi.fn(), addGeminiLog: vi.fn()});
    expect(dispatch).toHaveBeenCalledWith({type: 'ADVANCE_TIME', payload: {seconds: 8 * 3600 + 2 * 60}});
  });
});
