
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NotificationSystem } from '../ui/NotificationSystem';
import { Notification } from '../../types';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div className={className} {...props} data-testid="notification-toast">
        {children}
      </div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false, // Mock reduced motion as false by default
}));

describe('NotificationSystem', () => {
  const mockDispatch = vi.fn();

  beforeEach(() => {
    mockDispatch.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createNotification = (id: string, message: string): Notification => ({
    id,
    message,
    type: 'info',
    duration: 5000,
  });

  it('renders a list of notifications', () => {
    const notifications = [
      createNotification('1', 'Test 1'),
      createNotification('2', 'Test 2'),
    ];

    render(<NotificationSystem notifications={notifications} dispatch={mockDispatch} />);

    expect(screen.getByText('Test 1')).toBeInTheDocument();
    expect(screen.getByText('Test 2')).toBeInTheDocument();
  });

  it('dismisses a notification after clicking close', () => {
    const notifications = [createNotification('1', 'Test 1')];

    render(<NotificationSystem notifications={notifications} dispatch={mockDispatch} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    closeButton.click();

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'REMOVE_NOTIFICATION',
      payload: { id: '1' },
    });
  });

  it('uses a touch-sized close target and keeps mobile toasts away from the action pane', () => {
    const notifications = [createNotification('1', 'Test 1')];

    render(<NotificationSystem notifications={notifications} dispatch={mockDispatch} />);

    const toastRoot = screen.getByTestId('notification-system');
    expect(toastRoot).toHaveClass('justify-end');
    expect(toastRoot).toHaveClass('pb-0');
    expect(toastRoot).toHaveClass('pt-20');
    expect(toastRoot).toHaveClass('sm:p-6');
    expect(toastRoot).toHaveClass('sm:justify-start');
    expect(toastRoot).toHaveClass('z-[var(--z-index-content-overlay-top)]');

    const toast = screen.getByTestId('notification-toast');
    expect(toast).toHaveClass('max-w-[13.5rem]');
    expect(toast).toHaveClass('sm:max-w-sm');

    const closeButton = screen.getByRole('button', { name: /close/i });
    expect(closeButton).toHaveClass('min-h-11');
    expect(closeButton).toHaveClass('min-w-11');
  });

  it('caps the number of active toasts to 5', () => {
    const notifications: Notification[] = [];
    for (let i = 1; i <= 10; i++) {
      notifications.push(createNotification(`${i}`, `Message ${i}`));
    }

    render(<NotificationSystem notifications={notifications} dispatch={mockDispatch} />);

    const toasts = screen.getAllByTestId('notification-toast');
    expect(toasts.length).toBe(5); // Should only render 5

    // Check which ones are rendered. Usually we want the *latest* ones.
    // Assuming the list is appended to, the last 5 are the newest.
    expect(screen.queryByText('Message 1')).not.toBeInTheDocument();
    expect(screen.getByText('Message 6')).toBeInTheDocument();
    expect(screen.getByText('Message 10')).toBeInTheDocument();
  });
});
