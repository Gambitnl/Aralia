/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/__tests__/RelationshipManager.test.ts
 * Tests for the RelationshipManager system.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { RelationshipManager } from '../RelationshipManager';
import { createMockCompanion } from '../../../utils/character';

/**
 * These tests prove companion approval thresholds, history, unlock safety, and
 * romance hysteresis without relying on the host machine clock. Each approval
 * event receives an explicit point on the game's saved timeline.
 */
describe('RelationshipManager', () => {
  const eventTime = Date.UTC(351, 0, 1, 7, 0, 0);
  const oneHourMs = 60 * 60 * 1000;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should initialize relationship if not present', () => {
    const companion = createMockCompanion();
    const playerId = 'player-1';

    const updatedCompanion = RelationshipManager.processApprovalEvent(
      companion,
      playerId,
      10,
      'Helped them up',
      eventTime
    );

    expect(updatedCompanion.relationships[playerId]).toBeDefined();
    expect(updatedCompanion.relationships[playerId].approval).toBe(10);
    expect(updatedCompanion.relationships[playerId].level).toBe('stranger');
  });

  it('should cap approval at -500 and 500', () => {
    // The runtime contract spans the full -500..500 range, so the clamp and the
    // top/bottom relationship levels need to line up on fresh companion states.
    const playerId = 'player-1';

    let updated = RelationshipManager.processApprovalEvent(
      createMockCompanion(),
      playerId,
      700,
      'Did everything right',
      eventTime
    );
    expect(updated.relationships[playerId].approval).toBe(500);
    expect(updated.relationships[playerId].level).toBe('romance');

    updated = RelationshipManager.processApprovalEvent(
      createMockCompanion(),
      playerId,
      -1200,
      'Did everything wrong',
      eventTime
    );
    expect(updated.relationships[playerId].approval).toBe(-500);
    expect(updated.relationships[playerId].level).toBe('hated');
  });

  it('should change relationship level based on thresholds', () => {
    const companion = createMockCompanion();
    const playerId = 'player-1';

    // Default 0 -> Stranger
    // Relationship thresholds shift by 100-point increments.
    let updated = RelationshipManager.processApprovalEvent(
      companion,
      playerId,
      240,
      'Became friend',
      eventTime
    );
    expect(updated.relationships[playerId].level).toBe('friend'); // 240 is in [200, 299]

    updated = RelationshipManager.processApprovalEvent(
      updated,
      playerId,
      -520,
      'Betrayal',
      eventTime + oneHourMs
    );
    // 240 - 520 = -280
    // -280 is in rival range [-300, -201]
    expect(updated.relationships[playerId].approval).toBe(-280);
    expect(updated.relationships[playerId].level).toBe('rival');
  });

  it('should record history when level changes', () => {
    const companion = createMockCompanion();
    const playerId = 'player-1';

    const updated = RelationshipManager.processApprovalEvent(
      companion,
      playerId,
      240,
      'Became friend',
      eventTime
    );

    const history = updated.relationships[playerId].history;
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1].description).toContain('Relationship changed from stranger to friend');
  });

  it('should still generate event ids when crypto.randomUUID is unavailable', () => {
    // This forces the companion slice onto the shared fallback path instead of
    // relying on a browser/Node UUID API that may not exist in older runtimes.
    vi.stubGlobal('crypto', undefined);

    const companion = createMockCompanion();
    const playerId = 'player-1';

    const updated = RelationshipManager.processApprovalEvent(
      companion,
      playerId,
      240,
      'Became friend',
      eventTime
    );
    const relationship = updated.relationships[playerId];

    expect(updated.approvalHistory[0].id).toEqual(expect.any(String));
    expect(updated.approvalHistory[0].id.length).toBeGreaterThan(0);
    expect(relationship.history[0].id).toEqual(expect.any(String));
    expect(relationship.history[0].id.length).toBeGreaterThan(0);
  });

  it('should treat loyalty as a conservative retention floor', () => {
    expect(RelationshipManager.checkLoyalty(createMockCompanion({ loyalty: 11 }))).toBe(true);
    expect(RelationshipManager.checkLoyalty(createMockCompanion({ loyalty: 10 }))).toBe(false);
    expect(RelationshipManager.checkLoyalty(createMockCompanion({ loyalty: 0 }))).toBe(false);
  });

  // ============================================================================
  // Romance Hysteresis
  // ============================================================================
  // A deep approval collapse starts a durable hostile interval. The romance only
  // exits when the in-world clock proves that interval lasted a complete day.
  // ============================================================================

  const createHostileRomance = () => {
    const playerId = 'player-1';
    const romance = RelationshipManager.processApprovalEvent(
      createMockCompanion(),
      playerId,
      500,
      'Committed to each other',
      eventTime
    );

    // Dropping to -350 enters the canonical enemy band, but this first hostile
    // event only starts the timer and must not perform an immediate breakup.
    const hostileRomance = RelationshipManager.processApprovalEvent(
      romance,
      playerId,
      -850,
      'A devastating betrayal',
      eventTime + oneHourMs
    );
    return { hostileRomance, playerId, hostileSince: eventTime + oneHourMs };
  };

  it('keeps romance through a temporary hostile approval interval', () => {
    const { hostileRomance, playerId, hostileSince } = createHostileRomance();

    // Twenty-three in-world hours is deliberately short of the explicit full-day
    // policy, so even enemy-level approval remains romance for now.
    const temporaryDip = RelationshipManager.processInWorldTime(
      hostileRomance,
      hostileSince + 23 * oneHourMs
    );

    expect(temporaryDip.relationships[playerId].approval).toBe(-350);
    expect(temporaryDip.relationships[playerId].level).toBe('romance');
    expect(temporaryDip.relationships[playerId].romanceHostileSinceGameTimeMs).toBe(hostileSince);
  });

  it('exits romance to the derived hostile level after 24 in-world hours', () => {
    const { hostileRomance, playerId, hostileSince } = createHostileRomance();

    // At exactly one complete in-world day, the same -350 approval derives the
    // existing enemy level and records the ordinary relationship milestone.
    const sustainedDip = RelationshipManager.processInWorldTime(
      hostileRomance,
      hostileSince + 24 * oneHourMs
    );
    const relationship = sustainedDip.relationships[playerId];

    expect(relationship.approval).toBe(-350);
    expect(relationship.level).toBe('enemy');
    expect(relationship.romanceHostileSinceGameTimeMs).toBeUndefined();
    expect(relationship.history.at(-1)?.description).toBe(
      'Relationship changed from romance to enemy'
    );
  });
});
