import { describe, expect, it } from 'vitest';
import { pickCombatSurface } from '../combatSurfacePicker';

describe('pickCombatSurface', () => {
  it('routes a live streamed world to in-place with a world-derived referee grid', () => {
    const d = pickCombatSurface({ worldLive: true });
    expect(d.surface).toBe('in-place');
    expect(d.deriveFromWorld).toBe(true);
  });

  it('routes a live world in-place even when the patch was already derived', () => {
    const d = pickCombatSurface({ worldLive: true, hasWorldPatch: true });
    expect(d.surface).toBe('in-place');
    expect(d.deriveFromWorld).toBe(true);
  });

  it('routes a placeless fight (no live world) to the themed arena', () => {
    const d = pickCombatSurface({ worldLive: false });
    expect(d.surface).toBe('arena');
    expect(d.deriveFromWorld).toBe(false);
  });

  it('routes to the arena and flags the mismatch when a patch is supplied off-world', () => {
    const d = pickCombatSurface({ worldLive: false, hasWorldPatch: true });
    expect(d.surface).toBe('arena');
    expect(d.deriveFromWorld).toBe(false);
    expect(d.reason).toMatch(/should not derive/i);
  });
});
