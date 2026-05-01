import React from 'react';
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VillageScene from '../VillageScene';
import * as villageGenerator from '../../../services/villageGenerator';

// Mock the village generator
vi.mock('../../../services/villageGenerator', async () => {
  const actual = await vi.importActual<typeof import('../../../services/villageGenerator')>('../../../services/villageGenerator');
  return {
    ...actual,
    findBuildingAt: vi.fn(actual.findBuildingAt as any),
    generateVillageLayout: vi.fn(actual.generateVillageLayout as any),
  };
});

describe('VillageScene', () => {
  const defaultProps = {
    worldSeed: 12345,
    worldX: 10,
    worldY: 20,
    biomeId: 'temperate_forest',
    onAction: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a canvas', () => {
    const { container } = render(<VillageScene {...defaultProps} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('calls findBuildingAt when clicked', () => {
    const { container } = render(<VillageScene {...defaultProps} />);
    const canvas = container.querySelector('canvas');
    if (!canvas) throw new Error('Canvas not found');

    // Mock getBoundingClientRect for coordinate calculation
    canvas.getBoundingClientRect = vi.fn(() => ({
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      bottom: 100,
      right: 100,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    fireEvent.click(canvas, { clientX: 32, clientY: 32 }); // TILE_SIZE is 16, so this is (2, 2)
    expect(villageGenerator.findBuildingAt).toHaveBeenCalledTimes(1);

    // Second click at the same spot should use cache
    fireEvent.click(canvas, { clientX: 32, clientY: 32 });
    expect(villageGenerator.findBuildingAt).toHaveBeenCalledTimes(1);

    // Click at a different spot should call findBuildingAt again
    fireEvent.click(canvas, { clientX: 48, clientY: 48 }); // (3, 3)
    expect(villageGenerator.findBuildingAt).toHaveBeenCalledTimes(2);
  });
});
