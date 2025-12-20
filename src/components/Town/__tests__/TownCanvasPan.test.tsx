import React from 'react';
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import TownCanvas from '../TownCanvas';

const mockUseTownController = vi.fn();

vi.mock('../../../hooks/useTownController', () => ({
  useTownController: (...args: any[]) => mockUseTownController(...args),
}));

describe('TownCanvas panning', () => {
  beforeAll(() => {
    // JSDOM doesn't implement pointer capture APIs; TownCanvas uses them so dragging
    // continues even if the pointer leaves the element.
    // @ts-expect-error - test polyfill
    HTMLElement.prototype.setPointerCapture = () => { };
    // @ts-expect-error - test polyfill
    HTMLElement.prototype.releasePointerCapture = () => { };
  });

  it('does not pan until drag threshold is exceeded', () => {
    const setPan = vi.fn();

    mockUseTownController.mockReturnValue({
      state: {
        seed: 1,
        biome: 'plains',
        density: 0.5,
        connections: {},
        mapData: null,
        loading: false,
        localPlayerPosition: null,
        zoom: 1,
        pan: { x: 0, y: 0 },
        isNight: false,
        showGrid: false,
        hoveredBuilding: null,
        hoverPos: null,
      },
      actions: {
        setSeed: vi.fn(),
        setBiome: vi.fn(),
        setDensity: vi.fn(),
        setConnections: vi.fn(),
        generateMap: vi.fn(),
        setZoom: vi.fn(),
        setPan,
        setIsNight: vi.fn(),
        setShowGrid: vi.fn(),
        setHoveredBuilding: vi.fn(),
        setHoverPos: vi.fn(),
        resetView: vi.fn(),
        setLocalPlayerPosition: vi.fn(),
      },
    });

    const { container } = render(
      <TownCanvas
        worldSeed={1}
        worldX={0}
        worldY={0}
        biome="plains"
        onAction={vi.fn()}
      />
    );

    const main = container.querySelector('main');
    expect(main).toBeTruthy();

    fireEvent.pointerDown(main as HTMLElement, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(main as HTMLElement, { pointerId: 1, clientX: 102, clientY: 101 }); // below threshold

    expect(setPan).not.toHaveBeenCalled();
  });

  it('pans when dragging beyond the threshold', () => {
    const setPan = vi.fn();

    mockUseTownController.mockReturnValue({
      state: {
        seed: 1,
        biome: 'plains',
        density: 0.5,
        connections: {},
        mapData: null,
        loading: false,
        localPlayerPosition: null,
        zoom: 1,
        pan: { x: 0, y: 0 },
        isNight: false,
        showGrid: false,
        hoveredBuilding: null,
        hoverPos: null,
      },
      actions: {
        setSeed: vi.fn(),
        setBiome: vi.fn(),
        setDensity: vi.fn(),
        setConnections: vi.fn(),
        generateMap: vi.fn(),
        setZoom: vi.fn(),
        setPan,
        setIsNight: vi.fn(),
        setShowGrid: vi.fn(),
        setHoveredBuilding: vi.fn(),
        setHoverPos: vi.fn(),
        resetView: vi.fn(),
        setLocalPlayerPosition: vi.fn(),
      },
    });

    const { container } = render(
      <TownCanvas
        worldSeed={1}
        worldX={0}
        worldY={0}
        biome="plains"
        onAction={vi.fn()}
      />
    );

    const main = container.querySelector('main') as HTMLElement;
    fireEvent.pointerDown(main, { button: 0, pointerId: 1, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(main, { pointerId: 1, clientX: 120, clientY: 140 });
    fireEvent.pointerUp(main, { pointerId: 1, clientX: 120, clientY: 140 });

    expect(setPan).toHaveBeenCalledWith({ x: 20, y: 40 });
  });
});

