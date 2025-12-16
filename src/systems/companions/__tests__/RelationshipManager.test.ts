/**
 * Copyright (c) 2024 Aralia RPG
 * Licensed under the MIT License
 *
 * @file src/systems/companions/__tests__/RelationshipManager.test.ts
 * Tests for the RelationshipManager system.
 */

import { describe, it, expect } from 'vitest';
import { RelationshipManager } from '../RelationshipManager';
import { createMockCompanion } from '../../../utils/companionFactories';

describe('RelationshipManager', () => {
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
    expect(updatedCompanion.relationships[playerId].level).toBe('acquaintance');
  });

  it('should cap approval at -100 and 100', () => {
    const companion = createMockCompanion();
    const playerId = 'player-1';

    let updated = RelationshipManager.processApprovalEvent(companion, playerId, 150, 'Did everything right');
    expect(updated.relationships[playerId].approval).toBe(100);

    updated = RelationshipManager.processApprovalEvent(companion, playerId, -200, 'Did everything wrong');
    expect(updated.relationships[playerId].approval).toBe(-100);
  });

  it('should change relationship level based on thresholds', () => {
    const companion = createMockCompanion();
    const playerId = 'player-1';

    // Default 0 -> Stranger
    let updated = RelationshipManager.processApprovalEvent(companion, playerId, 40, 'Became friend');
    expect(updated.relationships[playerId].level).toBe('friend'); // 40 is in [30, 59]

    updated = RelationshipManager.processApprovalEvent(updated, playerId, -80, 'Betrayal');
    // 40 - 80 = -40
    // -40 is in rival range [-69, -30]
    expect(updated.relationships[playerId].approval).toBe(-40);
    expect(updated.relationships[playerId].level).toBe('rival');
  });

  it('should record history when level changes', () => {
    const companion = createMockCompanion();
    const playerId = 'player-1';

    const updated = RelationshipManager.processApprovalEvent(companion, playerId, 40, 'Became friend');

    const history = updated.relationships[playerId].history;
    expect(history.length).toBeGreaterThan(0);
    expect(history[history.length - 1].description).toContain('changed from stranger to friend');
  });
});
