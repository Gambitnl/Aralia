
import { describe, it, expect, vi } from 'vitest';
import { checkDeadlines, createDeadline } from '../DeadlineManager';
import { GameState, Deadline } from '../../../types';

describe('DeadlineManager', () => {
  const mockDate = new Date('2024-01-01T12:00:00Z');
  const mockState: Partial<GameState> = {
    deadlines: [],
    messages: []
  };

  it('creates a deadline with correct structure', () => {
    const deadline = createDeadline(
      'Test Task',
      'Do something',
      mockDate.getTime() + 1000 * 60 * 60 * 25, // 25 hours later
      [],
      [24, 1]
    );

    expect(deadline.title).toBe('Test Task');
    expect(deadline.warningThresholds).toEqual([24, 1]);
    expect(deadline.isCompleted).toBe(false);
    expect(deadline.isExpired).toBe(false);
  });

  it('triggers warnings when approaching deadline', () => {
    const deadline = createDeadline(
      'Urgent Task',
      'Do it now',
      mockDate.getTime() + 1000 * 60 * 60 * 2, // 2 hours later
      [],
      [24, 2] // Warn at 24 and 2 hours
    );

    const state = { ...mockState, deadlines: [deadline] } as GameState;
    const { deadlines, logs } = checkDeadlines(state, mockDate);

    // Should trigger the 24h warning (because 2h <= 24h) AND the 2h warning
    // Wait, the logic is "timeRemaining <= threshold".
    // 2 hours remaining <= 24.
    // 2 hours remaining <= 2.
    // Both triggered.

    const updatedDeadline = deadlines[0];
    expect(updatedDeadline.warningsTriggered).toContain(24);
    expect(updatedDeadline.warningsTriggered).toContain(2);
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].text).toContain('Urgent');
  });

  it('marks deadline as expired and triggers consequences', () => {
    const deadline = createDeadline(
      'Expired Task',
      'Too late',
      mockDate.getTime() - 1000, // 1 second ago
      [{ type: 'LOG_MESSAGE', payload: { message: 'You failed!' } }]
    );

    const state = { ...mockState, deadlines: [deadline] } as GameState;
    const { deadlines, logs } = checkDeadlines(state, mockDate);

    const updatedDeadline = deadlines[0];
    expect(updatedDeadline.isExpired).toBe(true);

    // Logs should contain expiration message + consequence message
    expect(logs.some(l => l.text.includes('Expired'))).toBe(true);
    expect(logs.some(l => l.text.includes('You failed!'))).toBe(true);
  });

  it('skips already expired/completed deadlines', () => {
     const deadline = {
         ...createDeadline('Old', 'Old', 0, []),
         isExpired: true
     };

     const state = { ...mockState, deadlines: [deadline] } as GameState;
     const { deadlines, logs } = checkDeadlines(state, mockDate);

     // No new logs
     expect(logs.length).toBe(0);
     expect(deadlines[0]).toEqual(deadline);
  });
});
