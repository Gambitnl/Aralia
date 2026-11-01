
import React from 'react';
import { ItemType } from '../../../types';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HAGGLE_COOLDOWN_MS, buildHaggleFactText } from '../../../utils/economy/haggleFact';
import MerchantModal from '../MerchantModal';
import { Item } from '../../../types';

// Mock dependencies.
// The game state is mutable per-test so the haggle cases below can put a real
// `recent_haggle` fact on a real merchant id; `resetMockState` restores the
// plain shop every other test assumes.
const BASE_MOCK_STATE = {
  economy: {
    marketFactors: { surplus: [], scarcity: [] },
    buyMultiplier: 1,
    sellMultiplier: 0.5,
    activeEvents: []
  }
};

const mock = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));

const resetMockState = () => { mock.state = { ...BASE_MOCK_STATE }; };
resetMockState();

vi.mock('../../../state/GameContext', () => ({
  useGameState: () => ({ state: mock.state })
}));

vi.mock('../../../hooks/useFocusTrap', () => ({
  useFocusTrap: () => ({ current: document.createElement('div') })
}));

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../Town/Intrigue/RumorMill', () => ({
  RumorMill: () => <div>Local gossip counter</div>,
}));

describe('MerchantModal', () => {
  const mockOnClose = vi.fn();
  const mockOnAction = vi.fn();

  beforeEach(() => {
    resetMockState();
    mockOnAction.mockClear();
    mockOnClose.mockClear();
  });

  const mockItem: Item = {
    id: 'test-item-1',
    name: 'Test Sword',
    type: ItemType.Weapon,
    description: 'A sharp sword',
    weight: 2,
    cost: '10 gp',
    costInGp: 10
  };

  const defaultProps = {
    isOpen: true,
    merchantName: 'Test Merchant',
    merchantInventory: [mockItem],
    playerInventory: [],
    playerGold: 100,
    onClose: mockOnClose,
    onAction: mockOnAction,
  };

  it('keeps a paid rumor receipt out of physical resale', () => {
    render(<MerchantModal {...defaultProps} playerInventory={[{id:'rumor_paid',sourceId:'gossip_paid',name:'Rumor',
      type:ItemType.Service,cost:'0',weight:0,description:'Retained knowledge'}]}/>);
    expect(screen.queryByRole('button',{name:/Sell Rumor/})).not.toBeInTheDocument();
    expect(screen.getByText('Your Inventory')).toBeInTheDocument();
  });
  it('uses carried coin quantities for affordability and the displayed purse', () => {
    render(<MerchantModal {...defaultProps} playerGold={2} playerInventory={[{
      id:'gold_piece', name:'Gold Piece', type:ItemType.Treasure, quantity:8,
      costInGp:1, weight:0.02, description:'Earned money', isJunk:true,
    }]}/>);
    const buy = screen.getByRole('button', { name: /Buy Test Sword for/ });
    expect(buy).toBeEnabled();
    expect(screen.getByRole('img', { name:'1 Platinum pieces' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name:/Sell Gold Piece/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name:/Sell All Junk/ })).not.toBeInTheDocument();
    fireEvent.click(buy);
    expect(mockOnAction).toHaveBeenCalledWith(expect.objectContaining({type:'BUY_ITEM'}));
  });

  it('does not offer persisted currency stock as merchandise', () => {
    render(<MerchantModal {...defaultProps} merchantInventory={[{
      id:'electrum_piece', name:'Electrum Piece', type:ItemType.Treasure,
      costInGp:0.5, weight:0.02, description:'Money',
    }]}/>);
    expect(screen.queryByRole('button', {name:/Buy Electrum/})).not.toBeInTheDocument();
    expect(screen.getByText('Sold out.')).toBeInTheDocument();
  });

  it('renders correctly when open', () => {
    render(<MerchantModal {...defaultProps} />);

    // Now rendered inside the shared WindowFrame (data-testid window-<key>), with
    // the merchant name as the window title.
    const windowEl = screen.getByTestId('window-merchant-window');
    expect(windowEl).toBeInTheDocument();
    expect(screen.getByText('Test Merchant')).toBeInTheDocument();
  });

  it('starts a paid-information inquiry on gossip and keeps ordinary shops on trade', () => {
    mock.state={...mock.state,merchantModal:{merchantId:'keeper',initialTab:'gossip'},generatedNpcs:{keeper:{businessId:'shop'}},worldBusinesses:{shop:{ownerId:'keeper',businessType:'tavern'}}};
    const view=render(<MerchantModal {...defaultProps} />);
    expect(screen.getByText('Local gossip counter')).toBeInTheDocument();
    view.unmount();mock.state={...mock.state,worldBusinesses:{shop:{ownerId:'keeper',businessType:'smithy'}}};
    render(<MerchantModal {...defaultProps} />);
    expect(screen.queryByText('Local gossip counter')).not.toBeInTheDocument();
  });

  it('opens gossip for a registered tavern whose name does not describe its type', () => {
    mock.state = {...mock.state,
      merchantModal: {merchantId: 'keeper'},
      generatedNpcs: {keeper: {businessId: 'dragon'}},
      worldBusinesses: {dragon: {ownerId: 'keeper', businessType: 'tavern'}},
    };
    render(<MerchantModal {...defaultProps} merchantName="The Howling Dragon" />);
    fireEvent.click(screen.getByRole('button', {name: 'Rumors'}));
    expect(screen.getByText('Local gossip counter')).toBeInTheDocument();
  });

  it('finds a saved proprietor business when the NPC has no business link', () => {
    mock.state = {...mock.state,
      merchantModal: {merchantId: 'keeper'},
      worldBusinesses: {dragon: {ownerId: 'keeper', businessType: 'tavern'}},
    };
    render(<MerchantModal {...defaultProps} merchantName="The Howling Dragon" />);
    expect(screen.getByRole('button', {name: 'Rumors'})).toBeInTheDocument();
  });

  it('uses the registered shop type even when its name contains inn', () => {
    mock.state = {...mock.state,
      merchantModal: {merchantId: 'keeper'},
      generatedNpcs: {keeper: {businessId: 'smith'}},
      worldBusinesses: {smith: {ownerId: 'keeper', businessType: 'smithy'}},
    };
    render(<MerchantModal {...defaultProps} merchantName="The Spinning Anvil" />);
    expect(screen.queryByRole('button', {name: 'Rumors'})).not.toBeInTheDocument();
  });

  it('keeps the tavern entry for legacy merchants without a registered business', () => {
    render(<MerchantModal {...defaultProps} merchantName="Old Road Inn" />);
    expect(screen.getByRole('button', {name: 'Rumors'})).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<MerchantModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('window-merchant-window')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<MerchantModal {...defaultProps} />);

    // WindowFrame's shared close control.
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('displays correct aria-labels for actions', () => {
    render(<MerchantModal {...defaultProps} />);

    const buyButton = screen.getByLabelText(/Buy Test Sword/i);
    expect(buyButton).toBeInTheDocument();
  });

  it('dispatches BUY_ITEM in the transaction-wrapped shape the handler consumes', () => {
    // Regression guard: a flat { item, cost } payload was silently ignored by
    // handleMerchantAction (it reads payload.transaction.buy), so every Buy
    // click did nothing. The payload MUST be transaction-wrapped.
    const cheapItem: Item = {
      id: 'torch-item-1',
      name: 'Torch',
      type: ItemType.LightSource,
      description: 'A simple torch',
      weight: 1,
      cost: '1 cp',
      costInGp: 0.01
    };

    render(
      <MerchantModal
        {...defaultProps}
        merchantInventory={[cheapItem]}
        playerGold={1}
      />
    );

    fireEvent.click(screen.getByLabelText(/Buy Torch/i));

    expect(mockOnAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'BUY_ITEM',
        payload: expect.objectContaining({
          transaction: expect.objectContaining({
            buy: expect.objectContaining({
              item: expect.objectContaining({ id: 'torch-item-1' }),
              cost: 0.01,
            }),
          }),
        }),
      })
    );
  });

  it('dispatches SELL_ITEM in the transaction-wrapped shape the handler consumes', () => {
    const ownedItem: Item = {
      id: 'owned-gem-1',
      name: 'Gem',
      type: ItemType.Treasure,
      description: 'A shiny gem',
      weight: 0.1,
      cost: '20 gp',
      costInGp: 20,
    };

    render(
      <MerchantModal
        {...defaultProps}
        merchantInventory={[]}
        playerInventory={[ownedItem]}
      />
    );

    fireEvent.click(screen.getByLabelText(/Sell Gem/i));

    expect(mockOnAction).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'SELL_ITEM',
        payload: expect.objectContaining({
          transaction: expect.objectContaining({
            sell: expect.objectContaining({ itemId: 'owned-gem-1' }),
          }),
        }),
      })
    );
  });

  it('renders a path-style icon as an image, not raw text', () => {
    const stockedItem: Item = {
      ...mockItem,
      id: 'dagger-1',
      name: 'Dagger',
      icon: '/assets/icons/items/dagger.svg',
    };
    render(<MerchantModal {...defaultProps} merchantInventory={[stockedItem]} />);

    // No raw path text anywhere
    expect(screen.queryByText('/assets/icons/items/dagger.svg')).not.toBeInTheDocument();
    // An <img> whose src resolves to the asset
    const dialog = screen.getByTestId('window-merchant-window');
    const img = dialog.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toMatch(/assets\/icons\/items\/dagger\.svg$/);
  });

  it('renders the curated type icon for items with a legacy emoji', () => {
    render(<MerchantModal {...defaultProps} merchantInventory={[{ ...mockItem, icon: '🗡️' }]} />);
    const image = screen.getByTestId('window-merchant-window').querySelector('img');
    expect(image).not.toBeNull();
    expect(image!.getAttribute('src')).toMatch(/assets\/icons\/tw-dnd\/entity\/weapon\.svg$/);
  });

  it('hides the market-conditions line when there is no surplus or scarcity', () => {
    render(<MerchantModal {...defaultProps} />);
    expect(screen.queryByText(/surplus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/scarcity/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/none/i)).not.toBeInTheDocument();
  });

  it('shows flavor text when the market has surplus and scarcity', () => {
    render(
      <MerchantModal
        {...defaultProps}
        economy={{
          marketFactors: { surplus: ['food'], scarcity: ['weapon'] },
          buyMultiplier: 1,
          sellMultiplier: 0.5,
          activeEvents: [],
        } as any}
      />
    );
    expect(screen.getByText(/Plenty of food this season — prices are down\. Weapon is scarce — prices are up\./)).toBeInTheDocument();
  });
  /**
   * UI-3 haggle flow consistency (agora-a95f.3). Before this, the modal never
   * knew which merchant it was showing: Haggle dispatched without a merchantId
   * (so nothing was ever recorded) and the price on the Buy button ignored any
   * discount that had been negotiated.
   */
  describe('haggle awareness', () => {
    const NOW = 5_000_000;

    const withActiveHaggle = (priceMultiplier: number) => {
      mock.state = {
        ...BASE_MOCK_STATE,
        gameTime: new Date(NOW),
        merchantModal: { isOpen: true, merchantId: 'merchant_1', merchantName: 'Test Merchant', merchantInventory: [] },
        npcMemory: {
          merchant_1: {
            disposition: 0,
            goals: [],
            knownFacts: [{
              id: 'recent_haggle',
              text: buildHaggleFactText(priceMultiplier, NOW - 1000),
              source: 'direct',
              isPublic: false,
              timestamp: NOW - 1000,
              strength: 1,
              lifespan: HAGGLE_COOLDOWN_MS,
            }],
          },
        },
      };
    };

    it('sends the merchantId with a haggle so the handler can record it', () => {
      withActiveHaggle(1);
      // This case is a new attempt, so retain the keeper but remove prior negotiation.
      (mock.state.npcMemory as { merchant_1: { knownFacts: unknown[] } }).merchant_1.knownFacts = [];
      render(<MerchantModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText('Haggle using Persuade'));

      expect(mockOnAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'HAGGLE_ITEM',
          payload: expect.objectContaining({ merchantId: 'merchant_1', strategy: 'persuade' }),
        })
      );
    });

    it('shows a saved unchanged-price negotiation and refuses repeat input until its cooldown expires', () => {
      withActiveHaggle(1);
      const view = render(<MerchantModal {...defaultProps} />);
      expect(screen.getByRole('status')).toHaveTextContent('The keeper is holding to their current prices.');
      expect(screen.getByRole('status')).toHaveTextContent('24 hours');
      const persuade = screen.getByLabelText('Haggle using Persuade');
      expect(persuade).toBeDisabled();
      fireEvent.click(persuade);
      expect(mockOnAction).not.toHaveBeenCalled();
      // The recorded fact remains unchanged; ordinary world time makes it expire.
      mock.state.gameTime = new Date(NOW + HAGGLE_COOLDOWN_MS);
      view.rerender(<MerchantModal {...defaultProps} />);
      expect(screen.getByLabelText('Haggle using Persuade')).toBeEnabled();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('shows the discounted price on the Buy button after a successful haggle', () => {
      withActiveHaggle(0.8);
      render(<MerchantModal {...defaultProps} />); // Test Sword costs 10 gp

      // 10 * 0.8 = 8
      expect(screen.getByLabelText(/Buy Test Sword for 8 GP/i)).toBeInTheDocument();
      expect(screen.getByText('▼ Haggled Down')).toBeInTheDocument();
    });

    it('shows the raised price after a failed intimidation', () => {
      withActiveHaggle(1.1);
      render(<MerchantModal {...defaultProps} />);

      expect(screen.getByLabelText(/Buy Test Sword for 1 PP, 1 GP/i)).toBeInTheDocument();
      expect(screen.getByText('▲ Haggled Up')).toBeInTheDocument();
    });

    it('ignores an expired haggle fact and shows full price', () => {
      withActiveHaggle(0.8);
      // Advance the clock past the fact's lifespan.
      (mock.state as { gameTime: Date }).gameTime = new Date(NOW + HAGGLE_COOLDOWN_MS);
      render(<MerchantModal {...defaultProps} />);

      expect(screen.getByLabelText(/Buy Test Sword for 1 PP/i)).toBeInTheDocument();
      expect(screen.queryByText(/Haggled/)).not.toBeInTheDocument();
    });

    it('still sends the base cost, letting the handler own the multiplier', () => {
      withActiveHaggle(0.8);
      render(<MerchantModal {...defaultProps} />);

      fireEvent.click(screen.getByLabelText(/Buy Test Sword/i));

      expect(mockOnAction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BUY_ITEM',
          payload: expect.objectContaining({
            merchantId: 'merchant_1',
            transaction: expect.objectContaining({
              buy: expect.objectContaining({ cost: 10 }),
            }),
          }),
        })
      );
    });
  });
  it('quotes a registered shelf once under scarcity and shows available units', () => {
    mock.state = { ...mock.state, merchantModal: { merchantId: 'keeper' },
      economy: { marketFactors: { surplus: [], scarcity: ['food_drink'] }, buyMultiplier: 1, sellMultiplier: 0.5, activeEvents: [] },
      worldBusinesses: { shop: { ownerId: 'keeper', businessType: 'tavern', priceMultiplier: 1.2, stock: [{ itemId: 'rations', quantity: 9 }] } },
    };
    const stocked = { ...mockItem, id: 'rations', name: 'Rations', type: ItemType.FoodDrink, costInGp: 0.9, quantity: 9 };
    render(<MerchantModal {...defaultProps} merchantInventory={[stocked]} />);
    expect(screen.getByRole('button', { name: 'Buy Rations for 9 SP' })).toBeEnabled();
    expect(screen.getByText('9 in stock • Buy one')).toBeInTheDocument();
  });

  it('identifies the selected duplicate row and states one-unit resale clearly', () => {
    const original = { ...mockItem, quantity: 5, acquiredAt: 100 };
    const purchased = { ...mockItem, quantity: 1, acquiredAt: 200 };
    render(<MerchantModal {...defaultProps} playerInventory={[original, purchased]} />);
    expect(screen.getByText('5 owned • Sell one for 5 GP')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', {name: /Sell Test Sword/})[1]);
    expect(mockOnAction).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({
      transaction: { sell: { itemId: mockItem.id, value: 5, inventoryIndex: 1, inventoryItem: purchased } },
    }) }));
  });

  it('preserves faction savings in a registered quote and its purchase payload', () => {
    mock.state = { ...mock.state, merchantModal: { merchantId: 'keeper' },
      factions: { guild: { id: 'guild', controlledRegionIds: ['region'] } },
      playerFactionStandings: { guild: { publicStanding: 100 } },
      worldBusinesses: { shop: { ownerId: 'keeper', businessType: 'smithy', priceMultiplier: 1.2, stock: [{ itemId: 'longsword', quantity: 1 }] } },
    };
    const shelf = { ...mockItem, id: 'longsword', name: 'Longsword', costInGp: 18, quantity: 1 };
    render(<MerchantModal {...defaultProps} regionId="region" merchantInventory={[shelf]} playerGold={15.3} />);
    const buy = screen.getByRole('button', {name:'Buy Longsword for 1 PP, 5 GP, 3 SP'});
    expect(buy).toBeEnabled();
    fireEvent.click(buy);
    expect(mockOnAction).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({
      transaction: { buy: { item: shelf, cost: 15.3 } },
    }) }));
  });

});
