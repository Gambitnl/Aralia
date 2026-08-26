import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
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
        // JSDOM doesn't compute layout, so the tooltip may stay offscreen even when "shown".
        expect(screen.getByText('Tooltip content')).toBeInTheDocument();
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
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

  /**
   * Viewport-edge placement.
   *
   * jsdom never lays anything out, so every getBoundingClientRect() is a zero
   * rect and the flip/clamp branches in calculateAndSetPosition are all taken
   * with the same degenerate numbers. These tests hand the component real
   * geometry: the trigger reports the rect of a button parked against one
   * viewport edge, the portalled tooltip reports a fixed 200x60 box, and
   * window.innerWidth/innerHeight are pinned to a 1000x800 viewport.
   *
   * Constants mirrored from Tooltip.tsx: ARROW_HEIGHT = 0, TOOLTIP_MARGIN = 8.
   */
  describe('viewport edge placement', () => {
    const VIEWPORT_WIDTH = 1000;
    const VIEWPORT_HEIGHT = 800;
    const TOOLTIP_WIDTH = 200;
    const TOOLTIP_HEIGHT = 60;
    const MARGIN = 8;

    let rectSpy: ReturnType<typeof vi.spyOn> | null = null;
    const originalInnerWidth = window.innerWidth;
    const originalInnerHeight = window.innerHeight;

    const asRect = (left: number, top: number, width: number, height: number): DOMRect => ({
      x: left,
      y: top,
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      toJSON: () => ({}),
    }) as DOMRect;

    /**
     * Route rect reads by element identity: the trigger <button> gets the
     * edge-parked rect under test, the portalled tooltip gets a constant box,
     * and everything else keeps jsdom's zero rect.
     */
    const stubGeometry = (triggerRect: DOMRect) => {
      rectSpy = vi
        .spyOn(Element.prototype, 'getBoundingClientRect')
        .mockImplementation(function (this: Element) {
          if (this.getAttribute('data-testid') === 'tooltip') {
            return asRect(0, 0, TOOLTIP_WIDTH, TOOLTIP_HEIGHT);
          }
          if (this.tagName === 'BUTTON') {
            return triggerRect;
          }
          return asRect(0, 0, 0, 0);
        });
    };

    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: VIEWPORT_WIDTH,
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        writable: true,
        value: VIEWPORT_HEIGHT,
      });
    });

    afterEach(() => {
      rectSpy?.mockRestore();
      rectSpy = null;
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: originalInnerWidth,
      });
      Object.defineProperty(window, 'innerHeight', {
        configurable: true,
        writable: true,
        value: originalInnerHeight,
      });
    });

    const showAtEdge = async (triggerRect: DOMRect): Promise<HTMLElement> => {
      stubGeometry(triggerRect);
      render(
        <Tooltip content="Tooltip content">
          <button>Trigger</button>
        </Tooltip>
      );
      fireEvent.mouseEnter(screen.getByText('Trigger'));

      const tooltip = await screen.findByTestId('tooltip');
      // The first paint parks the tooltip offscreen; wait for the measured pass.
      await waitFor(() => {
        expect(tooltip.style.top).not.toBe('-9999px');
      });
      return tooltip;
    };

    it('flips below the trigger when the trigger hugs the top edge', async () => {
      // spaceAbove = 0 - 8 = -8, spaceBelow = 800 - 20 - 8 = 772 -> below wins.
      const tooltip = await showAtEdge(asRect(450, 0, 100, 20));

      // triggerRect.bottom (20) + ARROW_HEIGHT (0) + MARGIN (8)
      expect(tooltip.style.top).toBe('28px');
      expect(parseFloat(tooltip.style.top)).toBeGreaterThanOrEqual(MARGIN);
    });

    it('flips above the trigger when the trigger hugs the bottom edge', async () => {
      // spaceAbove = 780 - 8 = 772, spaceBelow = 800 - 800 - 8 = -8 -> above wins.
      const tooltip = await showAtEdge(asRect(450, 780, 100, 20));

      // triggerRect.top (780) - height (60) - ARROW_HEIGHT (0) - MARGIN (8)
      expect(tooltip.style.top).toBe('712px');
      expect(parseFloat(tooltip.style.top) + TOOLTIP_HEIGHT).toBeLessThanOrEqual(
        VIEWPORT_HEIGHT - MARGIN
      );
    });

    it('clamps to the left margin when the trigger hugs the left edge', async () => {
      // Centering would put left at 10 - 100 = -90, which is off-viewport.
      const tooltip = await showAtEdge(asRect(0, 400, 20, 20));

      expect(tooltip.style.left).toBe('8px');
      // Vertically it still prefers above: 400 - 60 - 8 = 332.
      expect(tooltip.style.top).toBe('332px');
    });

    it('clamps to the right margin when the trigger hugs the right edge', async () => {
      // Centering would put left at 990 - 100 = 890, overflowing past maxLeft.
      const tooltip = await showAtEdge(asRect(980, 400, 20, 20));

      // maxLeft = 1000 - 200 - 8
      expect(tooltip.style.left).toBe('792px');
      expect(parseFloat(tooltip.style.left) + TOOLTIP_WIDTH).toBeLessThanOrEqual(
        VIEWPORT_WIDTH - MARGIN
      );
    });
  });
});
