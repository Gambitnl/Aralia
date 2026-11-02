import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import RestModal from '../RestModal';
import LongRestModal from '../LongRestModal';
import { createMockPlayerCharacter } from '../../../utils/core/factories';
import type { Class, AbilityScores } from '../../../types';

vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => React.createRef(),
}));

describe('RestModal', () => {
  it('refuses underwater waiting independently of a private-property rest restriction', async () => {
    const onWait = vi.fn();
    const party = [createMockPlayerCharacter()];
    const view = render(<LongRestModal isOpen party={party} onClose={vi.fn()} onConfirm={vi.fn()} onWait={onWait}
      locationError="You are below the water surface." waitLocationError="You are below the water surface." />);
    expect(screen.getByRole('button', {name: 'Wait 1 hour(s) here'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'Wait 1 hour(s) here'}));
    expect(onWait).not.toHaveBeenCalled();
    view.rerender(<LongRestModal isOpen party={party} onClose={vi.fn()} onConfirm={vi.fn()} onWait={onWait}
      locationError="Permission is required to sleep here." waitLocationError={null} />);
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Wait 1 hour(s) here'}));});
    expect(onWait).toHaveBeenCalledWith(3600);
  });
  it('keeps the short-rest spend map open until recovery finishes and blocks another commitment', async () => {
    let finish!: () => void;
    const confirm = vi.fn(() => new Promise<void>(resolve => {finish = resolve;})), close = vi.fn();
    render(<RestModal isOpen party={[]} onClose={close} onConfirm={confirm} />);
    fireEvent.click(screen.getByRole('button', {name: 'Begin Rest'}));
    fireEvent.click(screen.getByRole('button', {name: 'Resting…'}));
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(confirm).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    await act(async () => {finish();});
    expect(close).toHaveBeenCalledOnce();
  });
  it('explains an unsafe resting place before blocking commitment', () => {
    const onConfirm = vi.fn();
    render(<RestModal isOpen party={[]} onClose={vi.fn()} onConfirm={onConfirm} locationError="Reach dry, supported ground." />);
    expect(screen.getByRole('status')).toHaveTextContent('Reach dry, supported ground.');
    expect(screen.getByRole('button', {name: 'Begin Rest'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'Begin Rest'}));
    expect(onConfirm).not.toHaveBeenCalled();
  });
  const mockParty = [
    createMockPlayerCharacter({
      id: 'char-1',
      name: 'Ada',
      hp: 10,
      maxHp: 20,
      level: 2,
      class: { name: 'Fighter' } as unknown as Class,
      finalAbilityScores: { Constitution: 14 } as unknown as AbilityScores,
      // Fighter level 2 has 2d10 hit dice pool
      classLevels: { fighter: 2 },
    }),
  ];

  it('renders nothing when closed', () => {
    const { container } = render(
      <RestModal
        isOpen={false}
        party={mockParty}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders characters and hit dice details when open', () => {
    render(
      <RestModal
        isOpen={true}
        party={mockParty}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('Short Rest')).toBeInTheDocument();
    expect(screen.getByText('Ada')).toBeInTheDocument();
    expect(screen.getByText('HP 10/20 · Level 2 Fighter')).toBeInTheDocument();
    expect(screen.getByText('2/2 available')).toBeInTheDocument();
  });

  it('locks background page scrolling while open', () => {
    const { unmount } = render(
      <RestModal
        isOpen={true}
        party={mockParty}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(document.body.style.overflow).toBe('hidden');
    expect(document.documentElement.style.overscrollBehavior).toBe('contain');

    unmount();
    expect(document.body.style.overflow).toBe('');
    expect(document.documentElement.style.overscrollBehavior).toBe('');
  });

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(
      <RestModal
        isOpen={true}
        party={mockParty}
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('allows incrementing and decrementing hit dice spend', () => {
    const onConfirm = vi.fn();
    render(
      <RestModal
        isOpen={true}
        party={mockParty}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const plusButton = screen.getByRole('button', { name: 'Spend more d10 for Ada' });
    const minusButton = screen.getByRole('button', { name: 'Spend fewer d10 for Ada' });

    // Spend 1 hit die
    fireEvent.click(plusButton);
    expect(screen.getByText('1')).toBeInTheDocument();

    // Spend 2 hit dice (max available)
    fireEvent.click(plusButton);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(plusButton).toBeDisabled();

    // Decrease to 1
    fireEvent.click(minusButton);
    expect(screen.getByText('1')).toBeInTheDocument();

    // Confirm rest
    fireEvent.click(screen.getByRole('button', { name: 'Begin Rest' }));
    expect(onConfirm).toHaveBeenCalledWith({
      'char-1': {
        10: 1,
      },
    });
  });

  it('keeps short-rest close, stepper, and footer controls touch-sized', () => {
    render(
      <RestModal
        isOpen={true}
        party={mockParty}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Close short rest' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Spend fewer d10 for Ada' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Spend more d10 for Ada' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Begin Rest' })).toHaveClass('min-h-11');
  });

  it('waits for overnight work and prevents duplicate confirmations or early close', async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>(resolve => { finish = resolve; })), onClose = vi.fn();
    render(<LongRestModal isOpen party={mockParty} onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', {name: 'Confirm Long Rest'}));
    expect(screen.getByRole('button', {name: 'Resting…'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'Resting…'}));
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => { finish(); });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows resource limits and blocks a rest during its cooldown', async () => {
    render(<LongRestModal isOpen party={mockParty} onClose={vi.fn()} onConfirm={vi.fn()}
      gameTime={new Date('2000-01-02T08:00:00Z')} lastLongRestAt="2000-01-02T00:00:00Z" rulesEdition="2014" />);
    expect(screen.getByRole('button', {name: 'Confirm Long Rest'})).toBeDisabled();
    await waitFor(() => expect(screen.getByText(/Wait at least 8 more hour/)).toBeVisible());
    // The per-member meal plan replaced the old party-wide supply warning.
    expect(screen.getByText(/No complete meal is available/)).toBeVisible();
    expect(screen.getByText(/Up to half/)).toBeVisible();
  });

  it('lets an eligible party wait one hour for business hours without starting recovery', async () => {
    const onWait = vi.fn(), onConfirm = vi.fn();
    render(<LongRestModal isOpen party={mockParty} onClose={vi.fn()} onConfirm={onConfirm} onWait={onWait} />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Wait 1 hour(s) here' })); });
    expect(onWait).toHaveBeenCalledWith(3600);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('waits fourteen minutes for opening through the existing seconds action without recovery', async () => {
    const onWait=vi.fn(),onConfirm=vi.fn(),onClose=vi.fn();
    render(<LongRestModal isOpen party={mockParty} onClose={onClose} onConfirm={onConfirm} onWait={onWait}
      gameTime={new Date('2000-01-02T07:46:00Z')} lastLongRestAt="2000-01-02T01:00:00Z" />);
    fireEvent.change(screen.getByRole('spinbutton',{name:'Hours to wait'}),{target:{value:'0'}});
    fireEvent.change(screen.getByRole('spinbutton',{name:'Minutes to wait'}),{target:{value:'14'}});
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Wait 14 minute(s) here'}));});
    expect(onWait).toHaveBeenCalledExactlyOnceWith(840);
    expect(onConfirm).not.toHaveBeenCalled();expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button',{name:'Confirm Long Rest'})).toBeDisabled();
  });

  it('keeps cooldown waiting rounded to full hours despite a chosen minute duration', async () => {
    const onWait=vi.fn();
    render(<LongRestModal isOpen party={mockParty} onClose={vi.fn()} onConfirm={vi.fn()} onWait={onWait}
      gameTime={new Date('2000-01-02T08:00:00Z')} lastLongRestAt="2000-01-02T00:00:00Z" />);
    fireEvent.change(screen.getByRole('spinbutton',{name:'Minutes to wait'}),{target:{value:'14'}});
    await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Wait until rest is eligible (8 hours)'}));});
    expect(onWait).toHaveBeenCalledExactlyOnceWith(8*3600);
  });

  it('refuses a zero duration and keeps a minute wait pending until the world finishes',async()=>{
    let finish!:()=>void;
    const onWait=vi.fn(()=>new Promise<void>(resolve=>{finish=resolve;})),onConfirm=vi.fn(),onClose=vi.fn();
    render(<LongRestModal isOpen party={mockParty} onClose={onClose} onConfirm={onConfirm} onWait={onWait}/>);
    fireEvent.change(screen.getByRole('spinbutton',{name:'Hours to wait'}),{target:{value:'0'}});
    expect(screen.getByRole('button',{name:'Wait here'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Wait here'}));expect(onWait).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('spinbutton',{name:'Minutes to wait'}),{target:{value:'1'}});
    fireEvent.click(screen.getByRole('button',{name:'Wait 1 minute(s) here'}));
    expect(onWait).toHaveBeenCalledExactlyOnceWith(60);
    const waiting=screen.getAllByRole('button',{name:'Waiting…'});waiting.forEach(button=>{expect(button).toBeDisabled();fireEvent.click(button);});
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    expect(onWait).toHaveBeenCalledOnce();expect(onConfirm).not.toHaveBeenCalled();expect(onClose).not.toHaveBeenCalled();
    await act(async()=>{finish();});
  });

  it('offers waiting through the normal action without starting recovery', async () => {
    const onWait = vi.fn(), onConfirm = vi.fn(), onClose = vi.fn();
    render(<LongRestModal isOpen party={mockParty} onClose={onClose} onConfirm={onConfirm} onWait={onWait}
      gameTime={new Date('2000-01-02T08:00:00Z')} lastLongRestAt="2000-01-02T00:00:00Z" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Wait until rest is eligible (8 hours)'})); });
    expect(onWait).toHaveBeenCalledWith(8 * 3600);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('can wait for opening hours independently of a longer recovery cooldown', async () => {
    const onWait = vi.fn(), onConfirm = vi.fn();
    render(<LongRestModal isOpen party={mockParty} onClose={vi.fn()} onConfirm={onConfirm} onWait={onWait}
      gameTime={new Date('2000-01-02T05:00:00Z')} lastLongRestAt="2000-01-02T01:00:00Z" />);
    fireEvent.change(screen.getByRole('spinbutton', {name: 'Hours to wait'}), {target: {value: '3'}});
    await act(async () => {fireEvent.click(screen.getByRole('button', {name: 'Wait 3 hour(s) here'}));});
    expect(onWait).toHaveBeenCalledExactlyOnceWith(3 * 3600);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Confirm Long Rest'})).toBeDisabled();
  });

  it('keeps long-rest close, choice select, and footer controls touch-sized', () => {
    const partyWithRestChoice = [
      createMockPlayerCharacter({
        id: 'char-2',
        name: 'Bryn',
        race: {
          id: 'test-race',
          name: 'Test Race',
          description: '',
          traits: [],
          restChoices: [
            {
              id: 'season-choice',
              traitName: 'Seasonal Training',
              options: [{ type: 'season' }],
            },
          ],
        },
      }),
    ];

    render(
      <LongRestModal
        isOpen={true}
        party={partyWithRestChoice}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Cancel long rest' })).toHaveClass('h-11', 'w-11');
    expect(screen.getByRole('combobox')).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Confirm Long Rest' })).toHaveClass('min-h-11');
  });
});


describe('short-rest commitment timing', () => {
  it('explains the remaining cooldown and prevents commitment before the handler must refuse', () => {
    const confirm=vi.fn(),close=vi.fn();
    const gameTime=new Date('0351-01-04T16:20:52.000Z');
    render(<RestModal isOpen party={[createMockPlayerCharacter()]} onClose={close} onConfirm={confirm}
      gameTime={gameTime} shortRestTracker={{restsTakenToday:1,lastRestDay:4,lastRestEndedAtMs:new Date('0351-01-04T16:19:29.000Z').getTime()}} />);
    expect(screen.getByRole('status')).toHaveTextContent('1 hour, 58 minutes');
    expect(screen.getByRole('button',{name:'Begin Rest'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button',{name:'Begin Rest'}));
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Cancel'}));
    expect(close).toHaveBeenCalledOnce();
  });
});
