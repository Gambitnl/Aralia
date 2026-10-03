/**
 * @file src/state/reducers/__tests__/dialogueReducer.test.ts
 * Session lifecycle for the dialogue reducer, and the DIAL-003 guard.
 *
 * Written for agora-f821.22. `DialogueSession` carried two fields that were
 * seeded here and read nowhere — `availableTopicIds` and `sessionDispositionMod`.
 * They were removed rather than wired, because the behavior they looked like
 * they controlled is recomputed elsewhere on every render. A type alone does not
 * stop a later edit from re-seeding a stale copy, so the shape is asserted here
 * at runtime.
 */

import { describe, it, expect } from 'vitest';
import { dialogueReducer } from '../dialogueReducer';
import type { AppAction } from '../../actionTypes';
import type { GameState } from '../../../types';

const emptyState = {} as GameState;

describe('dialogueReducer', () => {
  it('opens a session holding only the NPC and the discussed-topic list (DIAL-003)', () => {
    const next = dialogueReducer(emptyState, {
      type: 'START_DIALOGUE_SESSION',
      payload: { npcId: 'old_hermit' },
    } as AppAction);

    expect(next.isDialogueInterfaceOpen).toBe(true);
    expect(next.activeDialogueSession).toEqual({
      npcId: 'old_hermit',
      discussedTopicIds: [],
    });

    // `toEqual` above already fails on an extra key, but naming the two dead
    // fields makes the reason a later reader sees be the right one.
    const keys = Object.keys(next.activeDialogueSession!);
    expect(keys).not.toContain('availableTopicIds');
    expect(keys).not.toContain('sessionDispositionMod');
  });

  it('replaces the session wholesale on update', () => {
    const session = { npcId: 'old_hermit', discussedTopicIds: ['topic_weather'] };
    const next = dialogueReducer(emptyState, {
      type: 'UPDATE_DIALOGUE_SESSION',
      payload: { session },
    } as AppAction);

    expect(next.activeDialogueSession).toBe(session);
    // Update touches the session only; it must not reopen or close the modal.
    expect(next.isDialogueInterfaceOpen).toBeUndefined();
  });

  it('clears the session and closes the interface on end', () => {
    const next = dialogueReducer(emptyState, { type: 'END_DIALOGUE_SESSION' } as AppAction);

    expect(next.activeDialogueSession).toBeNull();
    expect(next.isDialogueInterfaceOpen).toBe(false);
  });

  it('returns an empty patch for actions it does not own', () => {
    // The root reducer merges every slice's patch, so an unrelated action has to
    // contribute nothing rather than re-assert a stale session.
    expect(dialogueReducer(emptyState, { type: 'ADD_MET_NPC', payload: { npcId: 'x' } } as AppAction)).toEqual({});
  });
});
