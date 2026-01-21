import { render, screen } from '@testing-library/react';
import { PreviewEnvironment } from '../PreviewEnvironment';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

// Mock Three.js components as they don't render in JSDOM
vi.mock('../../../ThreeDModal/Experimental/DeformableScene', () => ({
  DeformableScene: () => <div data-testid="deformable-scene">Deformable Scene</div>
}));

describe('PreviewEnvironment', () => {
  it('renders the environment prototype header', () => {
    render(<PreviewEnvironment />);
    expect(screen.getByText(/Environmental Prototype/i)).toBeInTheDocument();
  });

  it('renders the deformable scene', () => {
    render(<PreviewEnvironment />);
    expect(screen.getByTestId('deformable-scene')).toBeInTheDocument();
  });
});
