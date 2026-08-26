/**
 * Reducer-owned race draft (agora-b6fc).
 *
 * The race step used to mirror the creator draft into component state and
 * re-synchronize it from an effect. These cases pin the behavior that mirror
 * provided, now that the draft is derived: a race's saved choices are read back
 * for that race alone, an edit against a stale key rebases onto the current
 * race instead of writing the old race's answer into it, and the rendered step
 * still confirms with the choices the player can see.
 *
 * Called by: the focused Vitest character-creation verification.
 * Depends on: the exported race-draft reducer and the rendered RaceSelection.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Race, RacialSelectionData } from '../../../../types';
import RaceSelection, {
  buildRaceDraft,
  createRaceDraftState,
  isSameRaceDraftKey,
  raceDraftReducer,
  type RaceDraftKey,
} from '../RaceSelection';

const changeling: Race = {
  id: 'changeling',
  name: 'Changeling',
  description: 'A fey shapechanger with adaptable instincts.',
  traits: ['Creature Type: Fey', 'Changeling Instincts: Choose two social skills.'],
};

const kenku: Race = {
  id: 'kenku',
  name: 'Kenku',
  description: 'A mimic of voices and craft.',
  traits: ['Creature Type: Humanoid', 'Kenku Recall: Choose two skills.'],
};

const keyFor = (
  race: Race | undefined,
  racialSelections: Record<string, RacialSelectionData> = {},
): RaceDraftKey => ({ raceId: race?.id ?? null, race, racialSelections });

describe('buildRaceDraft', () => {
  it('reads back the saved choices of the race being viewed', () => {
    const draft = buildRaceDraft(keyFor(changeling, {
      changeling: { skillIds: ['deception', 'insight'], size: 'Small' },
    }));

    expect(draft.changelingInstinctSkillIds).toEqual(new Set(['deception', 'insight']));
    expect(draft.changelingSize).toBe('Small');
    // Changeling collects its skills through a dedicated control, so the
    // generic store stays empty rather than offering the same choice twice.
    expect(draft.skillIds).toEqual([]);
  });

  it('leaves another race\'s choices out of the viewed race', () => {
    const draft = buildRaceDraft(keyFor(kenku, {
      changeling: { skillIds: ['deception', 'insight'], size: 'Small' },
      elf: { skillIds: ['perception'] },
    }));

    expect(draft.changelingInstinctSkillIds.size).toBe(0);
    expect(draft.changelingSize).toBeNull();
    expect(draft.keenSensesSkillId).toBeNull();
    expect(draft.skillIds).toEqual([]);
  });

  it('gives the elf family its Keen Senses skill from the elf store', () => {
    const woodElf: Race = {
      id: 'wood_elf',
      name: 'Wood Elf',
      baseRace: 'elf',
      description: 'An elf of the deep woods.',
      traits: ['Keen Senses: Choose one skill.'],
    };

    expect(buildRaceDraft(keyFor(woodElf, { elf: { skillIds: ['perception'] } })).keenSensesSkillId)
      .toBe('perception');
  });
});

describe('raceDraftReducer', () => {
  it('records an edit against the key it was made on', () => {
    const key = keyFor(kenku);
    const next = raceDraftReducer(createRaceDraftState(key), {
      key,
      field: 'skillIds',
      id: 'stealth',
      maxChoices: 2,
    });

    expect(next.draft.skillIds).toEqual(['stealth']);
    expect(isSameRaceDraftKey(next.key, key)).toBe(true);
  });

  it('rebases an edit whose key has moved on', () => {
    const kenkuKey = keyFor(kenku);
    const edited = raceDraftReducer(createRaceDraftState(kenkuKey), {
      key: kenkuKey,
      field: 'skillIds',
      id: 'stealth',
      maxChoices: 2,
    });

    // The player has switched to Changeling; the stored Kenku skill must not
    // survive into the new race's draft.
    const changelingKey = keyFor(changeling);
    const next = raceDraftReducer(edited, {
      key: changelingKey,
      field: 'changelingSize',
      value: 'Medium',
    });

    expect(next.draft.skillIds).toEqual([]);
    expect(next.draft.changelingSize).toBe('Medium');
  });

  it('drops a chosen entry and refuses one past the cap', () => {
    const key = keyFor(kenku);
    const toggle = (state: ReturnType<typeof createRaceDraftState>, id: string) =>
      raceDraftReducer(state, { key, field: 'skillIds', id, maxChoices: 2 });

    let state = toggle(createRaceDraftState(key), 'stealth');
    state = toggle(state, 'acrobatics');
    state = toggle(state, 'arcana');
    expect(state.draft.skillIds).toEqual(['stealth', 'acrobatics']);

    state = toggle(state, 'stealth');
    expect(state.draft.skillIds).toEqual(['acrobatics']);
  });

  it('caps Changeling Instincts at two skills', () => {
    const key = keyFor(changeling);
    const toggle = (state: ReturnType<typeof createRaceDraftState>, skillId: string) =>
      raceDraftReducer(state, { key, field: 'changelingInstinctSkillIds', skillId });

    let state = toggle(createRaceDraftState(key), 'deception');
    state = toggle(state, 'insight');
    state = toggle(state, 'persuasion');

    expect(state.draft.changelingInstinctSkillIds).toEqual(new Set(['deception', 'insight']));
  });
});

describe('RaceSelection rendered draft', () => {
  it('confirms the saved Changeling choices without an effect to restore them', () => {
    const onRaceSelect = vi.fn();

    render(
      <RaceSelection
        races={[changeling, kenku]}
        selectedRaceId="changeling"
        racialSelections={{ changeling: { skillIds: ['deception', 'insight'], size: 'Small' } }}
        onRaceSelect={onRaceSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Changeling' }));

    expect(onRaceSelect).toHaveBeenCalledWith('changeling', {
      changelingInstinctSkillIds: ['deception', 'insight'],
      changelingSize: 'Small',
    });
  });

  it('blocks confirm for the race in view after switching away from a ready one', () => {
    const onRaceSelect = vi.fn();

    render(
      <RaceSelection
        races={[changeling, kenku]}
        selectedRaceId="changeling"
        racialSelections={{ changeling: { skillIds: ['deception', 'insight'], size: 'Small' } }}
        onRaceSelect={onRaceSelect}
      />,
    );

    // Kenku needs two skills of its own, so the Changeling answers must not
    // carry over and satisfy its gate.
    fireEvent.click(screen.getByRole('button', { name: 'Kenku' }));

    const confirmKenku = screen.getByRole('button', { name: 'Confirm Kenku' });
    expect(confirmKenku).toBeDisabled();
    fireEvent.click(confirmKenku);
    expect(onRaceSelect).not.toHaveBeenCalled();
  });
});
