import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuestLog from '../index';
import { Quest, QuestStatus } from '@/types';

// Mock types
const mockQuests: Quest[] = [
  {
    id: 'q1',
    title: 'Test Active Quest',
    description: 'A test quest',
    status: QuestStatus.Active,
    giverId: 'npc1',
    dateStarted: 1000,
    objectives: [
      { id: 'o1', description: 'Objective 1', isCompleted: false },
      { id: 'o2', description: 'Objective 2', isCompleted: true }
    ],
    rewards: { gold: 100 }
  },
  {
    id: 'q2',
    title: 'Test Completed Quest',
    description: 'Done',
    status: QuestStatus.Completed,
    giverId: 'npc1',
    dateStarted: 1000,
    dateCompleted: 2000,
    objectives: [],
    rewards: {}
  },
  {
    id: 'q3',
    title: 'Test Failed Quest',
    description: 'Failed',
    status: QuestStatus.Failed,
    giverId: 'npc1',
    dateStarted: 1000,
    dateCompleted: 2000,
    objectives: [],
    rewards: {}
  }
];

describe('QuestLog Component', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(<QuestLog isOpen={false} onClose={vi.fn()} quests={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders correctly when open', () => {
    render(<QuestLog isOpen={true} onClose={vi.fn()} quests={mockQuests} />);
    expect(screen.getByText('Quest Log')).toBeInTheDocument();
    expect(screen.getByText('Test Active Quest')).toBeInTheDocument();
    expect(screen.getByText('Test Completed Quest')).toBeInTheDocument();
    expect(screen.getByText('Test Failed Quest')).toBeInTheDocument();
  });

  it('displays active quest details', () => {
    render(<QuestLog isOpen={true} onClose={vi.fn()} quests={mockQuests} />);
    // Check objective text
    expect(screen.getByText('Objective 1')).toBeInTheDocument();
    expect(screen.getByText('Objective 2')).toBeInTheDocument();
    // Check rewards
    expect(screen.getByText('100 gp')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<QuestLog isOpen={true} onClose={onClose} quests={mockQuests} />);
    screen.getByLabelText('Close quest log').click();
    expect(onClose).toHaveBeenCalled();
  });

  it('renders "No active quests" when none are active', () => {
    render(<QuestLog isOpen={true} onClose={vi.fn()} quests={[]} />);
    expect(screen.getByText('No active quests.')).toBeInTheDocument();
  });
});
