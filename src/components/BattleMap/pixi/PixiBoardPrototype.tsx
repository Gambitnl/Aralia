// src/components/BattleMap/pixi/PixiBoardPrototype.tsx
/**
 * @file PixiBoardPrototype.tsx
 * Dev-flag harness (?pixiboard=1) that feeds live combat state into the
 * PixiBattleBoard prototype. Mirrors BattleMap's visibility bridge so fog
 * matches the DOM board exactly. Display only — see the next-gen combat map
 * spec, migration step 1.
 */
import React, { useMemo } from 'react';
import type { CombatState, LightSource } from '../../../types/combat';
import { useVisibility } from '../../../hooks/combat/useVisibility';
import { selectVisibilityObserver } from '../visibilityObserverPolicy';
import PixiBattleBoard from './PixiBattleBoard';

// Same props contract as BattleMap so CombatView can swap 1:1. `typeof import`
// is a type-only query — it adds no runtime dependency on the DOM board.
type BattleMapLikeProps = React.ComponentProps<typeof import('../BattleMap').default>;

const PixiBoardPrototype: React.FC<BattleMapLikeProps> = ({ mapData, characters, combatState }) => {
  const { turnManager, turnState } = combatState;
  // Same observer policy as the DOM/3D boards; the prototype has no selection
  // UI, so the selected-character input is always null.
  const observer = selectVisibilityObserver({
    selectedCharacterId: null,
    currentCharacterId: turnState.currentCharacterId,
    characters,
  });
  // The visibility hook expects a CombatState; this bridge mirrors the one in
  // BattleMap.tsx (visibilityState) minus the selection/action-mode inputs.
  const visibilityState = useMemo(() => ({
    isActive: true,
    characters,
    turnState,
    selectedCharacterId: null,
    selectedAbilityId: null,
    actionMode: 'move',
    validTargets: [],
    validMoves: [],
    combatLog: [],
    reactiveTriggers: turnManager.reactiveTriggers || [],
    activeLightSources: (turnManager.activeLightSources || []) as LightSource[],
    mapData: mapData ?? undefined,
  } as unknown as CombatState), [characters, mapData, turnManager.activeLightSources, turnManager.reactiveTriggers, turnState]);
  const visibility = useVisibility({ combatState: visibilityState, activeCharacterId: observer.observerId });

  if (!mapData) return <div>Generating map...</div>;
  return (
    <PixiBattleBoard
      mapData={mapData}
      characters={characters}
      visibleTiles={visibility.visibleTiles}
      getLightLevel={visibility.getLightLevel}
      currentCharacterId={turnState.currentCharacterId}
      selectedCharacterId={null}
    />
  );
};

export default PixiBoardPrototype;
