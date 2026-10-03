import { describe, expect, it } from 'vitest';
import { appReducer } from '../appState';
import { GamePhase } from '../../types';
import { CrimeType } from '../../types/crime';
import { createMockGameState } from '../../utils/core/factories';
import type { GameEntryState, OpeningSituation } from '../../systems/gameEntry/types';
import type { CombatEnemySnapshotEntry } from '../../types/combat';

/**
 * agora-31fa: the watch reaction used to hard-code `watchNpcDied: false`, so
 * every won fight against the town watch was charged as Assault no matter how
 * it ended. END_BATTLE now carries the final enemy roster, and the recorded
 * crime follows the real outcome: a dead watchman makes it Murder.
 *
 * Lethality is read per COMBATANT rather than per scene-NPC id, because a
 * hostile opening spawns its watch as bestiary monsters (threatToMonsters), so
 * the scene NPC ids never reach the battle map.
 */

const WATCH_SITUATION: OpeningSituation = {
  setting: { place: 'the market', timeOfDay: 'dawn', weather: 'clear' },
  predicament: 'Two guards block your path.',
  npcs: [
    { id: 'situation-npc-guard', name: 'Corwin Dain', role: 'city guard', disposition: 'hostile', goal: 'seize the goods' },
  ],
  openingLine: { speakerId: 'situation-npc-guard', text: 'Come with us.' },
  threat: {
    hostile: true,
    enemies: [{ name: 'Guard', quantity: 2, cr: '1/8' }],
    deEscalationDC: 12,
    tension: 'accusation of theft',
  },
};

function inSituationEntry(situation: OpeningSituation): GameEntryState {
  return {
    status: 'in-situation',
    situation,
    error: null,
    sceneImage: { status: 'idle', url: null, error: null },
  };
}

const watchFightState = () =>
  createMockGameState({
    phase: GamePhase.COMBAT,
    currentLocationId: 'village-center',
    gameEntry: inSituationEntry(WATCH_SITUATION),
  });

const enemy = (id: string, currentHP: number): CombatEnemySnapshotEntry => ({
  id,
  currentHP,
  position: { x: 0, y: 0 },
});

const REWARDS = { gold: 0, items: [], xp: 50 };

describe('END_BATTLE watch-fight lethality (agora-31fa)', () => {
  it('records Murder when a watch combatant ended the fight at 0 HP', () => {
    const next = appReducer(watchFightState(), {
      type: 'END_BATTLE',
      payload: {
        rewards: REWARDS,
        finalEnemyState: [enemy('guard-1', 0), enemy('guard-2', 3)],
      },
    });

    const crimes = next.notoriety.knownCrimes;
    expect(crimes).toHaveLength(1);
    expect(crimes[0]?.type).toBe(CrimeType.Murder);
    expect(crimes[0]?.locationId).toBe('village-center');
  });

  it('records Assault when every watch combatant survived the beating', () => {
    const next = appReducer(watchFightState(), {
      type: 'END_BATTLE',
      payload: {
        rewards: REWARDS,
        finalEnemyState: [enemy('guard-1', 2), enemy('guard-2', 5)],
      },
    });

    expect(next.notoriety.knownCrimes).toHaveLength(1);
    expect(next.notoriety.knownCrimes[0]?.type).toBe(CrimeType.Assault);
  });

  it('treats a negative final HP as a kill, not as a survivor', () => {
    const next = appReducer(watchFightState(), {
      type: 'END_BATTLE',
      payload: { rewards: REWARDS, finalEnemyState: [enemy('guard-1', -7)] },
    });

    expect(next.notoriety.knownCrimes[0]?.type).toBe(CrimeType.Murder);
  });

  it('falls back to Assault when no enemy roster reached the reducer', () => {
    const next = appReducer(watchFightState(), {
      type: 'END_BATTLE',
      payload: { rewards: REWARDS },
    });

    expect(next.notoriety.knownCrimes[0]?.type).toBe(CrimeType.Assault);
  });

  it('tells the player the watch is dead rather than merely beaten', () => {
    const next = appReducer(watchFightState(), {
      type: 'END_BATTLE',
      payload: { rewards: REWARDS, finalEnemyState: [enemy('guard-1', 0)] },
    });

    const texts = next.messages.map(m => m.text);
    expect(texts.some(t => t.includes('The watch lies dead'))).toBe(true);
    expect(texts.some(t => t.includes('The watch is beaten'))).toBe(false);
  });

  it('logs the killing rather than the brawl in the adventure log', () => {
    const next = appReducer(watchFightState(), {
      type: 'END_BATTLE',
      payload: { rewards: REWARDS, finalEnemyState: [enemy('guard-1', 0)] },
    });

    const summaries = (next.adventureLog ?? []).map(entry => entry.summary);
    expect(summaries).toContain('Killed a member of the town watch — you are now wanted here.');
  });

  it('records nothing when the beaten strangers were not the watch', () => {
    const bandits: OpeningSituation = {
      ...WATCH_SITUATION,
      npcs: [{ id: 'bandit-1', name: 'Scar', role: 'bandit', disposition: 'hostile', goal: 'rob you' }],
    };
    const next = appReducer(
      createMockGameState({
        phase: GamePhase.COMBAT,
        currentLocationId: 'village-center',
        gameEntry: inSituationEntry(bandits),
      }),
      {
        type: 'END_BATTLE',
        payload: { rewards: REWARDS, finalEnemyState: [enemy('bandit-combatant-1', 0)] },
      },
    );

    expect(next.notoriety.knownCrimes).toHaveLength(0);
  });
});
