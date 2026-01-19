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
    expect(updatedCompanion.relationships[playerId].level).toBe('stranger');
  });

  it('should cap approval at -500 and 500', () => {
    // RelationshipManager uses a -500..500 approval scale.
    const companion = createMockCompanion();
    const playerId = 'player-1';

    let updated = RelationshipManager.processApprovalEvent(companion, playerId, 700, 'Did everything right');
    expect(updated.relationships[playerId].approval).toBe(500);

    updated = RelationshipManager.processApprovalEvent(updated, playerId, -1200, 'Did everything wrong');
    expect(updated.relationships[playerId].approval).toBe(-500);
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
});
