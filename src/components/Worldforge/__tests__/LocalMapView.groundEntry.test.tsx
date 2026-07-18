// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LocalMapView from '../LocalMapView';
import type { LocalArtifact } from '../../../systems/worldforge/artifacts';

/**
 * This file proves that the L2 map sends the exact selected artifact feature into the
 * Atlas-owned ground pipeline. Drawing is mocked because this test covers navigation
 * identity, while browser screenshots cover the rendered cartography and 3D scene.
 */

vi.mock('../localDraw', () => ({
  drawLocalFeatures: vi.fn(),
  rasterizeLocalTerrain: vi.fn(() => ({ width: 1, height: 1 })),
}));

// This focused fixture supplies only the fields LocalMapView reads. Keeping it small makes
// navigation intent legible; the production generators have separate full-shape coverage.
const local = {
  seedPath: '42/region:9/local:1200,900',
  bounds: { x: 1000, y: 500, width: 3000, height: 3000 },
  terrain: { widthCells: 1, heightCells: 1, elevationFt: new Float32Array(1), materialIndex: new Uint8Array(1), materials: ['grass'] },
  features: [{ id: 7, kind: 'poi', x: 1300, y: 1100, data: { name: 'Ash Shrine' } }],
} as unknown as LocalArtifact;

describe('LocalMapView ground navigation', () => {
  it('enters ground with the exact selected local site', () => {
    const onEnterGround = vi.fn();
    render(<LocalMapView local={local} width={320} height={520} onAscend={vi.fn()} onEnterGround={onEnterGround} />);
    // Wave 4 names the semantic Ground tier directly while preserving the exact site label.
    // Querying the public accessible name keeps this proof aligned with the player-facing contract.
    fireEvent.click(screen.getByRole('button', { name: /Enter Ash Shrine on Ground/i }));
    expect(onEnterGround).toHaveBeenCalledWith({ kind: 'site', id: 7, label: 'Ash Shrine', xFt: 1300, yFt: 1100 });
  });
});
