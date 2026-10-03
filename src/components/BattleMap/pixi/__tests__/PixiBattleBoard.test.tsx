/**
 * This suite verifies how the React Pixi board consumes fog-of-war changes.
 *
 * The renderer owns a high-frequency animation ticker, while fog construction
 * performs a comparatively expensive two-pass blur. A lightweight Pixi mock
 * lets this component mount normally and proves unchanged ticker frames do not
 * rebuild fog, while a new visibility input does.
 */

// ============================================================================
// Test Harness and Module Doubles
// ============================================================================
// The callback list exposes the board's registered Pixi ticker to the test.
// Canvas and Pixi objects implement only the behavior this component consumes.
// ============================================================================
import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BattleMapData, LightLevel } from '../../../../types/combat';

const pixiHarness = vi.hoisted(() => ({
  tickerCallbacks: [] as Array<(tick: { deltaMS: number }) => void>,
}));

vi.mock('pixi.js', () => {
  class MockContainer {
    children: MockContainer[] = [];
    x = 0;
    y = 0;
    visible = true;
    alpha = 1;
    scale = { set: vi.fn() };
    position = { set: vi.fn() };

    addChild(...children: MockContainer[]): MockContainer {
      this.children.push(...children);
      return children[0] ?? this;
    }

    removeChildren(): MockContainer[] {
      const removed = this.children;
      this.children = [];
      return removed;
    }

    destroy(): void {
      this.children = [];
    }
  }

  class MockGraphics extends MockContainer {
    clear(): this { return this; }
    circle(): this { return this; }
    fill(): this { return this; }
    stroke(): this { return this; }
    arc(): this { return this; }
  }

  class MockSprite extends MockContainer {
    width = 0;
    height = 0;
  }

  class MockText extends MockContainer {
    text: string;
    anchor = { set: vi.fn() };

    constructor(options: { text: string }) {
      super();
      this.text = options.text;
    }
  }

  class MockApplication {
    canvas = document.createElement('canvas');
    stage = new MockContainer();
    renderer = { name: 'mock-pixi' };
    ticker = {
      add: (callback: (tick: { deltaMS: number }) => void) => {
        pixiHarness.tickerCallbacks.push(callback);
      },
    };

    async init(): Promise<void> {}
    destroy(): void {}
  }

  return {
    Application: MockApplication,
    Container: MockContainer,
    Graphics: MockGraphics,
    Sprite: MockSprite,
    Text: MockText,
    Texture: {
      from: () => ({ source: { scaleMode: 'nearest' } }),
    },
  };
});

vi.mock('../../groundPainter', () => ({
  loadGroundTextures: vi.fn().mockResolvedValue({}),
  paintGround: vi.fn(),
}));

vi.mock('../../fogModel', () => ({
  buildFogAlphaGrid: vi.fn(() => ({ width: 1, height: 1, alphas: [0.5] })),
  blurFogAlphaGrid: vi.fn((grid: { width: number; height: number; alphas: number[] }) => grid),
  FOG_TINT: { r: 10, g: 20, b: 30 },
  FOG_TINT_WATER: { r: 20, g: 40, b: 60 },
}));

import * as fogModel from '../../fogModel';
import PixiBattleBoard from '../PixiBattleBoard';

// ============================================================================
// Stable Browser Inputs
// ============================================================================
// JSDOM has no layout or real canvas renderer. Fixed host dimensions let Pixi
// initialize immediately, while this context records enough behavior to finish
// both the ground and fog raster paths.
// ============================================================================
const canvasContext = {
  setTransform: vi.fn(),
  fillRect: vi.fn(),
  imageSmoothingEnabled: true,
  imageSmoothingQuality: 'high',
  fillStyle: '',
} as unknown as CanvasRenderingContext2D;

const mapData = {
  dimensions: { width: 1, height: 1 },
  theme: 'dungeon',
  tiles: new Map([
    ['0-0', { id: '0-0', terrain: 'stone', coordinates: { x: 0, y: 0 } }],
  ]),
} as unknown as BattleMapData;

afterEach(() => {
  pixiHarness.tickerCallbacks.length = 0;
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// ============================================================================
// Fog Consumption Contract
// ============================================================================
// The first draw must consume fog immediately. Animation-only frames must then
// stay cheap until React supplies a changed visibility or light input.
// ============================================================================
describe('PixiBattleBoard fog cadence', () => {
  it('blurs once for unchanged ticker frames and again for a new fog input', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      (() => canvasContext) as any,
    );

    const initialVisibleTiles = new Set(['0-0']);
    const getLightLevel = (): LightLevel => 'bright';
    const view = render(
      <PixiBattleBoard
        mapData={mapData}
        characters={[]}
        visibleTiles={initialVisibleTiles}
        getLightLevel={getLightLevel}
        currentCharacterId={null}
        selectedCharacterId={null}
      />,
    );

    // Mounting paints one initial fog texture and registers one animation ticker.
    await waitFor(() => expect(fogModel.blurFogAlphaGrid).toHaveBeenCalledTimes(1));
    expect(pixiHarness.tickerCallbacks).toHaveLength(1);

    // Several animation frames with unchanged React inputs stay behind the
    // numeric revision gate and therefore perform no additional blur passes.
    act(() => {
      pixiHarness.tickerCallbacks[0]({ deltaMS: 16 });
      pixiHarness.tickerCallbacks[0]({ deltaMS: 16 });
      pixiHarness.tickerCallbacks[0]({ deltaMS: 16 });
    });
    expect(fogModel.blurFogAlphaGrid).toHaveBeenCalledTimes(1);

    // A newly computed visibility set advances the revision. The next ticker
    // consumes it exactly once, then returns to the cheap unchanged path.
    view.rerender(
      <PixiBattleBoard
        mapData={mapData}
        characters={[]}
        visibleTiles={new Set(['0-0'])}
        getLightLevel={getLightLevel}
        currentCharacterId={null}
        selectedCharacterId={null}
      />,
    );
    act(() => {
      pixiHarness.tickerCallbacks[0]({ deltaMS: 16 });
      pixiHarness.tickerCallbacks[0]({ deltaMS: 16 });
    });
    expect(fogModel.blurFogAlphaGrid).toHaveBeenCalledTimes(2);
  });
});
