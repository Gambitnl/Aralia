import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { compareItems, ItemComparisonPanel } from '../ItemComparisonPanel';
import { ItemType, type Item } from '../../../../types/items';

// agora-d1c7.13 (2026-09-13): equipped-versus-candidate comparison.
const sword: Item = { id: 'longsword', name: 'Longsword', description: '', type: ItemType.Weapon, damageDice: '1d8', damageType: 'Slashing', properties: ['Versatile'], weight: 3, value: 15, rarity: 'common', slot: 'MainHand' } as unknown as Item;
const axe: Item = { id: 'greataxe', name: 'Greataxe', description: '', type: ItemType.Weapon, damageDice: '1d12', damageType: 'Slashing', properties: ['Heavy', 'Two-Handed'], weight: 7, value: 30, rarity: 'common', slot: 'MainHand' } as unknown as Item;
const leather: Item = { id: 'leather', name: 'Leather Armor', description: '', type: ItemType.Armor, baseArmorClass: 11, weight: 10, value: 10, slot: 'Torso' } as unknown as Item;
const chain: Item = { id: 'chain', name: 'Chain Mail', description: '', type: ItemType.Armor, baseArmorClass: 16, strengthRequirement: 13, stealthDisadvantage: true, weight: 55, value: 75, slot: 'Torso' } as unknown as Item;

describe('compareItems', () => {
  it('weapons: higher average damage is better, heavier is worse', () => {
    const rows = compareItems(axe, sword);
    const dmg = rows.find((r) => r.label === 'Avg damage')!;
    expect(dmg.candidate).toBe('1d12 Slashing (6.5)');
    expect(dmg.equipped).toBe('1d8 Slashing (4.5)');
    expect(dmg.delta).toBe(2);
    expect(dmg.deltaText).toBe('+2');
    const weight = rows.find((r) => r.label === 'Weight')!;
    expect(weight.delta).toBe(-4);
    expect(weight.deltaText).toBe('+4');
  });

  it('armor: base AC up, strength requirement and stealth disadvantage count against the candidate', () => {
    const rows = compareItems(chain, leather);
    expect(rows.find((r) => r.label === 'Base AC')!.delta).toBe(5);
    expect(rows.find((r) => r.label === 'Str required')!.delta).toBe(-13);
    expect(rows.find((r) => r.label === 'Stealth')!.delta).toBe(-1);
  });

  it('nothing equipped: rows show a dash and no delta', () => {
    const rows = compareItems(sword, null);
    expect(rows.find((r) => r.label === 'Avg damage')!.equipped).toBe('—');
    expect(rows.every((r) => r.delta === null)).toBe(true);
  });
});

describe('ItemComparisonPanel', () => {
  it('renders both names, the slot, and a delta column', () => {
    render(<ItemComparisonPanel candidate={axe} equipped={sword} slot="MainHand" />);
    expect(screen.getByTestId('item-comparison-panel')).toBeInTheDocument();
    expect(screen.getByText('Greataxe')).toBeInTheDocument();
    expect(screen.getByText('Longsword')).toBeInTheDocument();
    expect(screen.getByText('slot: MainHand')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
