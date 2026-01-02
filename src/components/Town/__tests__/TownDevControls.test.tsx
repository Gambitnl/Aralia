import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TownDevControls } from '../TownDevControls';
import { BiomeType, TownDensity } from '../../../types/realmsmith';

describe('TownDevControls', () => {
    const defaultProps = {
        seed: 12345,
        setSeed: vi.fn(),
        handleRandomize: vi.fn(),
        biome: BiomeType.PLAINS,
        setBiome: vi.fn(),
        density: TownDensity.MEDIUM,
        setDensity: vi.fn(),
        connections: { north: true, east: true, south: true, west: true },
        toggleConnection: vi.fn(),
        loading: false,
        generateMap: vi.fn(),
        onAction: vi.fn(),
        handleDownload: vi.fn(),
    };

    it('renders all control sections', () => {
        render(<TownDevControls {...defaultProps} />);
        expect(screen.getByText('Seed')).toBeInTheDocument();
        expect(screen.getByText('Biome')).toBeInTheDocument();
        expect(screen.getByText('Density')).toBeInTheDocument();
        expect(screen.getByText('Exits')).toBeInTheDocument();
        expect(screen.getByText('Regenerate')).toBeInTheDocument();
    });

    it('calls setSeed when input changes', () => {
        render(<TownDevControls {...defaultProps} />);
        const input = screen.getByRole('spinbutton');
        fireEvent.change(input, { target: { value: '999' } });
        expect(defaultProps.setSeed).toHaveBeenCalledWith(999);
    });

    it('calls handleRandomize when randomize button is clicked', () => {
        render(<TownDevControls {...defaultProps} />);
        const button = screen.getByTitle('Randomize');
        fireEvent.click(button);
        expect(defaultProps.handleRandomize).toHaveBeenCalled();
    });

    it('calls generateMap when regenerate button is clicked', () => {
        render(<TownDevControls {...defaultProps} />);
        const button = screen.getByText('Regenerate');
        fireEvent.click(button);
        expect(defaultProps.generateMap).toHaveBeenCalled();
    });

    it('shows loading state on regenerate button', () => {
        render(<TownDevControls {...defaultProps} loading={true} />);
        const button = screen.getByText('Regenerate').closest('button');
        expect(button).toBeDisabled();
        // Check for spinner class or element if necessary, but disabled check is good
    });
});
