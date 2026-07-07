import { describe, it, expect } from 'vitest';
import { buildTokenViewModel } from '../tokenViewModel';
import type { CombatCharacter } from '../../../../types/combat';

const char = (over: Partial<CombatCharacter>): CombatCharacter =>
  ({
    id: 'c1',
    name: 'Kaelen Thorne',
    team: 'player',
    currentHP: 20,
    maxHP: 20,
    stats: { size: 'medium' },
    ...over,
  }) as unknown as CombatCharacter;

describe('buildTokenViewModel', () => {
  it('gives players a blue ring and enemies a red ring', () => {
    expect(buildTokenViewModel(char({ team: 'player' }), { isSelected: false, isTurn: false }).ringColor).toBe(0x60a5fa);
    expect(buildTokenViewModel(char({ team: 'enemy' }), { isSelected: false, isTurn: false }).ringColor).toBe(0xef4444);
  });
  it('selection overrides faction with amber', () => {
    expect(buildTokenViewModel(char({}), { isSelected: true, isTurn: false }).ringColor).toBe(0xfbbf24);
  });
  it('grades the HP arc green → amber → red', () => {
    expect(buildTokenViewModel(char({ currentHP: 20 }), { isSelected: false, isTurn: false }).hpColor).toBe(0x34d399);
    expect(buildTokenViewModel(char({ currentHP: 8 }), { isSelected: false, isTurn: false }).hpColor).toBe(0xfbbf24);
    expect(buildTokenViewModel(char({ currentHP: 3 }), { isSelected: false, isTurn: false }).hpColor).toBe(0xf87171);
  });
  it('labels with the first letter of the name and flags the dead', () => {
    const vm = buildTokenViewModel(char({ currentHP: 0 }), { isSelected: false, isTurn: false });
    expect(vm.label).toBe('K');
    expect(vm.isDown).toBe(true);
    expect(vm.hpPct).toBe(0);
  });
});
