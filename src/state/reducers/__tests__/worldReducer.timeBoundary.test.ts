/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/state/reducers/__tests__/worldReducer.timeBoundary.test.ts
 * Day-boundary regression tests for the ADVANCE_TIME "Chronos Loop".
 *
 * Time gap G2 (docs/projects/time/GAPS.md): world and ritual reducers mix
 * pre/post-advance timestamp usage, which makes edge-case ordering at the
 * day boundary hard to reason about. These tests are TEST-ONLY — they import
 * worldReducer and ritualReducer read-only and lock in the current, observable
 * behavior of a time step that crosses a game-day boundary, so any future
 * reordering of that pipeline (advance clock -> tick ritual -> daily sim) shows
 * up as a failed assertion rather than a silent semantic drift.
 */

import { describe, it, expect, vi } from 'vitest';
import { worldReducer } from '../worldReducer';
import { ritualReducer } from '../ritualReducer';
import { GameState } from '../../../types';
import { RitualState } from '../../../types/ritual';
import * as RitualManager from '../../../systems/rituals/RitualManager';
import { getGameDay } from '../../../utils/core';
import { createMockGameState } from '../../../utils/core/factories';
import type { AppAction } from '../../actionTypes';

// The day-boundary path calls processWorldEvents once a day rolls over. Stub it
// to a deterministic pass-through so these tests observe ONLY the clock + ritual
// ordering and never depend on the (seeded, heavy) daily world simulation.
vi.mock('../../../systems/world/WorldEventManager', () => ({
  processWorldEvents: vi.fn((state: GameState, _daysPassed: number) => ({
    state,
    logs: [],
  })),
}));

// ============================================================================
// Shared Fixtures
// ============================================================================
// A minimal-but-complete active ritual mirroring the known-good fixture in
// ritualReducer.test.ts. Progress is expressed in canonical seconds; the legacy
// display fields ride along so unit drift would surface here too.
// ============================================================================

const makeRitual = (overrides: Partial<RitualState> = {}): RitualState => ({
  id: 'ritual-boundary',
  spellId: 'spell-1',
  spellName: 'Test Spell',
  casterId: 'caster-1',
  startTime: 0,
  durationTotalSeconds: 3600,
  progressSeconds: 0,
  durationTotal: 60,
  durationUnit: 'minutes',
  progress: 0,
  participantIds: [],
  isPaused: false,
  interruptConditions: [],
  config: {
    breaksOnDamage: true,
    breaksOnMove: false,
    requiresConcentration: true,
    allowCooperation: false,
    consumptionTiming: 'end',
  },
  ...overrides,
});

// Game days are UTC-midnight aligned, so a 23:00Z start + 1h advance lands on
// 00:00Z of the next day: a clean, deterministic day-boundary crossing.
const DAY_END = '2024-01-01T23:00:00Z';
const ONE_HOUR = 3600;

const advanceAction = (seconds: number): AppAction => ({
  type: 'ADVANCE_TIME' as const,
  payload: { seconds },
});

describe('worldReducer day-boundary transition (time G2)', () => {
  it('crosses a game-day boundary when the clock ticks past UTC midnight', () => {
    const baseState = createMockGameState({ gameTime: new Date(DAY_END) });
    const result = worldReducer(baseState, advanceAction(ONE_HOUR));

    // Sanity: the fixture really does straddle a day boundary.
    expect(result.gameTime?.toISOString()).toBe('2024-01-02T00:00:00.000Z');
    expect(getGameDay(result.gameTime!)).toBe(getGameDay(baseState.gameTime) + 1);
  });

  it('advances an in-flight ritual by exactly the elapsed seconds across the boundary', () => {
    const baseState = createMockGameState({
      gameTime: new Date(DAY_END),
      // Long enough that the boundary crossing does NOT complete it.
      activeRitual: makeRitual({ durationTotalSeconds: 1_000_000, progressSeconds: 0 }),
    });

    const result = worldReducer(baseState, advanceAction(ONE_HOUR));

    // Ritual math is driven by elapsed seconds, not by day rollovers.
    expect(result.activeRitual?.progressSeconds).toBe(ONE_HOUR);
    expect(RitualManager.isRitualComplete(result.activeRitual as RitualState)).toBe(false);
  });

  it('advances the ritual by literal seconds even over a multi-day step (no per-day multiplication)', () => {
    const baseState = createMockGameState({
      gameTime: new Date('2024-01-01T12:00:00Z'),
      activeRitual: makeRitual({ durationTotalSeconds: 1_000_000, progressSeconds: 0 }),
    });

    const twoDays = 2 * 24 * 60 * 60; // 172800 seconds
    const result = worldReducer(baseState, advanceAction(twoDays));

    expect(result.gameTime?.toISOString()).toBe('2024-01-03T12:00:00.000Z');
    // The ritual sees the raw elapsed seconds, not seconds-times-daysPassed.
    expect(result.activeRitual?.progressSeconds).toBe(twoDays);
  });

  it('yields the same ritual progress whether or not the step crosses a day boundary', () => {
    // Same elapsed duration, once mid-day and once straddling midnight.
    const sameDay = worldReducer(
      createMockGameState({
        gameTime: new Date('2024-01-01T12:00:00Z'),
        activeRitual: makeRitual({ durationTotalSeconds: 1_000_000 }),
      }),
      advanceAction(ONE_HOUR),
    );
    const crossBoundary = worldReducer(
      createMockGameState({
        gameTime: new Date(DAY_END),
        activeRitual: makeRitual({ durationTotalSeconds: 1_000_000 }),
      }),
      advanceAction(ONE_HOUR),
    );

    expect(crossBoundary.activeRitual?.progressSeconds).toBe(
      sameDay.activeRitual?.progressSeconds,
    );
  });

  it('completes a ritual that finishes exactly at the day boundary and stamps the completion message with POST-advance time', () => {
    const baseState = createMockGameState({
      gameTime: new Date(DAY_END),
      // durationTotalSeconds === advance amount: completes exactly at 00:00Z.
      activeRitual: makeRitual({ durationTotalSeconds: ONE_HOUR, progressSeconds: 0 }),
    });

    const result = worldReducer(baseState, advanceAction(ONE_HOUR));

    expect(RitualManager.isRitualComplete(result.activeRitual as RitualState)).toBe(true);

    const completionMsg = result.messages?.find((m) =>
      m.text.includes('Ritual Complete'),
    );
    expect(completionMsg).toBeDefined();

    // Ordering invariant (time G2): worldReducer sets gameTime to the NEW time
    // BEFORE delegating to ritualReducer, so the completion message carries the
    // post-advance timestamp (the new day), not the old one.
    const stampedIso = completionMsg!.timestamp.toISOString();
    expect(stampedIso).toBe('2024-01-02T00:00:00.000Z');
    expect(stampedIso).toBe(result.gameTime?.toISOString());
    expect(completionMsg!.timestamp.getTime()).not.toBe(baseState.gameTime.getTime());
  });

  it('documents the divergence: ritualReducer alone stamps the PRE-advance time at the same boundary', () => {
    // Calling the ritual slice directly does NOT advance the clock, so its
    // completion message keeps the old-day timestamp. This is the "mixed
    // pre/post-advance timestamp usage" that G2 tracks — pinned here so the two
    // entry paths cannot silently converge or diverge further unnoticed.
    const baseState = createMockGameState({
      gameTime: new Date(DAY_END),
      activeRitual: makeRitual({ durationTotalSeconds: ONE_HOUR, progressSeconds: 0 }),
    });

    const directResult = ritualReducer(baseState, advanceAction(ONE_HOUR));

    expect(RitualManager.isRitualComplete(directResult.activeRitual as RitualState)).toBe(true);
    const directMsg = directResult.messages?.find((m) => m.text.includes('Ritual Complete'));
    expect(directMsg).toBeDefined();

    // Pre-advance: the ritual slice sees the state's original (old-day) gameTime.
    expect(directMsg!.timestamp.toISOString()).toBe(baseState.gameTime.toISOString());

    // And it diverges from the full-pipeline (worldReducer) stamp for the same
    // logical completion, which is exactly the ordering ambiguity G2 flags.
    const pipelineMsg = worldReducer(baseState, advanceAction(ONE_HOUR)).messages?.find((m) =>
      m.text.includes('Ritual Complete'),
    );
    expect(directMsg!.timestamp.toISOString()).not.toBe(pipelineMsg!.timestamp.toISOString());
  });

  it('leaves an already-complete ritual untouched at the boundary (idempotent, no duplicate completion message)', () => {
    const baseState = createMockGameState({
      gameTime: new Date(DAY_END),
      activeRitual: makeRitual({ durationTotalSeconds: ONE_HOUR, progressSeconds: ONE_HOUR }),
    });

    const result = worldReducer(baseState, advanceAction(ONE_HOUR));

    expect(RitualManager.isRitualComplete(result.activeRitual as RitualState)).toBe(true);
    // No fresh "Ritual Complete" message: it was already done before this tick.
    const completions = (result.messages ?? []).filter((m) => m.text.includes('Ritual Complete'));
    expect(completions).toHaveLength(0);
  });
});
