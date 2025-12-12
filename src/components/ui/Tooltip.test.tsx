import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import Tooltip from './Tooltip';

describe('Tooltip', () => {
  // Mock requestAnimationFrame to prevent errors in test environment
  beforeAll(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => setTimeout(cb, 0) as unknown as number);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => clearTimeout(id));
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('renders children correctly', () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Trigger</button>
      </Tooltip>
    );
    expect(screen.getByText('Trigger')).toBeInTheDocument();
  });

  it('shows tooltip on hover', async () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Trigger</button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');
    fireEvent.mouseEnter(trigger);

    // Tooltip content is rendered in a portal, so we check for it in the document
    await waitFor(() => {
        expect(screen.getByText('Tooltip content')).toBeInTheDocument();
        expect(screen.getByRole('tooltip')).toBeVisible();
    });
  });

  it('hides tooltip on mouse leave', async () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Trigger</button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');

    // Show first
    fireEvent.mouseEnter(trigger);
    await waitFor(() => {
        expect(screen.getByText('Tooltip content')).toBeInTheDocument();
    });

    // Hide
    fireEvent.mouseLeave(trigger);
    await waitFor(() => {
        expect(screen.queryByText('Tooltip content')).not.toBeInTheDocument();
    });
  });

  it('shows tooltip on focus', async () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Trigger</button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');
    fireEvent.focus(trigger);

    await waitFor(() => {
        expect(screen.getByText('Tooltip content')).toBeInTheDocument();
    });
  });

  it('hides tooltip on blur', async () => {
    render(
      <Tooltip content="Tooltip content">
        <button>Trigger</button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');

    // Show first
    fireEvent.focus(trigger);
    await waitFor(() => {
        expect(screen.getByText('Tooltip content')).toBeInTheDocument();
    });

    // Hide
    fireEvent.blur(trigger);
    await waitFor(() => {
        expect(screen.queryByText('Tooltip content')).not.toBeInTheDocument();
    });
  });

  it('renders via portal', async () => {
    render(
      <div data-testid="container">
        <Tooltip content="Tooltip content">
          <button>Trigger</button>
        </Tooltip>
      </div>
    );

    const trigger = screen.getByText('Trigger');
    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
       const tooltip = screen.getByRole('tooltip');
       const container = screen.getByTestId('container');

       expect(tooltip).toBeInTheDocument();
       // Tooltip should NOT be a child of the container div (because it's a portal to body)
       expect(container).not.toContainElement(tooltip);
       expect(document.body).toContainElement(tooltip);
    });
  });

  it('adds aria-describedby when visible', async () => {
     render(
      <Tooltip content="Tooltip content">
        <button>Trigger</button>
      </Tooltip>
    );

    const trigger = screen.getByText('Trigger');

    // Initially no aria-describedby
    expect(trigger).not.toHaveAttribute('aria-describedby');

    fireEvent.mouseEnter(trigger);

    await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-describedby');
        const tooltipId = trigger.getAttribute('aria-describedby');
        const tooltip = screen.getByRole('tooltip');
        expect(tooltip).toHaveAttribute('id', tooltipId);
    });
  });
});
