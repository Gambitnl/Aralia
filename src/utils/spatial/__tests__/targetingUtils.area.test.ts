/**
 * This file protects the directional origin used by ordinary area targeting.
 *
 * A self-origin line is aimed by the caster's facing when the player confirms
 * the caster's own tile. These checks keep preview and execution geometry from
 * collapsing that line to a zero-length point while preserving explicit line
 * endpoints for callers that genuinely choose another tile.
 *
 * Called by: focused Vitest geometry checks.
 * Depends on: resolveAoEParams, the same translator used by map preview and cast execution.
 */

import { describe, expect, it } from 'vitest';
import { createMockCombatCharacter } from '../../core';
import { resolveAoEParams } from '../targetingUtils';

// ============================================================================
// Self-Origin Directional Areas
// ============================================================================
// Self-origin cones and lines use facing when the confirmation point is the
// caster's own cell. Explicitly aimed lines continue to own their clicked end.
// ============================================================================

describe('resolveAoEParams directional self-origin areas', () => {
  it('projects a self-confirmed line from facing instead of ending on its origin', () => {
    const caster = createMockCombatCharacter({
      id: 'line-caster',
      position: { x: 3, y: 5 },
      facing: 'east',
    });

    const params = resolveAoEParams(
      { shape: 'line', size: 6 },
      caster.position,
      caster,
    );

    expect(params).toMatchObject({
      shape: 'Line',
      origin: { x: 3, y: 5 },
      direction: 90,
      size: 30,
    });
    expect(params?.targetPoint).toBeUndefined();
  });

  it('preserves a clicked endpoint when a line is explicitly aimed away from the caster', () => {
    const caster = createMockCombatCharacter({
      id: 'line-caster',
      position: { x: 3, y: 5 },
      facing: 'north',
    });

    const params = resolveAoEParams(
      { shape: 'line', size: 6 },
      { x: 9, y: 5 },
      caster,
    );

    expect(params).toMatchObject({
      shape: 'Line',
      origin: { x: 3, y: 5 },
      direction: 90,
      targetPoint: { x: 9, y: 5 },
      size: 30,
    });
  });
});
