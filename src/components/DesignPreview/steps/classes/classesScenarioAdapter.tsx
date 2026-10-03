// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/08/2026, 22:53:25
 * Dependents: components/DesignPreview/steps/classes/index.ts
 * Imports: 14 files
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
import CombatLog from '../../../BattleMap/CombatLog';
import InitiativeTracker from '../../../BattleMap/InitiativeTracker';
import { Button } from '../../../ui/Button';
import { createQuickCombatCharacter } from '../../../../utils/sandbox/quickCharacterGenerator';
import type {
  BattleMapData,
  BattleMapTile,
  CombatCharacter,
  CombatLogEntry,
} from '../../../../types/combat';
import {
  PreviewCombatScenarioFramework,
  createPreviewCombatScenarioAdapterRegistry,
  definePreviewCombatScenarioAdapter,
  type PreviewCombatScenarioAdapter,
  type PreviewCombatScenarioAdapterRegistry,
  type PreviewCombatScenarioDomainIdentity,
  type PreviewCombatScenarioFrameworkProps,
  type PreviewCombatScenarioRenderMode,
  type PreviewCombatScenarioIdentity,
} from '../PreviewCombatScenarioFramework';
import PreviewCombatDomainScenarioSidebar from '../PreviewCombatDomainScenarioSidebar';
import {
  ClassesDomainShell,
} from './ClassesShell';
import {
  getCanonicalClassSelectors,
  getCanonicalDefaultSelection,
  resolveClassesShellSelection,
  type ClassesShellSelection,
} from './classesDomainModel';
import { getSubclassDemo } from './subclassDemoRegistry';

/**
 * This file adapts canonical Classes choices into the shared Tactical Sandbox framework.
 * It exists so Classes can supply its authored map, canonical actor roster, selection,
 * and subclass content while Rules retains the shared combat lifecycle and framework slots.
 * Called by: a Rules host that resolves the Classes adapter registry.
 * Depends on: the published framework contract, the production quick-character helper,
 * the native BattleMap renderers, and the existing Classes selector.
 */

// ============================================================================
// Typed Classes identities
// ============================================================================
// These are the authored class IDs in CLASSES_DATA. Keeping the union explicit gives the
// registry a useful compile-time boundary while the inventory test checks it against data.
export type ClassesDomainId = 'classes';
export type ClassesScenarioId =
  | 'fighter'
  | 'barbarian'
  | 'bard'
  | 'cleric'
  | 'druid'
  | 'ranger'
  | 'rogue'
  | 'paladin'
  | 'monk'
  | 'sorcerer'
  | 'warlock'
  | 'wizard'
  | 'artificer';

export type ClassesDomainIdentity = PreviewCombatScenarioDomainIdentity & {
  domainId: ClassesDomainId;
};

export type ClassesScenarioIdentity = PreviewCombatScenarioIdentity & {
  scenarioId: ClassesScenarioId;
};

export type ClassesScenarioAdapter = Omit<PreviewCombatScenarioAdapter, 'domain' | 'scenario'> & {
  domain: ClassesDomainIdentity;
  scenario: ClassesScenarioIdentity;
};

export interface ClassesScenarioAdapterRegistry extends Omit<PreviewCombatScenarioAdapterRegistry, 'adapters' | 'get'> {
  readonly adapters: readonly ClassesScenarioAdapter[];
  get: (domainId: string, scenarioId: string) => ClassesScenarioAdapter | undefined;
}

export const CLASSES_DOMAIN_ID: ClassesDomainId = 'classes';

export const CLASSES_SCENARIO_IDS = [
  'fighter',
  'barbarian',
  'bard',
  'cleric',
  'druid',
  'ranger',
  'rogue',
  'paladin',
  'monk',
  'sorcerer',
  'warlock',
  'wizard',
  'artificer',
] as const satisfies readonly ClassesScenarioId[];

export const CLASSES_DOMAIN: ClassesDomainIdentity = {
  domainId: CLASSES_DOMAIN_ID,
  domainLabel: 'Classes',
};

// ============================================================================
// Authored class scenario maps
// ============================================================================
// Rules scenarios place terrain deliberately around the mechanic under review.
// Classes follows that same contract: each class selects an explicit teaching
// profile instead of receiving an unrelated procedural forest.
export interface ClassesScenarioBoard {
  mapData: BattleMapData;
  characters: CombatCharacter[];
}

interface ClassesScenarioMapProfile {
  seed: number;
  obstacleColumn: number;
  openRows: readonly number[];
  difficultRow: number;
  elevatedStartX: number;
}

// These compact profiles are authored scenario data. They keep the Rules board
// grammar while relocating the obstacle lane, difficult ground, and raised
// platform for each canonical class scenario.
const CLASSES_SCENARIO_MAP_PROFILES: Record<ClassesScenarioId, ClassesScenarioMapProfile> = {
  fighter: { seed: 3101, obstacleColumn: 7, openRows: [5, 6], difficultRow: 3, elevatedStartX: 11 },
  barbarian: { seed: 3102, obstacleColumn: 6, openRows: [4, 5], difficultRow: 7, elevatedStartX: 10 },
  bard: { seed: 3103, obstacleColumn: 8, openRows: [5, 7], difficultRow: 2, elevatedStartX: 12 },
  cleric: { seed: 3104, obstacleColumn: 7, openRows: [4, 7], difficultRow: 8, elevatedStartX: 10 },
  druid: { seed: 3105, obstacleColumn: 6, openRows: [5, 8], difficultRow: 6, elevatedStartX: 11 },
  ranger: { seed: 3106, obstacleColumn: 9, openRows: [3, 6], difficultRow: 4, elevatedStartX: 12 },
  rogue: { seed: 3107, obstacleColumn: 8, openRows: [4, 6], difficultRow: 8, elevatedStartX: 10 },
  paladin: { seed: 3108, obstacleColumn: 7, openRows: [5, 8], difficultRow: 2, elevatedStartX: 11 },
  monk: { seed: 3109, obstacleColumn: 6, openRows: [3, 7], difficultRow: 5, elevatedStartX: 12 },
  sorcerer: { seed: 3110, obstacleColumn: 9, openRows: [5, 6], difficultRow: 8, elevatedStartX: 10 },
  warlock: { seed: 3111, obstacleColumn: 8, openRows: [3, 5], difficultRow: 6, elevatedStartX: 11 },
  wizard: { seed: 3112, obstacleColumn: 7, openRows: [4, 6], difficultRow: 3, elevatedStartX: 12 },
  artificer: { seed: 3113, obstacleColumn: 9, openRows: [4, 7], difficultRow: 5, elevatedStartX: 10 },
};

const CLASSES_MAP_WIDTH = 16;
const CLASSES_MAP_HEIGHT = 12;

/** Build one fixed tactical teaching board for the selected class. */
function createClassesScenarioMap(classId: ClassesScenarioId): BattleMapData {
  const profile = CLASSES_SCENARIO_MAP_PROFILES[classId];
  const tiles = new Map<string, BattleMapTile>();

  // Every cell starts as ordinary dungeon floor so production movement, sight,
  // cover, and elevation systems interpret the authored differences below.
  for (let y = 0; y < CLASSES_MAP_HEIGHT; y += 1) {
    for (let x = 0; x < CLASSES_MAP_WIDTH; x += 1) {
      const isBoundary = x === 0 || y === 0 || x === CLASSES_MAP_WIDTH - 1 || y === CLASSES_MAP_HEIGHT - 1;
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

      // The raised platform gives ranged, movement, support, and area mechanics
      // a visible vertical reference without changing the renderer contract.
      if (!isBoundary && x >= profile.elevatedStartX && x <= 13 && y >= 2 && y <= 9) {
        tile.elevation = 5;
      }

      // This horizontal strip is deliberately expensive ground. Its authored
      // row changes by class but always uses the production terrain contract.
      if (!isBoundary && y === profile.difficultRow && x >= 2 && x <= 13) {
        tile.terrain = 'difficult';
        tile.movementCost = 10;
        tile.decoration = 'bush';
        tile.providesCover = true;
      }

      // The obstacle lane combines half-cover brush and solid pillars. Fixed
      // gaps preserve at least one legal route between the stable spawn cells.
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
    dimensions: { width: CLASSES_MAP_WIDTH, height: CLASSES_MAP_HEIGHT },
    tiles,
    theme: 'dungeon',
    seed: profile.seed,
  };
}

export function createClassesScenarioBoard(classId: ClassesScenarioId): ClassesScenarioBoard {
  const player = createQuickCombatCharacter({
    classId,
    raceId: 'human',
    level: 3,
    name: `${classId} preview hero`,
    useRecommendedStats: true,
  });
  const target = createQuickCombatCharacter({
    classId: 'fighter',
    raceId: 'human',
    level: 3,
    name: 'Classes training target',
    useRecommendedStats: true,
  });

  // A failed production assembly is an honest boundary. A hand-built fallback would
  // hide missing class/race data and give the renderer an incomplete actor record.
  if (!player || !target) {
    throw new Error(`Production Classes board assembly failed for ${classId}.`);
  }

  // Stable actor IDs keep the host turn state valid while class selection swaps
  // the authored map and canonical player record together.
  return {
    mapData: createClassesScenarioMap(classId),
    characters: [
      {
        ...player,
        id: 'classes-preview-hero',
        name: `${player.name} · ${classId} scenario`,
        team: 'player',
        position: { x: 3, y: 5 },
      },
      {
        ...target,
        id: 'classes-training-target',
        team: 'enemy',
        position: { x: 12, y: 5 },
      },
    ],
  };
}

// ============================================================================
// Adapter-owned framework view
// ============================================================================
// The adapter keeps selection controlled and derives the framework identity from that
// same selection. This prevents a selected subclass row from silently disagreeing with
// the scenario label shown by the shared shell.
function ClassesScenarioAdapterView(props: PreviewCombatScenarioFrameworkProps): React.ReactElement {
  const classes = useMemo(() => getCanonicalClassSelectors(), []);
  const initialClassId = CLASSES_SCENARIO_IDS.includes(props.scenario.scenarioId as ClassesScenarioId)
    ? props.scenario.scenarioId
    : CLASSES_SCENARIO_IDS[0];
  const [selection, setSelection] = useState<ClassesShellSelection>(() => (
    resolveClassesShellSelection(classes, initialClassId)
  ));
  const [selectedBoard, setSelectedBoard] = useState<ClassesScenarioBoard>(() => (
    createClassesScenarioBoard(initialClassId as ClassesScenarioId)
  ));
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
  const [query, setQuery] = useState('');
  const [showLineOfSightCone, setShowLineOfSightCone] = useState(true);
  const selectedClass = classes.find(characterClass => characterClass.id === selection.classId) ?? classes[0];
  const selectedSubclass = selectedClass?.subclasses.find(
    subclass => subclass.id === selection.subclassId,
  );
  const selectedDemo = selection.subclassId
    ? getSubclassDemo(selection.classId, selection.subclassId)?.Component
    : undefined;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredClasses = normalizedQuery
    ? classes.filter(characterClass => [
      characterClass.id,
      characterClass.name,
      characterClass.description,
      ...characterClass.subclasses.flatMap(subclass => [subclass.name, subclass.description]),
    ].join(' ').toLowerCase().includes(normalizedQuery))
    : classes;

  // The canonical registry guarantees a selected class, but this guard keeps a malformed
  // future data update from rendering an identity that the framework cannot explain.
  if (!selectedClass) {
    throw new Error('Classes adapter requires at least one canonical class.');
  }

  const selectedScenarioId = selectedClass.id as ClassesScenarioId;
  const selectedScenario: ClassesScenarioIdentity = {
    scenarioId: selectedScenarioId,
    scenarioLabel: selectedClass.name,
  };

  // Selection and board replacement happen in one user transaction. This
  // avoids rebuilding character records during unrelated toolbar renders and
  // ensures the visible label can never advance without its custom map.
  const handleSelectionChange = (nextSelection: ClassesShellSelection): void => {
    const nextClassId = nextSelection.classId as ClassesScenarioId;
    setSelection(nextSelection);
    setSelectedBoard(createClassesScenarioBoard(nextClassId));
  };

  // The published framework owns map mode state outside this adapter. Reset asks that host
  // to return to 2D, clears adapter-only receipts, and restores the first canonical pair.
  const handleReset = (): void => {
    const defaultSelection = getCanonicalDefaultSelection(classes);
    setSelection(defaultSelection);
    setSelectedBoard(createClassesScenarioBoard(defaultSelection.classId as ClassesScenarioId));
    setCombatLog([]);
    setQuery('');
    setShowLineOfSightCone(true);
    props.onRenderModeChange('2d');
    props.onReset();
  };

  // The camera lifecycle remains a callback boundary. Classes may replace the
  // selected board data, but it never creates a second camera, turn manager, or
  // ability system, so the host lifecycle remains the source of combat truth.
  const cameraLifecycle = useMemo(() => ({
    onModeChange: (mode: PreviewCombatScenarioRenderMode): void => {
      props.cameraLifecycle?.onModeChange?.(mode);
    },
    onReset: (): void => {
      props.cameraLifecycle?.onReset?.();
    },
  }), [props.cameraLifecycle]);

  const activeCharacter = selectedBoard.characters.find(
    character => character.id === props.combatState.turnState.currentCharacterId,
  ) ?? null;

  // The framework contract currently exposes no log callback. Keep the native log surface
  // mounted with an honest empty receipt rather than creating an unconnected second logger.
  const logEntries = combatLog;

  return (
    <PreviewCombatScenarioFramework
      {...props}
      domain={CLASSES_DOMAIN}
      scenario={selectedScenario}
      mapData={selectedBoard.mapData}
      characters={selectedBoard.characters}
      sidebar={(
        <PreviewCombatDomainScenarioSidebar
          domainId="classes"
          query={query}
          resultCount={filteredClasses.length}
          totalCount={classes.length}
          onQueryChange={setQuery}
          verification={(
            <div data-testid="classes-selected-subclass-mechanics" className="space-y-2 text-xs text-slate-300">
              <p>{selectedClass.description}</p>
              <p className="font-semibold text-amber-200">{selectedSubclass?.name ?? 'Base class'}</p>
              <p className="text-slate-400">{selectedSubclass?.description ?? 'No subclass selected.'}</p>
            </div>
          )}
          controls={(
            <div className="space-y-3">
              {/* The registered subclass demo owns the real deterministic transaction.
                  Feature text stays below it as canonical context, not simulated proof. */}
              {selectedDemo ? React.createElement(selectedDemo) : (
                <p data-testid="classes-mechanic-boundary" className="rounded border border-amber-500/40 bg-amber-950/20 p-3 text-xs text-amber-100">
                  No production-backed subclass demonstration is registered for this selection yet.
                </p>
              )}
              <ul className="space-y-2 text-xs text-slate-300">
                {(selectedSubclass?.features ?? []).map(feature => (
                  <li key={feature.id} className="rounded border border-slate-700 bg-slate-900/70 p-2">
                    <span className="font-semibold text-cyan-100">{feature.name}:</span> {feature.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
          selectedLabel={`${selectedClass.name}${selectedSubclass ? ` · ${selectedSubclass.name}` : ''}`}
          selectedSummary={selectedSubclass?.description ?? selectedClass.description}
          selectedMeta={`${selectedBoard.characters.length} canonical actors · custom ${selectedClass.name} board`}
          catalogueLabel="Class scenarios"
          catalogueDescription="Choose a canonical class, then its subclass mechanic scenario."
          catalogue={(
            <ClassesDomainShell
              selection={selection}
              onSelectionChange={handleSelectionChange}
              showSubclassDemo={false}
              showHeader={false}
              filterQuery={query}
            />
          )}
        />
      )}
      liveState={null}
      toolbarActions={(
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={showLineOfSightCone}
          data-testid="classes-adapter-selection-receipt"
          onClick={() => setShowLineOfSightCone(current => !current)}
          className="border border-cyan-500/40 bg-cyan-950/40 text-cyan-100 hover:bg-cyan-900/50"
        >
          Sight Cone {showLineOfSightCone ? 'On' : 'Off'}
        </Button>
      )}
      renderers={{
        twoD: context => (
          <BattleMap
            mapData={context.mapData}
            characters={context.characters}
            preferFullMapFit
            showLineOfSightCone={showLineOfSightCone}
            combatState={context.combatState}
          />
        ),
        threeD: context => (
          <BattleMap3D
            mapData={context.mapData}
            characters={context.characters}
            combatState={context.combatState}
          />
        ),
      }}
      rightRail={{
        turn: (
          <div data-testid="classes-right-rail-turn">
            <InitiativeTracker
              characters={selectedBoard.characters}
              turnState={props.combatState.turnState}
              onCharacterSelect={props.combatState.turnManager.skipToCharacter}
            />
          </div>
        ),
        actionEconomy: activeCharacter ? (
          <div data-testid="classes-right-rail-actions">
            <ActionEconomyBar
              character={activeCharacter}
              onExecuteAction={props.combatState.turnManager.executeAction}
            />
          </div>
        ) : null,
        abilities: (
          <div data-testid="classes-right-rail-abilities">
            <AbilityPalette
              character={activeCharacter}
              onSelectAbility={ability => activeCharacter && props.combatState.abilitySystem.startTargeting(ability, activeCharacter)}
              canAffordAction={cost => activeCharacter
                ? props.combatState.turnManager.canAffordAction(activeCharacter, cost)
                : false}
            />
          </div>
        ),
        combatLog: (
          <div data-testid="classes-right-rail-log">
            <CombatLog logEntries={logEntries} />
          </div>
        ),
      }}
      cameraLifecycle={cameraLifecycle}
      onReset={handleReset}
      endTurn={{
        disabled: !activeCharacter || !props.combatState.isCharacterTurn(activeCharacter.id),
        label: '⏩ End Turn',
        onClick: props.combatState.turnManager.endTurn,
      }}
    />
  );
}

// ============================================================================
// Public adapter registry
// ============================================================================
// Every canonical class gets a registry entry. The selected nested subclass stays in the
// controlled sidebar state, while registry identity remains the selected class scenario.
const canonicalClassSelectors = getCanonicalClassSelectors();

function renderClassesScenarioAdapter(props: PreviewCombatScenarioFrameworkProps): React.ReactNode {
  return <ClassesScenarioAdapterView {...props} />;
}

export const CLASSES_SCENARIO_ADAPTERS: readonly ClassesScenarioAdapter[] = (
  CLASSES_SCENARIO_IDS.map(classId => {
    const classData = canonicalClassSelectors.find(characterClass => characterClass.id === classId);
    if (!classData) {
      throw new Error(`Missing canonical class selector for ${classId}.`);
    }

    return definePreviewCombatScenarioAdapter({
      domain: CLASSES_DOMAIN,
      scenario: {
        scenarioId: classId,
        scenarioLabel: classData.name,
      },
      render: renderClassesScenarioAdapter,
    });
  })
);

const frameworkRegistry = createPreviewCombatScenarioAdapterRegistry(CLASSES_SCENARIO_ADAPTERS);

// The shared registry intentionally accepts future string identities. This narrow wrapper
// preserves that reusable implementation while exposing Classes-specific lookup types.
export const classesScenarioAdapterRegistry: ClassesScenarioAdapterRegistry = {
  adapters: frameworkRegistry.adapters as readonly ClassesScenarioAdapter[],
  get: (domainId, scenarioId) => frameworkRegistry.get(domainId, scenarioId) as ClassesScenarioAdapter | undefined,
};

export const CLASSES_SCENARIO_ADAPTER_REGISTRY = classesScenarioAdapterRegistry;

export default classesScenarioAdapterRegistry;
