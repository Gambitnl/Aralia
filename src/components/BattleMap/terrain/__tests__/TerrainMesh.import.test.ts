import { describe, expect, it, vi } from 'vitest';

/**
 * This smoke test only checks that the terrain component still imports cleanly.
 *
 * The full WebGL scene is not appropriate for a unit test, but we do want one
 * fast guard that the new hit-mapping helper did not break the component module
 * boundary.
 */

vi.mock('@react-three/fiber', () => ({
  ThreeEvent: {},
}));

import TerrainMesh from '../TerrainMesh';

describe('TerrainMesh import', () => {
  it('remains a loadable component module', () => {
    expect(TerrainMesh).toBeTypeOf('function');
  });
});
