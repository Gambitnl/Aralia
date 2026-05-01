/**
 * This file tests the passive-clock gate used by App.tsx.
 *
 * The tests prove that passive one-second ticking is limited to unblocked
 * exploration. Combat and encounter-prep time are handled separately so all
 * actual world time still flows through ADVANCE_TIME.
 *
 * Called by: Vitest
 * Depends on: timekeeperUtils.ts and GamePhase
 */
import { describe, expect, it } from 'vitest';
import { GamePhase } from '../../../types';
import { shouldPassiveGameClockRun } from '../timekeeperUtils';
import type { PassiveGameClockState } from '../timekeeperUtils';

// ============================================================================
// Test State Builder
// ============================================================================
// The app has many modal flags that can pause passive time. This helper starts
// from the normal unblocked exploration state so each test can change only the
// flag it is proving.
// ============================================================================
const createOpenExplorationClockState = (overrides: Partial<PassiveGameClockState> = {}): PassiveGameClockState => ({
  phase: GamePhase.PLAYING,
  isLoading: false,
  isImageLoading: false,
  isCharacterSheetOpen: false,
  isMapVisible: false,
  isSubmapVisible: false,
  isDevMenuVisible: false,
  isGeminiLogViewerVisible: false,
  isDiscoveryLogVisible: false,
  isGlossaryVisible: false,
  isEncounterModalVisible: false,
  isNpcTestModalVisible: false,
  isLogbookVisible: false,
  isGameGuideVisible: false,
  isMerchantModalOpen: false,
  isMissingChoiceModalOpen: false,
  ...overrides,
});

// ============================================================================
// Passive Clock Rules
// ============================================================================
// These tests cover the intended world-time model: free exploration may tick
// passively, combat does not get the passive ticker, and encounter prep pauses
// because it is a blocking decision surface rather than elapsed world action.
// ============================================================================
describe('shouldPassiveGameClockRun', () => {
  it('allows passive ticking during unblocked exploration', () => {
    // In open exploration, the one-second timer can safely dispatch ADVANCE_TIME.
    expect(shouldPassiveGameClockRun(createOpenExplorationClockState())).toBe(true);
  });

  it('stops passive ticking during combat', () => {
    // Combat advances world time by completed rounds, so the real-time ticker
    // must stay off while the app phase is COMBAT.
    expect(shouldPassiveGameClockRun(createOpenExplorationClockState({
      phase: GamePhase.COMBAT,
    }))).toBe(false);
  });

  it('pauses passive ticking while the encounter-prep modal blocks play', () => {
    // The encounter modal is a player decision point before combat starts, not
    // an exploration action that should silently spend world time.
    expect(shouldPassiveGameClockRun(createOpenExplorationClockState({
      isEncounterModalVisible: true,
    }))).toBe(false);
  });
});
