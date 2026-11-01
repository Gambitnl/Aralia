// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LocalMapView from '../LocalMapView';
import type { LocalArtifact } from '../../../systems/worldforge/artifacts';
import RegionMapView from '../RegionMapView';
import { useGameHotkeys } from '../../../hooks/useGameHotkeys';
import { createMockGameState } from '../../../utils/core';
import { GamePhase } from '../../../types';
import type { RegionArtifact } from '../../../systems/worldforge/artifacts';

vi.mock('../regionDraw', async importOriginal => ({
  ...await importOriginal<typeof import('../regionDraw')>(),
  drawRegion: vi.fn(),
}));

/**
 * This file proves that the L2 map sends the exact selected artifact feature into the
 * Atlas-owned ground pipeline. Drawing is mocked because this test covers navigation
 * identity, while browser screenshots cover the rendered cartography and 3D scene.
 */

vi.mock('../localDraw', () => ({
  drawLocalFeatures: vi.fn(),
  rasterizeLocalTerrain: vi.fn(() => new ImageData(1, 1)),
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
  it.each(['Local', 'Region'])('lets %s Escape ascend once without opening the developer menu', tier => {
    const dispatch = vi.fn(), onAscend = vi.fn();
    renderHook(() => useGameHotkeys({ gameState: { ...createMockGameState(), phase: GamePhase.PLAYING, isMapVisible: false }, dispatch }));
    const region = { seedPath: '42/region:9', bounds: local.bounds, heightfield: { resolutionFt: 100, width: 1, height: 1 } } as RegionArtifact;
    render(tier === 'Local'
      ? <LocalMapView local={local} width={320} height={520} onAscend={onAscend} />
      : <RegionMapView region={region} width={320} height={520} onAscend={onAscend} onDescend={vi.fn()} />);
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onAscend).toHaveBeenCalledTimes(1);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('leaves Escape to an open dialog instead of ascending beneath it', () => {
    const onAscend = vi.fn();
    render(<><LocalMapView local={local} onAscend={onAscend} /><div role="dialog" aria-modal="true">Trade review</div></>);
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(onAscend).not.toHaveBeenCalled();
  });

  it('enters ground with the exact selected local site', () => {
    const onEnterGround = vi.fn();
    render(<LocalMapView local={local} width={320} height={520} onAscend={vi.fn()} onEnterGround={onEnterGround} />);
    // Wave 4 names the semantic Ground tier directly while preserving the exact site label.
    // Querying the public accessible name keeps this proof aligned with the player-facing contract.
    fireEvent.click(screen.getByRole('button', { name: /Enter Ash Shrine on Ground/i }));
    expect(onEnterGround).toHaveBeenCalledWith({ kind: 'site', id: 7, label: 'Ash Shrine', xFt: 1300, yFt: 1100 });
  });

  it('selects an authored town gate without replacing the town source ID', () => {
    const onEnterGround = vi.fn();
    const townLocal = { ...local, features: [], townPlan: { burgId: 12,
      identity: { sourceId: 12, name: 'Alderwatch' },
      plots: [{ footprint: [[1900, 1400], [2100, 1600]] }],
      streets: [{ id: 1, centerline: [[1200, 1500], [2800, 1500]] }],
      gates: [[1250, 1550]],
    } } as unknown as LocalArtifact;
    render(<LocalMapView local={townLocal} onAscend={vi.fn()} onEnterGround={onEnterGround} />);
    fireEvent.click(screen.getByRole('button', { name: 'Enter Alderwatch — Gate 1 on Ground' }));
    expect(onEnterGround).toHaveBeenCalledWith({ kind: 'town', id: 12,
      label: 'Alderwatch — Gate 1', xFt: 1250, yFt: 1550 });
    expect(screen.queryByRole('button', { name: /western road approach/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enter Alderwatch on Ground' })).toBeInTheDocument();
  });
});
