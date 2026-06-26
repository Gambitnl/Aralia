/**
 * Proves the villager registry lists everyone with their relational connections
 * and lets you cross-navigate kin via clickable links.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import VillagerRegistry from '../VillagerRegistry';
import type { Occupant } from '../../../systems/worldforge/roster/types';
import type { FamilyTies } from '../../../systems/worldforge/roster/family';

const occ = (id: number, name: string, homePlotId: number, over: Partial<Occupant> = {}): Occupant => ({
  id, name, ageBand: 'adult', homePlotId, occupation: 'resident', ...over,
});
const tie = (id: number, over: Partial<FamilyTies> = {}): FamilyTies => ({
  occupantId: id, age: 30, race: 'Human', parentIds: [], childIds: [], siblingIds: [], distantKin: [], alone: false, ...over,
});

const occupants = [
  occ(1, 'Arkel', 10), occ(2, 'Begor', 10), occ(3, 'Kelun', 10, { ageBand: 'child' }),
  occ(4, 'Loner', 20),
];
const families = new Map<number, FamilyTies>([
  [1, tie(1, { spouseId: 2, childIds: [3], race: 'Elf' })],
  [2, tie(2, { spouseId: 1, childIds: [3], race: 'Human' })],
  [3, tie(3, { age: 8, parentIds: [1, 2], race: 'Elf' })],
  [4, tie(4, { alone: true })],
]);
const nameOf = (id: number) => occupants.find((o) => o.id === id)?.name ?? '?';

const renderReg = (onSelect = vi.fn()) => {
  render(
    <VillagerRegistry
      occupants={occupants} families={families}
      selectedId={null} hoveredId={null}
      onSelect={onSelect} onHover={vi.fn()} nameOf={nameOf}
    />,
  );
  return onSelect;
};

describe('VillagerRegistry', () => {
  it('lists every villager with identity and family relations', () => {
    renderReg();
    expect(screen.getByText('(4)')).toBeInTheDocument();
    expect(screen.getAllByTestId('registry-row')).toHaveLength(4);
    // Identity line: age · race · occupation.
    expect(screen.getByText(/30 · Elf · resident/)).toBeInTheDocument();
    // Relations render (text is split by clickable kin links → use a regex).
    expect(screen.getByText(/child of/)).toBeInTheDocument();        // the child's parents
    expect(screen.getByText('no known family')).toBeInTheDocument(); // the loner
  });

  it('clicking a kin link selects that relative (cross-navigation)', () => {
    const onSelect = renderReg();
    // 'Arkel' appears as his own name AND as a kin link in relatives' rows; the
    // first match is his name in his own row.
    const arkelRow = screen.getAllByText('Arkel')[0].closest('[data-testid="registry-row"]')!;
    // Arkel's spouse link is "Begor" (id 2).
    fireEvent.click(within(arkelRow as HTMLElement).getByText('Begor'));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('clicking a villager row selects them', () => {
    const onSelect = renderReg();
    fireEvent.click(screen.getByText('Loner').closest('[data-testid="registry-row"]')!);
    expect(onSelect).toHaveBeenCalledWith(4);
  });
});
