/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/__tests__/RelationshipManager.test.ts
 * Tests for the RelationshipManager system.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { RelationshipManager } from '../RelationshipManager';
import { createMockCompanion } from '../../../utils/companionFactories';

describe('RelationshipManager', () => {
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
      'Helped them up'
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
      'Did everything right'
    );
    expect(updated.relationships[playerId].approval).toBe(500);
    expect(updated.relationships[playerId].level).toBe('romance');

    updated = RelationshipManager.processApprovalEvent(
      createMockCompanion(),
      playerId,
      -1200,
      'Did everything wrong'
    );
    expect(updated.relationships[playerId].approval).toBe(-500);
    expect(updated.relationships[playerId].level).toBe('hated');
  });

  it('should change relationship level based on thresholds', () => {
    const companion = createMockCompanion();
    const playerId = 'player-1';

    // Default 0 -> Stranger
    // Relationship thresholds shift by 100-point increments.
    let updated = RelationshipManager.processApprovalEvent(companion, playerId, 240, 'Became friend');
    expect(updated.relationships[playerId].level).toBe('friend'); // 240 is in [200, 299]

    updated = RelationshipManager.processApprovalEvent(updated, playerId, -520, 'Betrayal');
    // 240 - 520 = -280
    // -280 is in rival range [-300, -201]
    expect(updated.relationships[playerId].approval).toBe(-280);
    expect(updated.relationships[playerId].level).toBe('rival');
  });

  it('should record history when level changes', () => {
    const companion = createMockCompanion();
    const playerId = 'player-1';

    const updated = RelationshipManager.processApprovalEvent(companion, playerId, 240, 'Became friend');

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

    const updated = RelationshipManager.processApprovalEvent(companion, playerId, 240, 'Became friend');
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
});
