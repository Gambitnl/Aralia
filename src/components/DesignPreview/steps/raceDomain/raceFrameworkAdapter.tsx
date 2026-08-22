// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/08/2026, 22:53:46
 * Dependents: components/DesignPreview/steps/raceDomain/index.ts
 * Imports: 12 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useMemo, useState } from 'react';
import BattleMap from '../../../BattleMap/BattleMap';
import BattleMap3D from '../../../BattleMap/BattleMap3D';
import AbilityPalette from '../../../BattleMap/AbilityPalette';
import ActionEconomyBar from '../../../BattleMap/ActionEconomyBar';
import InitiativeTracker from '../../../BattleMap/InitiativeTracker';
import { Button } from '../../../ui/Button';
import { createQuickCombatCharacter } from '../../../../utils/sandbox/quickCharacterGenerator';
import type { BattleMapData, BattleMapTile, CombatCharacter } from '../../../../types/combat';
import {
  PreviewCombatScenarioFramework,
  createPreviewCombatScenarioAdapterRegistry,
  definePreviewCombatScenarioAdapter,
} from '../PreviewCombatScenarioFramework';
import PreviewCombatDomainScenarioSidebar from '../PreviewCombatDomainScenarioSidebar';
import type {
  PreviewCombatScenarioAdapter,
  PreviewCombatScenarioFrameworkProps,
} from '../PreviewCombatScenarioFramework';
import { raceDomainRegistry } from './raceDomainRegistry';
import {
  createRaceDomainScenarioState,
  type RaceDomainRegistry,
  type RaceDomainScenarioState,
} from './raceDomainTypes';

/**
 * This file adapts the canonical Race roster to the shared tactical preview
 * framework. It gives the Races tab its selector and proof labels while the
 * framework remains the only owner of the mounted shell, map, reset lifecycle,
 * render-mode lifecycle, and host-provided combat slots.
 * Called by: the Races integration and focused adapter tests.
 * Depends on: the public preview framework contract, ACTIVE_RACES registry,
 * and the production BattleMap and BattleMap3D renderers.
 */

// ============================================================================
// Controlled Race Selection Contract
// ============================================================================
// The framework currently supplies no race-change callback. This small adapter
// seam lets a future host provide one explicitly without pretending that a
// selector changed combat state when the host has not accepted the change.
// ============================================================================

export interface RaceFrameworkAdapterOptions {
  registry?: RaceDomainRegistry;
  selectedRaceId?: string | null;
  onRaceSelect?: (raceId: string) => void;
}

export interface RaceFrameworkAdapterSurfaceProps extends RaceFrameworkAdapterOptions {
  frameworkProps: PreviewCombatScenarioFrameworkProps;
}

export interface RaceFrameworkAdapterRegistration {
  adapter: PreviewCombatScenarioAdapter;
  registry: ReturnType<typeof createPreviewCombatScenarioAdapterRegistry>;
}

// ============================================================================
// Canonical Selection Helpers
// ============================================================================
// Every selector value is resolved against the same registry used to render
// the options. Invalid or absent values therefore land on the authored first
// Race instead of producing a fabricated selection or an empty fake scenario.
// ============================================================================

export function resolveCanonicalRaceId(
  registry: RaceDomainRegistry,
  requestedRaceId?: string | null,
): string | null {
  // The first canonical entry is the deterministic authored fallback.
  const fallbackRaceId = registry.races[0]?.id ?? null;
  return requestedRaceId && registry.getRaceById(requestedRaceId)
    ? requestedRaceId
    : fallbackRaceId;
}

// ============================================================================
// Authored Race Scenario Boards
// ============================================================================
// Rules scenarios arrange terrain around the mechanic under review. Races follows
// that same visual contract by giving every canonical race a stable, race-selected
// board and production character instead of projecting new text over one generic map.
// ============================================================================

export interface RaceScenarioBoard {
  mapData: BattleMapData;
  characters: CombatCharacter[];
}

interface RaceScenarioMapProfile {
  seed: number;
  obstacleColumn: number;
  openRows: readonly number[];
  difficultRow: number;
  elevatedStartX: number;
}

const RACES_MAP_WIDTH = 16;
const RACES_MAP_HEIGHT = 12;

/** Turn a canonical race ID into a stable unsigned number for authored placement. */
function createRaceScenarioSeed(raceId: string): number {
  let hash = 2166136261;

  // Every character contributes to the same deterministic seed, so the board remains
  // stable across reloads without maintaining a second hand-authored race inventory.
  for (const character of raceId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return 5100 + ((hash >>> 0) % 1_000_000);
}

/** Derive a compact terrain profile from the canonical race identity. */
function createRaceScenarioMapProfile(raceId: string): RaceScenarioMapProfile {
  const seed = createRaceScenarioSeed(raceId);
  return {
    seed,
    obstacleColumn: 6 + (seed % 4),
    openRows: [3 + (seed % 5), 4 + ((seed >> 3) % 5)],
    difficultRow: 2 + ((seed >> 5) % 7),
    elevatedStartX: 10 + ((seed >> 8) % 3),
  };
}

/** Build one fixed tactical teaching map for the selected canonical race. */
function createRaceScenarioMap(raceId: string): BattleMapData {
  const profile = createRaceScenarioMapProfile(raceId);
  const tiles = new Map<string, BattleMapTile>();

  // Every board uses the Rules terrain grammar: real boundary walls, walkable floor,
  // a difficult strip, a mixed cover lane with legal gaps, and a raised platform.
  for (let y = 0; y < RACES_MAP_HEIGHT; y += 1) {
    for (let x = 0; x < RACES_MAP_WIDTH; x += 1) {
      const isBoundary = x === 0 || y === 0 || x === RACES_MAP_WIDTH - 1 || y === RACES_MAP_HEIGHT - 1;
      const tile: BattleMapTile = {
        id: `${x}-${y}`,
        coordinates: { x, y },
        terrain: isBoundary ? 'wall' : 'floor',
        elevation: 0,
        movementCost: 5,
        blocksLoS: isBoundary,
        blocksMovement: isBoundary,
        decoration: null,
        effects: [],
      };

      // The raised area provides a visible height reference for flying, climbing,
      // ranged, and movement traits while remaining ordinary production map data.
      if (!isBoundary && x >= profile.elevatedStartX && x <= 13 && y >= 2 && y <= 9) {
        tile.elevation = 5;
      }

      // Difficult ground makes movement traits inspectable on every board and moves to
      // a race-specific row so selection causes a visible map change.
      if (!isBoundary && y === profile.difficultRow && x >= 2 && x <= 13) {
        tile.terrain = 'difficult';
        tile.movementCost = 10;
        tile.decoration = 'bush';
        tile.providesCover = true;
      }

      // The central lane alternates solid pillars and passable brush. Stable gaps keep
      // the hero-to-target route legal while still exercising cover and line of sight.
      if (
        x === profile.obstacleColumn
        && y >= 2
        && y <= 9
        && !profile.openRows.includes(y)
      ) {
        const isPillar = (y + profile.seed) % 2 === 0;
        tile.decoration = isPillar ? 'pillar' : 'bush';
        tile.providesCover = true;
        tile.blocksMovement = isPillar;
        tile.blocksLoS = false;
        tile.terrain = isPillar ? 'floor' : 'difficult';
        tile.movementCost = isPillar ? 5 : 10;
      }

      tiles.set(tile.id, tile);
    }
  }

  return {
    dimensions: { width: RACES_MAP_WIDTH, height: RACES_MAP_HEIGHT },
    tiles,
    theme: 'dungeon',
    seed: profile.seed,
  };
}

export function createRaceScenarioBoard(
  requestedRaceId?: string | null,
  registry: RaceDomainRegistry = raceDomainRegistry,
): RaceScenarioBoard {
  const raceId = resolveCanonicalRaceId(registry, requestedRaceId);
  if (!raceId) {
    throw new Error('Production Races board assembly requires one canonical race.');
  }

  const race = registry.getRaceById(raceId);
  const hero = createQuickCombatCharacter({
    classId: 'fighter',
    raceId,
    level: 3,
    name: `${race?.name ?? raceId} preview hero`,
    useRecommendedStats: true,
  });
  const target = createQuickCombatCharacter({
    classId: 'fighter',
    raceId: 'human',
    level: 3,
    name: 'Races training target',
    useRecommendedStats: true,
  });

  // Missing canonical character assembly is a real integration failure. A fabricated
  // fallback would make the board look healthy while hiding unsupported race data.
  if (!hero || !target) {
    throw new Error(`Production Races board assembly failed for ${raceId}.`);
  }

  // Stable IDs keep the host turn state valid while the canonical race record and its
  // authored board change together.
  return {
    mapData: createRaceScenarioMap(raceId),
    characters: [
      {
        ...hero,
        id: 'races-framework-hero',
        name: `${hero.name} · ${raceId} scenario`,
        team: 'player',
        position: { x: 3, y: 5 },
      },
      {
        ...target,
        id: 'races-framework-target',
        team: 'enemy',
        position: { x: 12, y: 5 },
      },
    ],
  };
}

// ============================================================================
// Race Framework Surface
// ============================================================================
// This component creates content for the shared framework slots only. It does
// not create another shell or map wrapper, and it forwards the host's incoming
// combat nodes unchanged so action, turn, ability, and engine-log truth remain
// owned by the existing combat host.
// ============================================================================

export const RaceFrameworkAdapterSurface: React.FC<RaceFrameworkAdapterSurfaceProps> = ({
  frameworkProps,
  registry = raceDomainRegistry,
  selectedRaceId,
  onRaceSelect,
}) => {
  // Local selection makes the mounted Races tab interactive even when the host
  // does not need to persist race choice outside this adapter.
  const initialRaceId = resolveCanonicalRaceId(registry, selectedRaceId);
  const [localRaceId, setLocalRaceId] = useState(initialRaceId);
  const [selectedBoard, setSelectedBoard] = useState<RaceScenarioBoard>(() => (
    createRaceScenarioBoard(initialRaceId, registry)
  ));
  const [scenarioState, setScenarioState] = useState<RaceDomainScenarioState>(() => (
    createRaceDomainScenarioState(initialRaceId)
  ));
  const [query, setQuery] = useState('');
  const [showLineOfSightCone, setShowLineOfSightCone] = useState(true);
  const resolvedRaceId = resolveCanonicalRaceId(registry, localRaceId);
  const selectedRace = resolvedRaceId ? registry.getRaceById(resolvedRaceId) : undefined;
  const selectedLeaves = resolvedRaceId ? registry.getLeavesForRace(resolvedRaceId) : [];
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRaces = normalizedQuery
    ? registry.races.filter(race => [race.id, race.name, race.description, ...race.traits]
      .join(' ').toLowerCase().includes(normalizedQuery))
    : registry.races;

  // Selection replaces the canonical character and board before notifying an optional
  // host. The visible race label can therefore never advance over a stale map.
  const selectRace = (requestedRaceId: string): void => {
    const nextRaceId = resolveCanonicalRaceId(registry, requestedRaceId);
    if (nextRaceId) {
      setLocalRaceId(nextRaceId);
      setSelectedBoard(createRaceScenarioBoard(nextRaceId, registry));
      setScenarioState(current => createRaceDomainScenarioState(
        nextRaceId,
        current.resetCount,
        [...current.eventLog, `Selected Race: ${registry.getRaceById(nextRaceId)?.name ?? nextRaceId}`].slice(-8),
      ));
      onRaceSelect?.(nextRaceId);
    }
  };

  const handleRaceSelect = (event: React.ChangeEvent<HTMLSelectElement>): void => {
    selectRace(event.target.value);
  };

  const handleReset = (): void => {
    const resetRaceId = resolveCanonicalRaceId(registry, selectedRaceId);
    setLocalRaceId(resetRaceId);
    setSelectedBoard(createRaceScenarioBoard(resetRaceId, registry));
    setScenarioState(current => createRaceDomainScenarioState(
      resetRaceId,
      current.resetCount + 1,
      [`Reset Race domain to ${registry.getRaceById(resetRaceId ?? '')?.name ?? 'canonical baseline'}`],
    ));
    setQuery('');
    setShowLineOfSightCone(true);
    frameworkProps.onRenderModeChange('2d');
    frameworkProps.onReset();
  };

  const activeCharacter = selectedBoard.characters.find(
    character => character.id === frameworkProps.combatState.turnState.currentCharacterId,
  ) ?? null;

  const cameraLifecycle = useMemo(() => ({
    onModeChange: frameworkProps.cameraLifecycle?.onModeChange,
    onReset: frameworkProps.cameraLifecycle?.onReset,
  }), [frameworkProps.cameraLifecycle]);

  // Race leaves own their production transactions and publish exact outcomes here.
  // Keeping a short shared receipt lets the selected leaf, Reset, and tester agree.
  const handleScenarioEvent = (message: string): void => {
    setScenarioState(current => createRaceDomainScenarioState(
      current.selectedRaceId,
      current.resetCount,
      [...current.eventLog, message].slice(-8),
    ));
  };

  // The sidebar mirrors Rules while Race selection and traits remain canonical
  // domain content. The host-provided live receipt is retained inside the card.
  const sidebar = (
    <PreviewCombatDomainScenarioSidebar
      domainId="races"
      query={query}
      resultCount={filteredRaces.length}
      totalCount={registry.races.length}
      onQueryChange={setQuery}
      verification={(
        <div className="space-y-2 text-xs text-slate-300">
          <p>{selectedRace?.description ?? 'No canonical race is available.'}</p>
          <ul className="space-y-1">
            {(selectedRace?.traits ?? []).slice(0, 5).map(trait => <li key={trait}>• {trait}</li>)}
          </ul>
        </div>
      )}
      controls={(
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-slate-300" htmlFor="races-framework-selector">
            Race under test
            <select
              id="races-framework-selector"
              aria-describedby="races-framework-selection-state"
              value={resolvedRaceId ?? ''}
              onChange={handleRaceSelect}
              className="mt-2 w-full rounded border border-slate-600 bg-slate-900 px-2 py-2 text-slate-100"
            >
              {filteredRaces.map(race => <option key={race.id} value={race.id}>{race.name}</option>)}
            </select>
          </label>

          {/* Registered leaves are the canonical mechanic transactions for a race.
              An empty registration remains visible instead of inventing behavior. */}
          <div aria-label="Registered Race scenarios" data-testid="races-framework-leaves" className="space-y-3">
            {selectedRace && selectedLeaves.length > 0 ? selectedLeaves.map(registration => (
              <section key={registration.id} className="rounded border border-slate-700 bg-slate-900/70 p-3">
                <h3 className="font-semibold text-cyan-100">{registration.label}</h3>
                <p className="mt-1 text-xs text-slate-400">{registration.description}</p>
                <registration.Component
                  race={selectedRace}
                  state={scenarioState}
                  onScenarioEvent={handleScenarioEvent}
                />
              </section>
            )) : (
              <p data-testid="races-framework-no-leaf" className="rounded border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-100">
                No production-backed Race mechanic is registered for this selection yet.
              </p>
            )}
          </div>

          <ol aria-label="Race scenario event log" className="space-y-1 text-xs text-slate-400">
            {scenarioState.eventLog.map((message, index) => (
              <li key={`${message}-${index}`}>{message}</li>
            ))}
          </ol>
        </div>
      )}
      selectedLabel={selectedRace?.name ?? 'No canonical race'}
      selectedSummary={selectedRace?.description ?? 'The canonical race registry is empty.'}
      selectedMeta={(
        <div id="races-framework-selection-state" data-testid="races-framework-selection">
          Selected Race: {selectedRace?.name ?? 'No canonical race'} · custom board · {selectedBoard.characters.length} canonical actors
        </div>
      )}
      catalogueLabel="Race scenarios"
      catalogueDescription="Choose a registered race to inspect its traits on the shared combat board."
      catalogue={(
        <div role="list" aria-label="Available race scenarios" className="space-y-2">
          {filteredRaces.map(race => (
            <Button
              key={race.id}
              type="button"
              variant="ghost"
              size="sm"
              role="listitem"
              aria-pressed={race.id === resolvedRaceId}
              onClick={() => selectRace(race.id)}
              className={`w-full justify-start border text-left ${race.id === resolvedRaceId
                ? 'border-cyan-400 bg-cyan-950/50 text-cyan-50'
                : 'border-slate-700 bg-slate-900/70 text-slate-300'}`}
            >
              {race.name}
            </Button>
          ))}
          {frameworkProps.sidebar}
        </div>
      )}
    />
  );

  // Renderers consume the framework's exact context, including canonical map,
  // actors, and combat state. The adapter does not build a second map or shell.
  const renderers = {
    twoD: (context: Parameters<NonNullable<PreviewCombatScenarioFrameworkProps['renderers']['twoD']>>[0]) => (
      <BattleMap
        mapData={context.mapData}
        characters={context.characters}
        preferFullMapFit
        showLineOfSightCone={showLineOfSightCone}
        combatState={context.combatState}
      />
    ),
    threeD: (context: Parameters<NonNullable<PreviewCombatScenarioFrameworkProps['renderers']['threeD']>>[0]) => (
      <BattleMap3D
        mapData={context.mapData}
        characters={context.characters}
        combatState={context.combatState}
      />
    ),
  };

  return (
    <PreviewCombatScenarioFramework
      {...frameworkProps}
      domain={{ domainId: 'races', domainLabel: 'Races' }}
      mapData={selectedBoard.mapData}
      characters={selectedBoard.characters}
      sidebar={sidebar}
      liveState={null}
      toolbarActions={(
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={showLineOfSightCone}
          onClick={() => setShowLineOfSightCone(current => !current)}
          className="border border-cyan-500/40 bg-cyan-950/40 text-cyan-100 hover:bg-cyan-900/50"
        >
          Sight Cone {showLineOfSightCone ? 'On' : 'Off'}
        </Button>
      )}
      renderers={renderers}
      rightRail={{
        turn: (
          <div data-testid="races-right-rail-turn">
            <InitiativeTracker
              characters={selectedBoard.characters}
              turnState={frameworkProps.combatState.turnState}
              onCharacterSelect={frameworkProps.combatState.turnManager.skipToCharacter}
            />
          </div>
        ),
        actionEconomy: frameworkProps.rightRail.actionEconomy ?? (activeCharacter ? (
          <ActionEconomyBar
            character={activeCharacter}
            onExecuteAction={frameworkProps.combatState.turnManager.executeAction}
          />
        ) : null),
        abilities: frameworkProps.rightRail.abilities ?? (
          <AbilityPalette
            character={activeCharacter}
            onSelectAbility={ability => activeCharacter
              && frameworkProps.combatState.abilitySystem.startTargeting(ability, activeCharacter)}
            canAffordAction={cost => activeCharacter
              ? frameworkProps.combatState.turnManager.canAffordAction(activeCharacter, cost)
              : false}
          />
        ),
        combatLog: frameworkProps.rightRail.combatLog,
      }}
      cameraLifecycle={cameraLifecycle}
      onReset={handleReset}
      endTurn={{
        disabled: !activeCharacter || !frameworkProps.combatState.isCharacterTurn(activeCharacter.id),
        label: '⏩ End Turn',
        onClick: frameworkProps.combatState.turnManager.endTurn,
      }}
    />
  );
};

// ============================================================================
// Public Races Adapter And Registry
// ============================================================================
// The factory keeps the public adapter lookup typed and deterministic. Its
// scenario is content-only; reset, mode changes, and proof continue through
// the framework props supplied by the mounted host.
// ============================================================================

export function createRaceFrameworkAdapter(
  options: RaceFrameworkAdapterOptions = {},
): RaceFrameworkAdapterRegistration {
  // Capture only the explicit selection seam and registry; framework state is
  // still received at render time and passed through to the shared shell.
  const adapter = definePreviewCombatScenarioAdapter({
    domain: { domainId: 'races', domainLabel: 'Races' },
    scenario: { scenarioId: 'races', scenarioLabel: 'Races' },
    render: frameworkProps => (
      <RaceFrameworkAdapterSurface
        frameworkProps={frameworkProps}
        registry={options.registry ?? raceDomainRegistry}
        selectedRaceId={options.selectedRaceId}
        onRaceSelect={options.onRaceSelect}
      />
    ),
  });

  // Keep a one-adapter registry so callers can use the same public lookup
  // contract as the shared host without importing local implementation files.
  return {
    adapter,
    registry: createPreviewCombatScenarioAdapterRegistry([adapter]),
  };
}

export const raceFrameworkAdapterRegistration = createRaceFrameworkAdapter();
export const raceFrameworkAdapter = raceFrameworkAdapterRegistration.adapter;
export const raceFrameworkAdapterRegistry = raceFrameworkAdapterRegistration.registry;

export default raceFrameworkAdapter;
