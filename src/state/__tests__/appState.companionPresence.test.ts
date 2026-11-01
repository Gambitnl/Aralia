/** Full-load presence follows the saved place, without moving known people there. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appReducer } from '../appState';
import { GamePhase } from '../../types';
import { createMockGameState, createMockPlayerCharacter } from '../../utils/core/factories';
import { COMPANIONS } from '../../data/companions';
import { authoredCompanionToRichNpc } from '../../systems/party/authoredCompanionToRichNpc';
import { LOCATIONS } from '../../data/world/locations';
import { determineActiveDynamicNpcsForLocation } from '../../utils/spatial';

const elara = COMPANIONS.elara_vance;
const kaelen = COMPANIONS.kaelen_thorne;
function savedMeeting() {
  return createMockGameState({
    currentLocationId: 'cell_3052',
    party: [createMockPlayerCharacter({ id: 'mara', name: 'Mara' })],
    companions: { elara_vance: elara, kaelen_thorne: kaelen },
    generatedNpcs: {
      elara_vance: authoredCompanionToRichNpc(elara),
      kaelen_thorne: authoredCompanionToRichNpc(kaelen),
    },
    currentLocationActiveDynamicNpcIds: ['kaelen_thorne', 'elara_vance'],
  });
}

describe('companion presence after full load', () => {
  afterEach(() => { vi.restoreAllMocks(); });
  it('leaves companions in their actual source cell through travel and an away save/load', () => {
    const original = { ...savedMeeting(), worldSeed: 77 };
    const away = appReducer(original, { type: 'MOVE_PLAYER', payload: { newLocationId: 'cell_3000', activeDynamicNpcIds: null } });
    expect(away.currentLocationActiveDynamicNpcIds).toBeNull();
    expect(away.companions.elara_vance.whereabouts).toMatchObject({worldSeed:77,locationId:'cell_3052'});
    const loaded = appReducer(createMockGameState(), { type: 'LOAD_GAME_SUCCESS', payload: JSON.parse(JSON.stringify(away)) });
    expect(loaded.currentLocationActiveDynamicNpcIds).toBeNull();
    const returned = appReducer(loaded, { type: 'MOVE_PLAYER', payload: { newLocationId: 'cell_3052', activeDynamicNpcIds: null } });
    expect(returned.currentLocationActiveDynamicNpcIds).toEqual(['elara_vance','kaelen_thorne']);
    expect(returned.companions.elara_vance.identity).toEqual(original.companions.elara_vance.identity);
  });
  it('keeps the actual meeting through Main Menu and a named Chronicle full load', () => {
    const meeting = { ...savedMeeting(), phase: GamePhase.PLAYING };
    const menu = appReducer(meeting, { type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU });
    expect(menu.currentLocationActiveDynamicNpcIds).toBe(meeting.currentLocationActiveDynamicNpcIds);
    expect(menu.generatedNpcs).toBe(meeting.generatedNpcs);
    expect(menu.currentLocationId).toBe(meeting.currentLocationId);
    expect(menu.activeConversation).toBeNull();
    const namedSave = { ...menu, phase: GamePhase.PLAYING };
    const loaded = appReducer(createMockGameState(), { type: 'LOAD_GAME_SUCCESS', payload: namedSave });
    expect(loaded.currentLocationActiveDynamicNpcIds).toEqual(['kaelen_thorne', 'elara_vance']);
  });

  it('does not populate a missing meeting just because known companions exist', () => {
    const meeting = { ...savedMeeting(), currentLocationActiveDynamicNpcIds: null };
    const menu = appReducer(meeting, { type: 'SET_GAME_PHASE', payload: GamePhase.MAIN_MENU });
    expect(menu.currentLocationActiveDynamicNpcIds).toBeNull();
  });

  it('still clears the old encounter when a new character begins', () => {
    const created = appReducer(savedMeeting(), { type: 'SET_GAME_PHASE', payload: GamePhase.CHARACTER_CREATION });
    expect(created.currentLocationActiveDynamicNpcIds).toBeNull();
  });
  it('retains the saved meeting and each person’s goals and relationship identity', () => {
    const saved = savedMeeting();
    const loaded = appReducer(createMockGameState(), { type: 'LOAD_GAME_SUCCESS', payload: saved });
    expect(loaded.currentLocationActiveDynamicNpcIds).toEqual(['kaelen_thorne', 'elara_vance']);
    expect(loaded.generatedNpcs).toBe(saved.generatedNpcs);
    expect(loaded.companions.elara_vance).toBe(elara);
    expect(loaded.companions.kaelen_thorne.goals).toBe(kaelen.goals);
    expect(loaded.currentLocationId).toBe(saved.currentLocationId);
  });

  it('does not summon known companions when the saved place has no such meeting', () => {
    const saved = { ...savedMeeting(), currentLocationActiveDynamicNpcIds: null };
    const loaded = appReducer(createMockGameState(), { type: 'LOAD_GAME_SUCCESS', payload: saved });
    expect(loaded.currentLocationActiveDynamicNpcIds).toBeNull();
    expect(loaded.companions.elara_vance).toBe(elara);
  });

  it('deduplicates present people and excludes missing records and traveling party members', () => {
    const saved = savedMeeting();
    saved.currentLocationActiveDynamicNpcIds = ['elara_vance', 'elara_vance', 'missing', 'kaelen_thorne'];
    saved.companions = { ...saved.companions, kaelen_thorne: { ...kaelen, inParty: true } };
    const loaded = appReducer(createMockGameState(), { type: 'LOAD_GAME_SUCCESS', payload: saved });
    expect(loaded.currentLocationActiveDynamicNpcIds).toEqual(['elara_vance']);
  });

  it('retains static-location compatibility for older saves without a saved list', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const location = Object.values(LOCATIONS).find(loc => loc.dynamicNpcConfig?.maxSpawnCount && loc.dynamicNpcConfig.baseSpawnChance > 0.5);
    expect(location).toBeDefined();
    const saved = { ...savedMeeting(), currentLocationId: location!.id, currentLocationActiveDynamicNpcIds: null };
    const loaded = appReducer(createMockGameState(), { type: 'LOAD_GAME_SUCCESS', payload: saved });
    expect(loaded.currentLocationActiveDynamicNpcIds).toEqual(determineActiveDynamicNpcsForLocation(location!.id, LOCATIONS));
  });

  it('does not reroll an explicitly empty saved encounter into new people', () => {
    const location = Object.values(LOCATIONS).find(loc => loc.dynamicNpcConfig);
    const saved = { ...savedMeeting(), currentLocationId: location!.id, currentLocationActiveDynamicNpcIds: [] };
    const random = vi.spyOn(Math, 'random');
    const loaded = appReducer(createMockGameState(), { type: 'LOAD_GAME_SUCCESS', payload: saved });
    expect(loaded.currentLocationActiveDynamicNpcIds).toBeNull();
    expect(random).not.toHaveBeenCalled();
  });
});
