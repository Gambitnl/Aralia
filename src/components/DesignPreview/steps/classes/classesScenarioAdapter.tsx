// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/08/2026, 01:42:06
 * Dependents: components/DesignPreview/steps/classes/index.ts
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
import CombatLog from '../../../BattleMap/CombatLog';
import InitiativeTracker from '../../../BattleMap/InitiativeTracker';
import { generateProceduralSandboxBattleSetup } from '../../../../hooks/useBattleMapGeneration';
import { createQuickCombatCharacter } from '../../../../utils/sandbox/quickCharacterGenerator';
import type { BattleMapData, CombatCharacter, CombatLogEntry } from '../../../../types/combat';
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
import {
  ClassesDomainShell,
} from './ClassesShell';
import {
  getCanonicalClassSelectors,
  getCanonicalDefaultSelection,
  resolveClassesShellSelection,
  type ClassesShellSelection,
} from './classesDomainModel';

/**
 * This file adapts canonical Classes choices into the shared Tactical Sandbox framework.
 * It exists so Rules can supply one map, actor roster, and combat state while this package
 * owns only class selection, subclass content, and the typed framework slots.
 * Called by: a Rules host that resolves the Classes adapter registry.
 * Depends on: the published framework contract, production quick-character/map helpers,
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

export interface ClassesScenarioAdapterRegistry extends PreviewCombatScenarioAdapterRegistry {
  readonly adapters: readonly ClassesScenarioAdapter[];
  get: (domainId: ClassesDomainId, scenarioId: ClassesScenarioId) => ClassesScenarioAdapter | undefined;
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
// Canonical board fixture
// ============================================================================
// Build a deterministic board from production quick-character records. The adapter does
// not invent token stats or terrain; this helper is the host/test seam for supplying real
// CombatCharacter and BattleMapData props to the shared framework.
export interface ClassesScenarioBoard {
  mapData: BattleMapData;
  characters: CombatCharacter[];
}

const CLASSES_BOARD_SEED = 31873;

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

  const setup = generateProceduralSandboxBattleSetup('forest', CLASSES_BOARD_SEED, [
    player,
    {
      ...target,
      id: 'classes-training-target',
      team: 'enemy',
    },
  ]);

  return {
    mapData: setup.mapData,
    characters: setup.positionedCharacters,
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
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
  const selectedClass = classes.find(characterClass => characterClass.id === selection.classId) ?? classes[0];
  const selectedSubclass = selectedClass?.subclasses.find(
    subclass => subclass.id === selection.subclassId,
  );

  // The canonical registry guarantees a selected class, but this guard keeps a malformed
  // future data update from rendering an identity that the framework cannot explain.
  if (!selectedClass) {
    throw new Error('Classes adapter requires at least one canonical class.');
  }

  const selectedScenario: ClassesScenarioIdentity = {
    scenarioId: selectedClass.id as ClassesScenarioId,
    scenarioLabel: selectedClass.name,
  };

  // The published framework owns map mode state outside this adapter. Reset asks that host
  // to return to 2D, clears adapter-only receipts, and restores the first canonical pair.
  const handleReset = (): void => {
    setSelection(getCanonicalDefaultSelection(classes));
    setCombatLog([]);
    props.onRenderModeChange('2d');
    props.onReset();
  };

  // The camera lifecycle remains a callback boundary. No local map, camera, turn manager,
  // or ability system is created here, so host state remains the one source of truth.
  const cameraLifecycle = useMemo(() => ({
    onModeChange: (mode: PreviewCombatScenarioRenderMode): void => {
      props.cameraLifecycle?.onModeChange?.(mode);
    },
    onReset: (): void => {
      props.cameraLifecycle?.onReset?.();
    },
  }), [props.cameraLifecycle]);

  const activeCharacter = props.characters.find(
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
      sidebar={(
        <>
          <ClassesDomainShell
            selection={selection}
            onSelectionChange={setSelection}
            showSubclassDemo={false}
          />
          <section
            aria-label="Selected canonical subclass mechanics"
            data-testid="classes-selected-subclass-mechanics"
            className="rounded border border-cyan-400/30 bg-slate-950/60 p-3 text-xs text-slate-200"
          >
            <p className="font-bold uppercase tracking-wider text-cyan-300">Canonical subclass mechanics</p>
            <p className="mt-1 text-slate-400">{selectedSubclass?.description ?? 'No subclass selected.'}</p>
            <ul className="mt-2 space-y-1 text-slate-300">
              {selectedSubclass?.features.map(feature => (
                <li key={feature.id}>
                  <span className="font-semibold text-cyan-100">{feature.name}:</span> {feature.description}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
      liveState={(
        <section
          aria-label="Classes live state"
          data-testid="classes-live-state"
          className="mb-3 rounded-xl border border-cyan-500/30 bg-slate-950/80 px-3 py-2 text-xs text-slate-200"
        >
          <span className="font-bold text-cyan-200">{selectedClass.name}</span>
          <span className="mx-2 text-slate-500">·</span>
          <span>{selectedSubclass?.name ?? 'No subclass'}</span>
          <span className="mx-2 text-slate-500">·</span>
          <span>{props.characters.length} canonical actors</span>
        </section>
      )}
      toolbarActions={(
        <span
          data-testid="classes-adapter-selection-receipt"
          className="rounded border border-cyan-500/30 bg-cyan-950/30 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-cyan-200"
        >
          {selectedClass.id}/{selectedSubclass?.id ?? 'base'}
        </span>
      )}
      renderers={{
        twoD: context => (
          <BattleMap
            mapData={context.mapData}
            characters={context.characters}
            preferFullMapFit
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
              characters={props.characters}
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
