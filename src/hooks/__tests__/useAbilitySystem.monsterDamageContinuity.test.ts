/** Keeps source monster damage intact across the real ability/turn hook seam. */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAbilitySystem } from '../useAbilitySystem';
import { useTurnManager } from '../combat/useTurnManager';
import { createMockCombatCharacter, createMockGameState } from '../../utils/core';
import { INGESTED_MONSTERS } from '../../data/monsters.generated';
import { GameProvider } from '../../state/GameContext';
import { useCombatAI } from '../combat/useCombatAI';
import { AIConfigProvider } from '../../context/AIConfigContext';
import type { BattleMapData, CombatCharacter, CombatLogEntry } from '../../types/combat';

describe('source monster damage continuity', () => {
  it.each([false, true])('preserves downing across the enemy turn (AI scheduler: %s)', async (useAI) => {
    const source = INGESTED_MONSTERS.ghoul;
    const ghoul = createMockCombatCharacter({ id: 'ghoul', name: source.name,
      team: 'enemy', abilities: source.abilities, stats: source.baseStats,
      position: { x: 2, y: 2 }, currentHP: 22, maxHP: 22 });
    const player = createMockCombatCharacter({ id: 'player', team: 'player',
      position: { x: 3, y: 2 }, currentHP: 10, maxHP: 10, armorClass: 13 });
    const logs: CombatLogEntry[] = [];
    const mapData: BattleMapData = { dimensions: { width: 5, height: 5 }, theme: 'dungeon', seed: 1,
      tiles: new Map(Array.from({ length: 25 }, (_, index) => {
        const x = index % 5; const y = Math.floor(index / 5);
        return [`${x}-${y}`, { id: `${x}-${y}`, coordinates: { x, y }, terrain: 'floor',
          elevation: 0, movementCost: 1, blocksMovement: false, blocksLoS: false, decoration: null, effects: [] }];
      })) };
    const onLogEntry = (entry: CombatLogEntry) => { logs.push(entry); };
    const state = createMockGameState();
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(GameProvider, { state, dispatch: vi.fn(), children:
        React.createElement(AIConfigProvider, { value: { perMonsterOverrides: { ghoul: 1 } }, children }) });
    const { result } = renderHook(() => {
      const [characters, setCharacters] = React.useState([ghoul, player]);
      const update = React.useCallback((next: CombatCharacter) =>
        setCharacters(previous => previous.map(actor => actor.id === next.id ? next : actor)), []);
      const turns = useTurnManager({ characters, mapData,
        onCharacterUpdate: update, onLogEntry,
        initiativeRoller: actor => actor.id === ghoul.id ? 20 : 1 });
      const abilities = useAbilitySystem({ characters, mapData,
        onExecuteAction: turns.executeAction, onCharacterUpdate: update,
        onCharactersReplace: setCharacters, onLogEntry, onAbilityEffect: vi.fn() });
      useCombatAI({ difficulty: 'normal', characters, mapData,
        // Match CombatView: terminal encounters stop the AI scheduler.
        currentCharacterId: useAI && characters.some(actor => actor.team === 'player' && actor.currentHP > 0)
          ? turns.turnState.currentCharacterId : null,
        executeAction: turns.executeAction, endTurn: turns.endTurn, autoCharacters: new Set(),
        executeAbility: (ability, caster, position, ids) => abilities.executeAbility(
          ability, caster, position, ids, undefined, undefined,
          { attackRollRng: () => 0.7, damageRng: () => 0.999 }) });
      return { characters, turns, abilities };
    }, { wrapper });
    await act(async () => { result.current.turns.initializeCombat(result.current.characters); });
    if (useAI) {
      await waitFor(() => expect(logs.filter(entry => entry.data?.damageEventBoundary === 'post_hp')).toHaveLength(2), { timeout: 10000 });
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    } else await act(async () => {
      await result.current.abilities.executeAbility(
        source.abilities.find(ability => ability.id === 'multiattack')!,
        result.current.characters.find(actor => actor.id === ghoul.id)!, player.position, [player.id],
        undefined, undefined, { attackRollRng: () => 0.7, damageRng: () => 0.999 },
      );
    });
    expect(logs.filter(entry => entry.data?.damageEventBoundary === 'post_hp')).toHaveLength(2);
    expect(result.current.characters.find(actor => actor.id === player.id)?.currentHP).toBe(0);
    if (!useAI) await act(async () => { await result.current.turns.endTurn(); });
    expect(result.current.characters.find(actor => actor.id === player.id)?.currentHP).toBe(0);
  });
});
