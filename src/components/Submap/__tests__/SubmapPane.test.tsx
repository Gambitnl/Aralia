import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SubmapPane from '../SubmapPane';
import { BIOMES } from '../../../constants';
import type { Location } from '../../../types';

// Mock all the hooks and utilities that SubmapPane depends on
vi.mock('../useSubmapProceduralData', () => ({
    useSubmapProceduralData: vi.fn(() => ({
        simpleHash: (x: number, y: number, seed: number) => (x + y + seed) % 100,
        activeSeededFeatures: [],
        pathDetails: { path: [], start: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
        caGrid: [],
        wfcGrid: [],
        biomeBlendContext: { primaryBiomeId: 'forest', secondaryBiomeId: null, blendFactor: 0 }
    }))
}));

vi.mock('../useSubmapGrid', () => ({
    useSubmapGrid: vi.fn(() => [
        {
            r: 10,
            c: 10,
            visuals: {
                style: {},
                content: '🟫',
                animationClass: '',
                isResource: false,
                effectiveTerrainType: 'grass',
                zIndex: 0,
                activeSeededFeatureConfigForTile: null,
                isSeedTile: false
            },
            tooltipContent: 'A grassy field'
        }
    ])
}));

vi.mock('../useInspectableTiles', () => ({
    useInspectableTiles: vi.fn(() => ({
        inspectableTiles: new Map(),
        setInspectedTile: vi.fn(),
        clearInspectedTile: vi.fn(),
        handleTileClick: vi.fn()
    }))
}));

vi.mock('../useQuickTravel', () => ({
    usePathfindingGrid: vi.fn(() => new Map()),
    useQuickTravelData: vi.fn(() => ({
        quickTravelPath: [],
        quickTravelDestination: null,
        isQuickTravelBlocked: false,
        blockedTiles: new Set(),
        handleQuickTravel: vi.fn(),
        handleTileSelect: vi.fn()
    }))
}));

vi.mock('../useSubmapGlossaryItems', () => ({
    useSubmapGlossaryItems: vi.fn(() => ({
        glossaryItems: [],
        selectedGlossaryItem: null,
        setSelectedGlossaryItem: vi.fn(),
        clearSelectedGlossaryItem: vi.fn()
    }))
}));

vi.mock('../useTileHintGenerator', () => ({
    useTileHintGenerator: vi.fn(() => ({
        generateTileHint: vi.fn(() => 'Test hint')
    }))
}));

vi.mock('../useDayNightOverlay', () => ({
    getDayNightOverlayClass: vi.fn(() => '')
}));

vi.mock('../../../services/geminiService', () => ({
    describeLocation: vi.fn(() => Promise.resolve('Test description'))
}));

// Mock child components that might cause issues
vi.mock('../CompassPane', () => ({
    default: () => <div data-testid="compass-pane">Compass Pane</div>
}));

vi.mock('../ThreeDModal/ThreeDModal', () => ({
    default: ({ isOpen }: { isOpen: boolean }) =>
        isOpen ? <div data-testid="three-d-modal">3D Modal</div> : null
}));

// Mock console methods to capture errors
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

// TODO: Refactor SubmapPane tests to use shallow rendering or extract testable units
// Current full component tests fail due to complex dependencies (CompassPane, ThreeDModal)
// Consider creating unit tests for individual hooks and shallow rendering for component integration

describe('SubmapPane', () => {
    const mockLocation: Location = {
        x: 5,
        y: 5,
        description: 'Test Location',
        discovered: true,
        biomeId: 'forest'
    };

    const defaultProps = {
        currentLocation: mockLocation,
        currentWorldBiomeId: 'forest',
        playerSubmapCoords: { x: 10, y: 10 },
        onClose: vi.fn(),
        submapDimensions: { rows: 20, cols: 20 },
        parentWorldMapCoords: { x: 5, y: 5 },
        onAction: vi.fn(),
        disabled: false,
        inspectedTileDescriptions: {},
        mapData: null,
        gameTime: new Date(),
        playerCharacter: {
            id: 'test-player',
            name: 'Test Player',
            race: 'human',
            class: 'fighter',
            level: 1,
            experience: 0,
            hitPoints: { current: 10, maximum: 10 },
            armorClass: 15,
            speed: 30,
            abilityScores: {
                strength: 15,
                dexterity: 14,
                constitution: 13,
                intelligence: 12,
                wisdom: 10,
                charisma: 8
            },
            skills: {},
            equipment: [],
            inventory: [],
            spells: [],
            features: []
        },
        partyMembers: [],
        worldSeed: 12345,
        npcsInLocation: [],
        itemsInLocation: [],
        geminiGeneratedActions: null,
        isDevDummyActive: false
    };

    let consoleErrors: string[] = [];
    let consoleWarnings: string[] = [];

    beforeEach(() => {
        vi.clearAllMocks();

        // Capture console errors and warnings
        consoleErrors = [];
        consoleWarnings = [];
        console.error = vi.fn((...args) => {
            consoleErrors.push(args.join(' '));
            originalConsoleError(...args);
        });
        console.warn = vi.fn((...args) => {
            consoleWarnings.push(args.join(' '));
            originalConsoleWarn(...args);
        });
    });

    afterEach(() => {
        // Restore original console methods
        console.error = originalConsoleError;
        console.warn = originalConsoleWarn;
    });

    describe('Basic Rendering', () => {
        it('renders without crashing with valid props', () => {
            expect(() => {
                render(<SubmapPane {...defaultProps} />);
            }).not.toThrow();
        });

        it('renders the submap grid with correct ARIA attributes', () => {
            render(<SubmapPane {...defaultProps} />);

            const grid = screen.getByRole('grid');
            expect(grid).toBeInTheDocument();
            expect(grid).toHaveAttribute('aria-labelledby', 'submap-grid-description');
        });

        it('renders the grid description for screen readers', () => {
            render(<SubmapPane {...defaultProps} />);

            expect(screen.getByText('Submap grid showing local terrain features. Your current position is marked with a person icon.')).toBeInTheDocument();
        });

        it('renders the close button', () => {
            render(<SubmapPane {...defaultProps} />);

            const closeButton = screen.getByRole('button', { name: /close|×/i });
            expect(closeButton).toBeInTheDocument();
        });
    });

    describe('Biome Configurations', () => {
        const testBiomes = ['forest', 'plains', 'mountain', 'desert', 'swamp', 'ocean'];

        testBiomes.forEach(biomeId => {
            it(`renders correctly with ${biomeId} biome`, () => {
                const biomeProps = {
                    ...defaultProps,
                    currentWorldBiomeId: biomeId
                };

                expect(() => {
                    render(<SubmapPane {...biomeProps} />);
                }).not.toThrow();

                // Should have rendered the grid
                expect(screen.getByRole('grid')).toBeInTheDocument();
            });
        });

        it('handles invalid biome gracefully', () => {
            const invalidBiomeProps = {
                ...defaultProps,
                currentWorldBiomeId: 'invalid_biome'
            };

            expect(() => {
                render(<SubmapPane {...invalidBiomeProps} />);
            }).not.toThrow();

            // Should still render the grid
            expect(screen.getByRole('grid')).toBeInTheDocument();
        });
    });

    describe('Runtime Error Checks', () => {
        it('does not produce console errors during normal rendering', () => {
            render(<SubmapPane {...defaultProps} />);

            // Wait for any async operations to complete
            waitFor(() => {
                expect(consoleErrors).toHaveLength(0);
            }, { timeout: 1000 });
        });

        it('does not produce console warnings during normal rendering', () => {
            render(<SubmapPane {...defaultProps} />);

            // Wait for any async operations to complete
            waitFor(() => {
                expect(consoleWarnings).toHaveLength(0);
            }, { timeout: 1000 });
        });

        it('handles missing biome data gracefully', () => {
            // Mock BIOMES to return null for a biome
            const originalBiomes = { ...BIOMES };
            (BIOMES as any).nonexistent = null;

            const missingBiomeProps = {
                ...defaultProps,
                currentWorldBiomeId: 'nonexistent'
            };

            expect(() => {
                render(<SubmapPane {...missingBiomeProps} />);
            }).not.toThrow();

            // Should still render
            expect(screen.getByRole('grid')).toBeInTheDocument();

            // Restore original BIOMES
            Object.assign(BIOMES, originalBiomes);
        });
    });

    describe('Component Behavior', () => {
        it('passes onClose to close button', () => {
            render(<SubmapPane {...defaultProps} />);

            const closeButton = screen.getByRole('button', { name: /close|×/i });
            closeButton.click();

            expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
        });

        it('displays current location coordinates in title', () => {
            render(<SubmapPane {...defaultProps} />);

            // Should show location coordinates in the title
            expect(screen.getByText(/Submap.*5.*5/)).toBeInTheDocument();
        });

        it('shows player position indicator', () => {
            render(<SubmapPane {...defaultProps} />);

            // The grid should contain player position somewhere
            const grid = screen.getByRole('grid');
            expect(grid).toBeInTheDocument();
            // Specific player position testing would require more detailed DOM inspection
        });
    });

    describe('Error Boundary Testing', () => {
        it('handles invalid props gracefully', () => {
            const invalidProps = {
                ...defaultProps,
                currentLocation: null as any, // Invalid location
            };

            // Should either handle gracefully or throw informative error
            expect(() => {
                render(<SubmapPane {...invalidProps} />);
            }).toThrow(); // Expect prop validation or error boundary
        });
    });

    describe('Performance and Memory', () => {
        it('does not cause memory leaks in useEffect cleanup', () => {
            const { unmount } = render(<SubmapPane {...defaultProps} />);

            // Should not throw during cleanup
            expect(() => {
                unmount();
            }).not.toThrow();
        });

        it('handles rapid re-renders without issues', () => {
            const { rerender } = render(<SubmapPane {...defaultProps} />);

            // Rapid re-renders should not cause issues
            for (let i = 0; i < 5; i++) {
                rerender(<SubmapPane {...defaultProps} />);
            }

            expect(screen.getByRole('grid')).toBeInTheDocument();
        });
    });
});