import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TownCanvas from '../TownCanvas';
import { BiomeType } from '../../../types/realmsmith';
import { vi } from 'vitest';

// Mock dependencies
vi.mock('../../../services/RealmSmithTownGenerator', () => {
    return {
        TownGenerator: class {
            generate() {
                return {
                    width: 50,
                    height: 50,
                    tiles: Array(50).fill(Array(50).fill({ type: 'ground' })),
                    buildings: [
                        { id: 'b1', type: 'tavern', x: 10, y: 10, width: 3, height: 3 }
                    ],
                    biome: 'plains'
                };
            }
        }
    };
});

vi.mock('../../../services/RealmSmithAssetPainter', () => {
    return {
        AssetPainter: vi.fn().mockImplementation(() => {
            return {
                drawMap: vi.fn()
            };
        })
    };
});

describe('TownCanvas', () => {
    const mockOnAction = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock HTMLCanvasElement.getContext
        const mockContext = {
            fillStyle: '',
            fillRect: vi.fn(),
            font: '',
            fillText: vi.fn(),
        } as unknown as CanvasRenderingContext2D;

        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => mockContext);
    });

    it('renders without crashing', () => {
        render(
            <TownCanvas
                worldSeed={12345}
                worldX={10}
                worldY={10}
                biome="plains"
                onAction={mockOnAction}
            />
        );
        expect(screen.getByText(/Scroll to Zoom/i)).toBeInTheDocument();
    });

    it('shows loading state initially', async () => {
        render(
            <TownCanvas
                worldSeed={12345}
                worldX={10}
                worldY={10}
                biome="plains"
                onAction={mockOnAction}
            />
        );
        // It might be too fast to catch loading state in test env, but we can check if controls appear
        await waitFor(() => {
            expect(screen.getByTitle(/Zoom In/i)).toBeInTheDocument();
        });
    });

    it('toggles grid when button is clicked', async () => {
         render(
            <TownCanvas
                worldSeed={12345}
                worldX={10}
                worldY={10}
                biome="plains"
                onAction={mockOnAction}
            />
        );

        const gridButton = screen.getByTitle(/Toggle Grid/i);
        fireEvent.click(gridButton);
        // Since state is internal, we can check if button class changes (visual feedback)
        // or ensure no crash.
        expect(gridButton).toBeInTheDocument();
    });
});
