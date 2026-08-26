/**
 * @file src/hooks/combat/__tests__/useCombatMessaging.notifications.test.tsx
 * @created 2026-09-09 (CMB-GAP-004 / CMB-GAP-005)
 *
 * End-to-end proof for the NOTIFICATION message channel.
 *
 * WHY THIS TEST EXISTS: MessageChannel.NOTIFICATION was declared on combat messages for
 * months and read by nothing, which made the documented channel model decorative. Asserting
 * only that a message carries the channel would repeat that mistake, so this test drives the
 * real path instead: a combat log record -> convertLogEntryToMessage -> useCombatMessaging
 * -> ADD_NOTIFICATION -> the real uiReducer -> the real NotificationSystem toast in the DOM.
 *
 * It also pins the negative case. Routine damage carries the same channel but sits below
 * NOTIFICATION_PRIORITY_FLOOR, and must NOT produce a toast, otherwise a normal round would
 * bury the screen.
 */
import React, { useEffect, useReducer } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { GameProvider } from '../../../state/GameContext';
import { uiReducer } from '../../../state/reducers/uiReducer';
import { NotificationSystem } from '../../../components/ui/NotificationSystem';
import { useCombatMessaging } from '../useCombatMessaging';
import { convertLogEntryToMessage } from '../../../utils/combat/combatLogToMessageAdapter';
import type { AppAction } from '../../../state/actionTypes';
import type { GameState } from '../../../types';
import type { CombatCharacter, CombatLogEntry } from '../../../types/combat';

const characters = [
  { id: 'fighter', name: 'Fighter' },
  { id: 'goblin', name: 'Goblin' },
] as CombatCharacter[];

/**
 * A deliberately tiny slice of GameState. The messaging hook only ever reaches for
 * `dispatch`, and NotificationSystem only reads `notifications`, so standing up the full
 * game state here would add noise without adding coverage.
 */
type NotificationSlice = { notifications: GameState['notifications'] };

function notificationsOnlyReducer(state: NotificationSlice, action: AppAction): NotificationSlice {
  const patch = uiReducer(state as unknown as GameState, action);
  return { ...state, ...(patch as Partial<NotificationSlice>) };
}

/**
 * Harness: feeds one combat log entry through the adapter into the messaging hook on mount,
 * and renders the app's real toast surface from the resulting state.
 */
const CombatToastHarness: React.FC<{ entry: CombatLogEntry }> = ({ entry }) => {
  const [state, dispatch] = useReducer(notificationsOnlyReducer, { notifications: [] });

  return (
    <GameProvider state={state as unknown as GameState} dispatch={dispatch}>
      <MessageEmitter entry={entry} />
      <NotificationSystem notifications={state.notifications} dispatch={dispatch} />
    </GameProvider>
  );
};

const MessageEmitter: React.FC<{ entry: CombatLogEntry }> = ({ entry }) => {
  const messaging = useCombatMessaging();

  useEffect(() => {
    messaging.addMessage(convertLogEntryToMessage(entry, characters));
    // Emitting once on mount is the whole point of the harness; re-running on every
    // messaging identity change would duplicate the toast and hide a regression.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

describe('NOTIFICATION channel consumption (CMB-GAP-005)', () => {
  it('raises a real toast for a killing blow', async () => {
    const kill: CombatLogEntry = {
      id: 'kill-e2e',
      timestamp: 1,
      type: 'damage',
      message: 'Goblin takes 9 slashing damage from Fighter and is defeated!',
      characterId: 'goblin',
      data: { damage: 9, damageType: 'slashing', source: 'Fighter', isDeath: true },
    };

    render(<CombatToastHarness entry={kill} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.getByText(kill.message)).toBeTruthy();
  });

  it('stays silent for routine damage that carries the same channel', async () => {
    const routine: CombatLogEntry = {
      id: 'routine-e2e',
      timestamp: 2,
      type: 'damage',
      message: 'Goblin takes 3 piercing damage from Fighter.',
      characterId: 'goblin',
      data: { damage: 3, damageType: 'piercing', source: 'Fighter' },
    };

    render(<CombatToastHarness entry={routine} />);

    // Give the effect and any state flush a chance to run before asserting absence.
    await waitFor(() => {
      expect(screen.queryByText(routine.message)).toBeNull();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
