/**
 * @file src/components/Combat/__tests__/CombatLog.test.tsx
 *
 * Component tests for CombatLog: channel tab filtering, rich defense tag badge rendering,
 * and popout window controls.
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CombatLog from '../CombatLog';
import type { CombatLogEntry } from '../../../types/combat';
import {
  CombatMessageType,
  MessagePriority,
  MessageChannel,
  type CombatMessage,
} from '../../../types/combatMessages';

const testLogEntries: CombatLogEntry[] = [
  {
    id: 'entry-1',
    message: 'Kaelen strikes Goblin for 14 fire damage [Resisted: Fire (-50%)] [Crit].',
    type: 'damage',
    timestamp: 100,
  },
  {
    id: 'entry-2',
    message: 'Aeliana recovers 10 HP from Healing Light.',
    type: 'heal',
    timestamp: 200,
  },
  {
    id: 'entry-3',
    message: 'Goblin is affected by Poisoned [Vulnerable: Radiant (+100%)].',
    type: 'status',
    timestamp: 300,
  },
  {
    id: 'entry-4',
    message: 'Round 1 begins!',
    type: 'turn_start',
    timestamp: 400,
  },
];

const testRichMessages: CombatMessage[] = [
  {
    id: 'msg-1',
    type: CombatMessageType.DAMAGE_DEALT,
    priority: MessagePriority.HIGH,
    timestamp: 100,
    channels: [MessageChannel.COMBAT_LOG],
    title: 'Damage Dealt',
    description: 'Kaelen deals 14 fire damage [Resisted: Fire (-50%)] [Crit]',
    data: {
      damageType: 'fire',
      isCritical: true,
      isSneakAttack: false,
      resistanceApplied: true,
      defenseTags: ['[Resisted: Fire (-50%)]', '[Crit]'],
    },
  },
  {
    id: 'msg-2',
    type: CombatMessageType.HEALING_RECEIVED,
    priority: MessagePriority.MEDIUM,
    timestamp: 200,
    channels: [MessageChannel.COMBAT_LOG],
    title: 'Healing',
    description: 'Aeliana recovers 10 HP',
    data: {
      healType: 'hit_points',
      isCritical: false,
    },
  },
];

describe('CombatLog Component', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders combat log channel tabs', () => {
    render(<CombatLog logEntries={testLogEntries} />);

    expect(screen.getByRole('tab', { name: /all/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /damage/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /healing/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /conditions/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /spells/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /system/i })).toBeInTheDocument();
  });

  it('filters log entries when switching channel tabs', () => {
    render(<CombatLog logEntries={testLogEntries} />);

    // Initially "All" tab is active: all entries are present
    expect(screen.getByText(/Kaelen strikes Goblin/i)).toBeInTheDocument();
    expect(screen.getByText(/Aeliana recovers 10 HP/i)).toBeInTheDocument();

    // Click "Damage" tab
    const damageTab = screen.getByRole('tab', { name: /damage/i });
    fireEvent.click(damageTab);

    // Damage entry is present, Heal entry is filtered out
    expect(screen.getByText(/Kaelen strikes Goblin/i)).toBeInTheDocument();
    expect(screen.queryByText(/Aeliana recovers 10 HP/i)).not.toBeInTheDocument();

    // Click "Healing" tab
    const healingTab = screen.getByRole('tab', { name: /healing/i });
    fireEvent.click(healingTab);

    // Heal entry is present, Damage entry is filtered out
    expect(screen.getByText(/Aeliana recovers 10 HP/i)).toBeInTheDocument();
    expect(screen.queryByText(/Kaelen strikes Goblin/i)).not.toBeInTheDocument();
  });

  it('renders defense tags as structured badge pills', () => {
    render(<CombatLog logEntries={testLogEntries} />);

    const resistBadge = screen.getByTitle('[Resisted: Fire (-50%)]');
    expect(resistBadge).toBeInTheDocument();
    expect(resistBadge).toHaveClass('text-cyan-300');

    const vulnBadge = screen.getByTitle('[Vulnerable: Radiant (+100%)]');
    expect(vulnBadge).toBeInTheDocument();
    expect(vulnBadge).toHaveClass('text-purple-300');
  });

  it('renders rich messages in rich display mode', () => {
    render(
      <CombatLog
        logEntries={testLogEntries}
        richMessages={testRichMessages}
        useRichDisplay={true}
      />
    );

    expect(screen.getByText(/Kaelen deals 14 fire damage/i)).toBeInTheDocument();
    const resistBadge = screen.getByTitle('[Resisted: Fire (-50%)]');
    expect(resistBadge).toBeInTheDocument();
  });

  // CMB-GAP-002: rich mode used to render only the description string, so a
  // damage message whose resistance lived on `data` showed nothing at all.
  it('renders structured Resisted and Vulnerable badges from untagged rich payloads', () => {
    const untaggedMessages: CombatMessage[] = [
      {
        id: 'msg-resisted',
        type: CombatMessageType.DAMAGE_DEALT,
        priority: MessagePriority.MEDIUM,
        timestamp: 100,
        channels: [MessageChannel.COMBAT_LOG],
        title: 'Damage Dealt',
        description: 'Goblin takes 6 fire damage from Kaelen',
        data: {
          damageType: 'fire',
          isCritical: false,
          isSneakAttack: false,
          isResisted: true,
          resistanceApplied: true,
          resistedDamageType: 'fire',
        },
      },
      {
        id: 'msg-vulnerable',
        type: CombatMessageType.DAMAGE_DEALT,
        priority: MessagePriority.MEDIUM,
        timestamp: 200,
        channels: [MessageChannel.COMBAT_LOG],
        title: 'Damage Dealt',
        description: 'Goblin takes 24 radiant damage from Aeliana',
        data: {
          damageType: 'radiant',
          isCritical: false,
          isSneakAttack: false,
          isVulnerable: true,
          vulnerabilityApplied: true,
          vulnerableDamageType: 'radiant',
        },
      },
    ];

    render(
      <CombatLog
        logEntries={testLogEntries}
        richMessages={untaggedMessages}
        useRichDisplay={true}
      />
    );

    const resistBadge = screen.getByTestId('defense-badge-resisted');
    expect(resistBadge).toHaveTextContent('Resisted');
    expect(resistBadge).toHaveAttribute('title', 'Resisted: fire (-50%)');
    expect(resistBadge).toHaveClass('text-cyan-300');

    const vulnBadge = screen.getByTestId('defense-badge-vulnerable');
    expect(vulnBadge).toHaveTextContent('Vulnerable');
    expect(vulnBadge).toHaveAttribute('title', 'Vulnerable: radiant (+100%)');
    expect(vulnBadge).toHaveClass('text-purple-300');
  });

  // Duplicate suppression: emitters that already write the tag into the text
  // (CombatLogService.createDamageLogEntry) keep their inline pill only.
  it('does not double up when the message text already carries the defense tag', () => {
    render(
      <CombatLog
        logEntries={testLogEntries}
        richMessages={testRichMessages}
        useRichDisplay={true}
      />
    );

    expect(screen.getByTitle('[Resisted: Fire (-50%)]')).toBeInTheDocument();
    expect(screen.queryByTestId('defense-badge-resisted')).not.toBeInTheDocument();
  });

  it('retains popout trigger button for accessibility and responsive layout', () => {
    render(<CombatLog logEntries={testLogEntries} />);

    const popoutButton = screen.getByRole('button', {
      name: /pop out combat log into resizable window/i,
    });

    expect(popoutButton).toHaveClass('h-11');
    expect(popoutButton).toHaveClass('w-11');
  });
});
