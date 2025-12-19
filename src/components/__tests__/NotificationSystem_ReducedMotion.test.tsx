
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationSystem } from '../NotificationSystem';
import { Notification } from '../../types';

// We need to control the return value of useReducedMotion
const mockUseReducedMotion = vi.fn();

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, layout, ...props }: any) => (
      <div
        className={className}
        data-testid="notification-toast"
        data-layout={layout ? 'true' : 'false'}
        data-initial={JSON.stringify(props.initial)}
        data-animate={JSON.stringify(props.animate)}
        data-exit={JSON.stringify(props.exit)}
        {...props}
      >
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
  useReducedMotion: () => mockUseReducedMotion(),
}));

describe('NotificationSystem Reduced Motion', () => {
  const mockDispatch = vi.fn();
  const notification: Notification = {
    id: '1',
    message: 'Test Message',
    type: 'info',
    duration: 5000,
  };

  beforeEach(() => {
    mockDispatch.mockClear();
    mockUseReducedMotion.mockReturnValue(false); // Default to standard motion
  });

  it('uses standard animations when reduced motion is disabled', () => {
    mockUseReducedMotion.mockReturnValue(false);
    render(<NotificationSystem notifications={[notification]} dispatch={mockDispatch} />);

    const toast = screen.getByTestId('notification-toast');

    // Check layout prop
    expect(toast).toHaveAttribute('data-layout', 'true');

    // Check initial animation props (should include y and scale)
    const initial = JSON.parse(toast.getAttribute('data-initial') || '{}');
    expect(initial).toHaveProperty('y', 20);
    expect(initial).toHaveProperty('scale', 0.95);
  });

  it('uses simplified animations when reduced motion is enabled', () => {
    mockUseReducedMotion.mockReturnValue(true);
    render(<NotificationSystem notifications={[notification]} dispatch={mockDispatch} />);

    const toast = screen.getByTestId('notification-toast');

    // Check layout prop is false
    expect(toast).toHaveAttribute('data-layout', 'false');

    // Check initial animation props (should NOT include y or scale, only opacity)
    const initial = JSON.parse(toast.getAttribute('data-initial') || '{}');
    expect(initial).not.toHaveProperty('y');
    expect(initial).not.toHaveProperty('scale');
    expect(initial).toHaveProperty('opacity', 0);
  });
});
