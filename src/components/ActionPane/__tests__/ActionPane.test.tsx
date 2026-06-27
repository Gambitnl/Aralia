import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ActionPane from '../index';
import { Action, Item, Location, NPC, PlayerCharacter } from '../../../types';

// Mock framer-motion to avoid animation issues and hoisting errors
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  const React = await import('react');

  // Define types for props we want to strip
  type MotionProps = {
    whileHover?: unknown;
    whileTap?: unknown;
    layout?: unknown;
    initial?: unknown;
    animate?: unknown;
    exit?: unknown;
    transition?: unknown;
    children?: React.ReactNode;
  } & React.ComponentPropsWithoutRef<'button'> & React.ComponentPropsWithoutRef<'div'>;

  const MotionButton = React.forwardRef<HTMLButtonElement, MotionProps>(
    ({ whileHover, whileTap, layout, initial, animate, exit, transition, ...props }, ref) => (
      <button ref={ref} {...(props as React.ComponentPropsWithoutRef<'button'>)} />
    )
  );
  MotionButton.displayName = 'MotionButton';

  const MotionDiv = React.forwardRef<HTMLDivElement, MotionProps>(
    ({ layout, initial, animate, exit, transition, ...props }, ref) => (
      <div ref={ref} {...(props as React.ComponentPropsWithoutRef<'div'>)} />
    )
  );
  MotionDiv.displayName = 'MotionDiv';

  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      button: MotionButton,
      div: MotionDiv,
    },
  };
});

vi.mock('../../../utils/permissions', () => ({
  canUseDevTools: () => true,
}));

describe('ActionPane', () => {
  const baseLocation: Location = {
    id: 'town_square',
    name: 'Town Square',
    baseDescription: 'A busy hub',
    exits: { Market: 'market_1', North: 'coord_north' },
    mapCoordinates: { x: 0, y: 0 },
    biomeId: 'plains',
  };

  const lockedLocation: Location = {
    ...baseLocation,
    id: 'cave_entrance',
    name: 'Cave Entrance',
    interactableFeatures: [
      {
        id: 'cave-entrance-lock',
        type: 'lock',
        label: 'Open Cave Entrance Lock',
        lock: {
          id: 'lock-cave-entrance',
          dc: 14,
          breakDC: 20,
          isLocked: true,
          isBroken: false,
          isTrapped: true,
          trap: {
            id: 'trap-poison-mist',
            name: 'Poison Mist Spray',
            detectionDC: 12,
            disarmDC: 14,
            triggerCondition: 'interaction',
            effect: { damage: { count: 1, sides: 6, bonus: 0 }, damageType: 'poison' },
            resetable: false,
            isDisarmed: false,
            isTriggered: false,
          },
        },
      },
    ],
  };

  const puzzleLocation: Location = {
    ...baseLocation,
    id: 'moon_gate',
    name: 'Moon Gate',
    interactableFeatures: [
      {
        id: 'moon-gate-riddle',
        type: 'puzzle',
        label: 'Study Moon Gate Riddle',
        puzzle: {
          id: 'puzzle-moon-gate',
          name: 'Moon Gate Riddle',
          type: 'riddle',
          description: 'A silver door asks what grows brighter in darkness.',
          hint: 'Think about moonlight.',
          hintDC: 12,
          acceptedAnswers: ['moon'],
          isSolved: false,
          isFailed: false,
          currentAttempts: 0,
          currentInputSequence: [],
          onSuccess: { message: 'The moon gate opens.' },
          onFailure: { message: 'The silver door remains shut.' },
        },
      },
    ],
  };

  const npcsInLocation: NPC[] = [
    { id: 'npc-1', name: 'Ava', baseDescription: '', initialPersonalityPrompt: '', role: 'civilian' },
  ];

  const itemsInLocation: Item[] = [
    { id: 'item-1', name: 'Ancient Coin', description: '', type: 'treasure' },
  ];

  const mockPartyMember: PlayerCharacter = {
    id: 'party-1',
    name: 'Test Hero',
    level: 1,
    proficiencyBonus: 2,
    race: { id: 'human', name: 'Human', description: '', traits: [] },
    class: {
      id: 'fighter',
      name: 'Fighter',
      description: '',
      hitDie: 10,
      primaryAbility: ['Strength'],
      savingThrowProficiencies: ['Strength'],
      skillProficienciesAvailable: [],
      numberOfSkillProficiencies: 0,
      armorProficiencies: [],
      weaponProficiencies: [],
      features: [],
    },
    abilityScores: {
      Strength: 10,
      Dexterity: 10,
      Constitution: 10,
      Intelligence: 10,
      Wisdom: 10,
      Charisma: 10,
    },
    finalAbilityScores: {
      Strength: 10,
      Dexterity: 10,
      Constitution: 10,
      Intelligence: 10,
      Wisdom: 10,
      Charisma: 10,
    },
    skills: [],
    hp: 8,
    maxHp: 10,
    armorClass: 10,
    speed: 30,
    darkvisionRange: 0,
    transportMode: 'foot',
    statusEffects: [],
    equippedItems: {},
  };

  const defaultProps = {
    currentLocation: baseLocation,
    npcsInLocation,
    itemsInLocation,
    party: [mockPartyMember],
    onAction: vi.fn(),
    disabled: false,
    geminiGeneratedActions: null as Action[] | null,
    isDevModeEnabled: false,
    unreadDiscoveryCount: 0,
    hasNewRateLimitError: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const openSystemMenu = () => {
    fireEvent.click(screen.getByRole('button', { name: /^Menu$/i }));
  };

  it('renders context-aware actions for NPCs, items, and named exits', () => {
    render(<ActionPane {...defaultProps} />);

    expect(screen.getByText('Talk to Ava')).toBeInTheDocument();
    expect(screen.getByText('Take Ancient Coin')).toBeInTheDocument();
    expect(screen.getByText('Go Market')).toBeInTheDocument();
    expect(screen.queryByText('Go North')).not.toBeInTheDocument();
    expect(screen.getByText('Enter Town')).toBeInTheDocument();
    expect(screen.getByText('Scout Town')).toBeInTheDocument();
    expect(screen.getByText('Approach Cautiously')).toBeInTheDocument();
  });

  it('invokes onAction when an action button is clicked', () => {
    render(<ActionPane {...defaultProps} />);

    fireEvent.click(screen.getByText('Talk to Ava'));
    expect(defaultProps.onAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'talk', targetId: 'npc-1' })
    );

    fireEvent.click(screen.getByText('Take Ancient Coin'));
    expect(defaultProps.onAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'take_item', targetId: 'item-1' })
    );

    fireEvent.click(screen.getByText('Go Market'));
    expect(defaultProps.onAction).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'move', targetId: 'market_1' })
    );
  });

  it('invokes onAction when town context actions are clicked', () => {
    const onAction = vi.fn();
    render(<ActionPane {...defaultProps} onAction={onAction} />);

    fireEvent.click(screen.getByText('Enter Town'));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'ENTER_VILLAGE' }));

    fireEvent.click(screen.getByText('Scout Town'));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'OBSERVE_TOWN' }));

    fireEvent.click(screen.getByText('Approach Cautiously'));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'APPROACH_TOWN' }));
  });

  it('renders lockpicking actions for location interactable locks and routes payload to action', () => {
    const onAction = vi.fn();
    render(
      <ActionPane
        {...defaultProps}
        currentLocation={lockedLocation}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByText('Open Cave Entrance Lock'));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OPEN_LOCKPICKING_MODAL',
        payload: expect.objectContaining({
          id: 'lock-cave-entrance',
          dc: 14,
          isLocked: true,
        }),
      })
    );
  });

  it('renders puzzle actions for location interactable puzzles and routes payload to the runtime surface', () => {
    const onAction = vi.fn();
    render(
      <ActionPane
        {...defaultProps}
        currentLocation={puzzleLocation}
        onAction={onAction}
      />
    );

    fireEvent.click(screen.getByText('Study Moon Gate Riddle'));
    expect(onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'OPEN_PUZZLE_RUNTIME',
        payload: expect.objectContaining({
          id: 'puzzle-moon-gate',
          hint: 'Think about moonlight.',
        }),
      })
    );
  });

  it('submits oracle queries with the provided text', () => {
    render(<ActionPane {...defaultProps} />);

    fireEvent.click(screen.getByText('Ask the Oracle'));
    fireEvent.change(screen.getByPlaceholderText('Ask your question...'), { target: { value: 'What now?' } });
    fireEvent.click(screen.getByText('Submit'));

    expect(defaultProps.onAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ask_oracle',
        payload: expect.objectContaining({ query: 'What now?' }),
      })
    );
  });

  it('disables interaction when disabled is true', () => {
    const onAction = vi.fn();
    render(<ActionPane {...defaultProps} disabled={true} onAction={onAction} />);

    fireEvent.click(screen.getByText('Survey Surroundings'));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('emits ANALYZE_SITUATION when Survey Surroundings is clicked', () => {
    const onAction = vi.fn();
    render(<ActionPane {...defaultProps} onAction={onAction} />);

    fireEvent.click(screen.getByText('Survey Surroundings'));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'ANALYZE_SITUATION' }));
  });

  it('passes string move targetIds through without rewriting them', () => {
    const onAction = vi.fn();
    const geminiActions: Action[] = [
      {
        type: 'move',
        label: 'Move to point',
        payload: { query: 'Move to point' },
        targetId: 'market_1',
      },
    ];
    render(<ActionPane {...defaultProps} geminiGeneratedActions={geminiActions} onAction={onAction} />);

    fireEvent.click(screen.getByText('Move to point'));
    expect(onAction).toHaveBeenCalledWith(geminiActions[0]);
  });

  it('emits the visible system-menu action types and keeps the discovery badge visible', () => {
    const onAction = vi.fn();
    render(
      <ActionPane
        {...defaultProps}
        unreadDiscoveryCount={7}
        onAction={onAction}
      />
    );

    const menuCases: Array<[string, Partial<Action>]> = [
      ['Discoveries', { type: 'TOGGLE_DISCOVERY_LOG' }],
      ['Quests', { type: 'TOGGLE_QUEST_LOG' }],
      ['Dossiers', { type: 'TOGGLE_LOGBOOK' }],
      ['Glossary', { type: 'TOGGLE_GLOSSARY_VISIBILITY' }],
      ['Party', { type: 'toggle_party_overlay' }],
      ['Game Guide', { type: 'TOGGLE_GAME_GUIDE' }],
      ['Save Game', { type: 'save_game' }],
      ['Auto-save: On', { type: 'toggle_auto_save' }],
      ['Main Menu', { type: 'go_to_main_menu' }],
      ['Enable Dev Mode', { type: 'SET_DEV_MODE_ENABLED', payload: { enabled: true } }],
    ];

    menuCases.forEach(([label, expected], index) => {
      openSystemMenu();
      if (index === 0) {
        expect(screen.getByText('7')).toBeInTheDocument();
      }
      fireEvent.click(screen.getByRole('menuitem', { name: label }));
      expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining(expected));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    expect(onAction).toHaveBeenCalledTimes(menuCases.length);
  });

  it('emits dev-menu actions when dev mode is active', () => {
    const onAction = vi.fn();
    render(
      <ActionPane
        {...defaultProps}
        onAction={onAction}
        isDevModeEnabled={true}
        hasNewRateLimitError={true}
      />
    );

    openSystemMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Disable Dev Mode' }));
    expect(onAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: 'SET_DEV_MODE_ENABLED',
        payload: { enabled: false },
      })
    );

    openSystemMenu();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Dev Menu' }));
    expect(onAction).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'toggle_dev_menu' }));
  });

  it('opens the short-rest modal and emits SHORT_REST when confirmed', () => {
    const onAction = vi.fn();
    render(<ActionPane {...defaultProps} onAction={onAction} />);

    fireEvent.click(screen.getByText('Short Rest'));
    expect(screen.getByRole('dialog', { name: 'Short Rest' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('Begin Rest'));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'SHORT_REST' }));
  });

  it('emits TOGGLE_LONG_REST_MODAL when Long Rest is clicked', () => {
    const onAction = vi.fn();
    render(<ActionPane {...defaultProps} onAction={onAction} />);

    fireEvent.click(screen.getByText('Long Rest'));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'TOGGLE_LONG_REST_MODAL' }));
  });

  it('renders Dev Menu when dev mode is active and rate limit notification is present', () => {
    render(
      <ActionPane
        {...defaultProps}
        isDevModeEnabled={true}
        hasNewRateLimitError={true}
      />
    );

    // Use the system menu trigger label ("Menu") to avoid matching "Dev Menu" buttons.
    fireEvent.click(screen.getByRole('button', { name: /^Menu$/i }));
    // Assert the menu entry specifically to avoid the standalone Dev Menu action button.
    expect(screen.getByRole('menuitem', { name: 'Dev Menu' })).toBeInTheDocument();
  });
});
