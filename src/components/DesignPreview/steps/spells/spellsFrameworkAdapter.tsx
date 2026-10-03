// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 21/08/2026, 22:33:36
 * Dependents: components/DesignPreview/steps/spells/index.ts
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
import { Button } from '../../../ui/Button';
import { createQuickCombatCharacter } from '../../../../utils/sandbox/quickCharacterGenerator';
import type { BattleMapData, BattleMapTile, CombatCharacter, CombatLogEntry } from '../../../../types/combat';
import {
  PreviewCombatScenarioFramework,
  createPreviewCombatScenarioAdapterRegistry,
  definePreviewCombatScenarioAdapter,
  type PreviewCombatScenarioAdapter,
  type PreviewCombatScenarioDomainIdentity,
  type PreviewCombatScenarioFrameworkProps,
  type PreviewCombatScenarioRenderMode,
  type PreviewCombatScenarioIdentity,
} from '../PreviewCombatScenarioFramework';
import PreviewCombatDomainScenarioSidebar from '../PreviewCombatDomainScenarioSidebar';
import { SPELL_SCENARIO_REGISTRY } from './spellRegistry';

// ============================================================================
// Typed Spells identities
// ============================================================================
// These IDs are deliberately closed over the published starter registry. A missing or
// renamed spell therefore fails at the adapter boundary instead of silently becoming a
// generic scenario with no canonical content.
export type SpellsDomainId = 'spells';
export type SpellsScenarioId = 'fire-bolt' | 'thunderwave' | 'cure-wounds' | 'shield';

export type SpellsDomainIdentity = PreviewCombatScenarioDomainIdentity & {
  domainId: SpellsDomainId;
};

export type SpellsScenarioIdentity = PreviewCombatScenarioIdentity & {
  scenarioId: SpellsScenarioId;
};

export type SpellsScenarioAdapter = Omit<PreviewCombatScenarioAdapter, 'domain' | 'scenario'> & {
  domain: SpellsDomainIdentity;
  scenario: SpellsScenarioIdentity;
};

// The framework registry accepts arbitrary string IDs. This domain registry keeps the
// same runtime shape while narrowing lookup arguments to the four canonical spell IDs.
export interface SpellsScenarioAdapterRegistry {
  readonly adapters: readonly SpellsScenarioAdapter[];
  get: (domainId: SpellsDomainId, scenarioId: SpellsScenarioId) => SpellsScenarioAdapter | undefined;
}

export const SPELLS_DOMAIN_ID: SpellsDomainId = 'spells';
export const SPELLS_SCENARIO_IDS = [
  'fire-bolt',
  'thunderwave',
  'cure-wounds',
  'shield',
] as const satisfies readonly SpellsScenarioId[];

export const SPELLS_DOMAIN: SpellsDomainIdentity = {
  domainId: SPELLS_DOMAIN_ID,
  domainLabel: 'Spells',
};

// ============================================================================
// Authored spell scenario maps
// ============================================================================
// Rules scenarios arrange terrain and actors around the mechanic under test. Spells uses
// the same contract: each canonical spell gets a deliberate teaching board instead of an
// unrelated procedural forest. Spell components still own the real transactions; these
// profiles only provide honest, production-shaped tactical context for those transactions.
export interface SpellsScenarioBoard {
  mapData: BattleMapData;
  characters: CombatCharacter[];
}

interface SpellsScenarioMapProfile {
  seed: number;
  casterPosition: { x: number; y: number };
  targetPosition: { x: number; y: number };
  targetTeam: 'player' | 'enemy';
  obstacleColumn: number;
  openRows: readonly number[];
  difficultRow: number;
  elevatedStartX: number;
  targetHealthRatio: number;
}

// Each arrangement makes the spell's important spatial fact visible: Fire Bolt has a
// ranged firing lane, Thunderwave starts adjacent with open push space, Cure Wounds places
// a wounded ally within touch range, and Shield faces a distant hostile attacker.
const SPELLS_SCENARIO_MAP_PROFILES: Record<SpellsScenarioId, SpellsScenarioMapProfile> = {
  'fire-bolt': {
    seed: 4101,
    casterPosition: { x: 3, y: 5 },
    targetPosition: { x: 12, y: 5 },
    targetTeam: 'enemy',
    obstacleColumn: 8,
    openRows: [5, 6],
    difficultRow: 3,
    elevatedStartX: 11,
    targetHealthRatio: 1,
  },
  thunderwave: {
    seed: 4102,
    casterPosition: { x: 6, y: 5 },
    targetPosition: { x: 7, y: 5 },
    targetTeam: 'enemy',
    obstacleColumn: 10,
    openRows: [4, 5, 6],
    difficultRow: 8,
    elevatedStartX: 12,
    targetHealthRatio: 1,
  },
  'cure-wounds': {
    seed: 4103,
    casterPosition: { x: 6, y: 5 },
    targetPosition: { x: 7, y: 5 },
    targetTeam: 'player',
    obstacleColumn: 9,
    openRows: [5, 7],
    difficultRow: 3,
    elevatedStartX: 11,
    targetHealthRatio: 0.45,
  },
  shield: {
    seed: 4104,
    casterPosition: { x: 5, y: 5 },
    targetPosition: { x: 11, y: 5 },
    targetTeam: 'enemy',
    obstacleColumn: 8,
    openRows: [5],
    difficultRow: 7,
    elevatedStartX: 12,
    targetHealthRatio: 1,
  },
};

const SPELLS_MAP_WIDTH = 16;
const SPELLS_MAP_HEIGHT = 12;

/** Build one fixed tactical teaching board for the selected spell. */
function createSpellsScenarioMap(spellId: SpellsScenarioId): BattleMapData {
  const profile = SPELLS_SCENARIO_MAP_PROFILES[spellId];
  const tiles = new Map<string, BattleMapTile>();

  // Begin with a fully walkable dungeon floor bounded by real walls so the native
  // movement, sight, cover, elevation, and 3D renderers receive their normal tile facts.
  for (let y = 0; y < SPELLS_MAP_HEIGHT; y += 1) {
    for (let x = 0; x < SPELLS_MAP_WIDTH; x += 1) {
      const isBoundary = x === 0 || y === 0 || x === SPELLS_MAP_WIDTH - 1 || y === SPELLS_MAP_HEIGHT - 1;
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

      // The raised target-side platform keeps ranged height and line-of-sight
      // consequences visible without inventing spell-only renderer behavior.
      if (!isBoundary && x >= profile.elevatedStartX && x <= 13 && y >= 2 && y <= 9) {
        tile.elevation = 5;
      }

      // A costly strip gives movement and positioning a visible alternative route.
      // Its location differs per spell so the four boards remain recognizable.
      if (!isBoundary && y === profile.difficultRow && x >= 2 && x <= 13) {
        tile.terrain = 'difficult';
        tile.movementCost = 10;
        tile.decoration = 'bush';
        tile.providesCover = true;
      }

      // This mixed cover lane frames the relevant line between caster and target.
      // Authored gaps keep that line legal for the spell being demonstrated.
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
    dimensions: { width: SPELLS_MAP_WIDTH, height: SPELLS_MAP_HEIGHT },
    tiles,
    theme: 'dungeon',
    seed: profile.seed,
  };
}

export function createSpellsScenarioBoard(spellId: SpellsScenarioId = SPELLS_SCENARIO_IDS[0]): SpellsScenarioBoard {
  const profile = SPELLS_SCENARIO_MAP_PROFILES[spellId];
  const caster = createQuickCombatCharacter({
    classId: 'wizard',
    raceId: 'human',
    level: 3,
    name: 'Spells preview caster',
    useRecommendedStats: true,
  });
  const target = createQuickCombatCharacter({
    classId: 'fighter',
    raceId: 'human',
    level: 3,
    name: 'Spells training target',
    useRecommendedStats: true,
  });

  // Refuse to render an incomplete board. A hand-built fallback would make native map
  // proof look healthy while hiding a broken canonical character assembly.
  if (!caster || !target) {
    throw new Error('Production Spells board assembly failed.');
  }

  // Stable IDs preserve host turn ownership while the spell selection replaces the
  // authored map and scenario actors together. Cure Wounds deliberately damages its
  // allied target; the other scenarios begin at full health.
  const targetCurrentHP = Math.max(1, Math.floor(target.maxHP * profile.targetHealthRatio));
  return {
    mapData: createSpellsScenarioMap(spellId),
    characters: [
      {
        ...caster,
        id: 'spells-preview-caster',
        name: `${caster.name} · ${spellId} scenario`,
        team: 'player',
        position: profile.casterPosition,
      },
      {
        ...target,
        id: 'spells-training-target',
        team: profile.targetTeam,
        currentHP: targetCurrentHP,
        position: profile.targetPosition,
      },
    ],
  };
}

// ============================================================================
// Adapter-owned sidebar and live state
// ============================================================================
// The existing SpellsDomainShell remains available for its original standalone route.
// This framework adapter uses the same registry and scenario components directly so the
// shared shell is mounted exactly once by Rules, with no nested shell or duplicate map.
function SpellsScenarioAdapterView(props: PreviewCombatScenarioFrameworkProps): React.ReactElement {
  const spells = SPELL_SCENARIO_REGISTRY;
  const initialId = SPELLS_SCENARIO_IDS.includes(props.scenario.scenarioId as SpellsScenarioId)
    ? props.scenario.scenarioId as SpellsScenarioId
    : SPELLS_SCENARIO_IDS[0];
  const [selectedId, setSelectedId] = useState<SpellsScenarioId>(initialId);
  const [selectedBoard, setSelectedBoard] = useState<SpellsScenarioBoard>(() => (
    createSpellsScenarioBoard(initialId)
  ));
  const [combatLog] = useState<CombatLogEntry[]>([]);
  const [query, setQuery] = useState('');
  const [showLineOfSightCone, setShowLineOfSightCone] = useState(true);
  const selectedSpell = spells.find(spell => spell.id === selectedId);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSpells = normalizedQuery
    ? spells.filter(spell => [spell.id, spell.name, spell.kind, spell.summary]
      .join(' ').toLowerCase().includes(normalizedQuery))
    : spells;

  // The registry is authored with all four entries. Keep a guard for future data edits so
  // a missing row is reported as a real integration failure, not an empty preview.
  if (!selectedSpell || !selectedSpell.scenarioComponent) {
    throw new Error(`Spells adapter requires an available scenario for ${selectedId}.`);
  }

  const selectedScenario: SpellsScenarioIdentity = {
    scenarioId: selectedSpell.id as SpellsScenarioId,
    scenarioLabel: selectedSpell.name,
  };
  const activeCharacter = selectedBoard.characters.find(
    character => character.id === props.combatState.turnState.currentCharacterId,
  ) ?? null;

  // Spell selection and board replacement are one visible transaction. The selected
  // label therefore cannot advance while leaving the previous spell's tactical setup.
  const handleSpellSelection = (nextId: SpellsScenarioId): void => {
    setSelectedId(nextId);
    setSelectedBoard(createSpellsScenarioBoard(nextId));
  };

  // Reset clears only adapter-owned selection and returns mode to the host's 2D default;
  // the framework then invokes camera reset before the host's canonical reset callback.
  const handleReset = (): void => {
    setSelectedId(SPELLS_SCENARIO_IDS[0]);
    setSelectedBoard(createSpellsScenarioBoard(SPELLS_SCENARIO_IDS[0]));
    setQuery('');
    setShowLineOfSightCone(true);
    props.onRenderModeChange('2d');
    props.onReset();
  };

  // Forward lifecycle events without creating a second camera policy inside Spells.
  const cameraLifecycle = useMemo(() => ({
    onModeChange: (mode: PreviewCombatScenarioRenderMode): void => {
      props.cameraLifecycle?.onModeChange?.(mode);
    },
    onReset: (): void => {
      props.cameraLifecycle?.onReset?.();
    },
  }), [props.cameraLifecycle]);

  const ScenarioComponent = selectedSpell.scenarioComponent;

  return (
    <PreviewCombatScenarioFramework
      {...props}
      domain={SPELLS_DOMAIN}
      scenario={selectedScenario}
      mapData={selectedBoard.mapData}
      characters={selectedBoard.characters}
      sidebar={(
        <PreviewCombatDomainScenarioSidebar
          domainId="spells"
          query={query}
          resultCount={filteredSpells.length}
          totalCount={spells.length}
          onQueryChange={setQuery}
          verification={(
            <div data-testid="spells-selected-mechanics" className="space-y-2 text-xs text-slate-300">
              <p className="font-semibold text-amber-200">{selectedSpell.kind.replace('-', ' ')} · level {selectedSpell.level}</p>
              <p className="text-slate-400">{selectedSpell.summary}</p>
            </div>
          )}
          controls={(
            <div data-testid="spells-selected-scenario-content" className="rounded border border-slate-700 bg-slate-900/60 p-3">
              <ScenarioComponent spell={selectedSpell} />
            </div>
          )}
          selectedLabel={selectedSpell.name}
          selectedSummary={selectedSpell.summary}
          selectedMeta={`Effect: ${selectedSpell.kind.replace('-', ' ')} · custom board · ${selectedBoard.characters.length} canonical actors`}
          catalogueLabel="Spell scenarios"
          catalogueDescription="Choose one canonical spell transaction to exercise on the shared combat board."
          catalogue={(
            <div role="list" aria-label="Available spells" className="space-y-2">
              {filteredSpells.map(spell => (
                <div key={spell.id} role="listitem">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={spell.id === selectedSpell.id}
                    onClick={() => handleSpellSelection(spell.id as SpellsScenarioId)}
                    className={`w-full justify-start border px-3 py-2 text-left ${spell.id === selectedSpell.id
                      ? 'border-cyan-400/70 bg-cyan-950/50 text-cyan-50'
                      : 'border-slate-700 bg-slate-900/70 text-slate-300'}`}
                  >
                    <span>
                      <span className="block text-sm font-bold">{spell.name}</span>
                      <span className="mt-1 block text-[10px] uppercase tracking-wider text-slate-400">
                        {spell.kind.replace('-', ' ')} · level {spell.level}
                      </span>
                    </span>
                  </Button>
                </div>
              ))}
            </div>
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
          data-testid="spells-adapter-selection-receipt"
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
          <BattleMap3D mapData={context.mapData} characters={context.characters} combatState={context.combatState} />
        ),
      }}
      rightRail={{
        turn: (
          <div data-testid="spells-right-rail-turn">
            <InitiativeTracker characters={selectedBoard.characters} turnState={props.combatState.turnState} onCharacterSelect={props.combatState.turnManager.skipToCharacter} />
          </div>
        ),
        actionEconomy: activeCharacter ? (
          <div data-testid="spells-right-rail-actions">
            <ActionEconomyBar character={activeCharacter} onExecuteAction={props.combatState.turnManager.executeAction} />
          </div>
        ) : null,
        abilities: (
          <div data-testid="spells-right-rail-abilities">
            <AbilityPalette
              character={activeCharacter}
              onSelectAbility={ability => activeCharacter && props.combatState.abilitySystem.startTargeting(ability, activeCharacter)}
              canAffordAction={cost => activeCharacter ? props.combatState.turnManager.canAffordAction(activeCharacter, cost) : false}
            />
          </div>
        ),
        combatLog: (
          <div data-testid="spells-right-rail-log">
            <CombatLog logEntries={combatLog} />
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
// Public registry
// ============================================================================
// Registry entries point to the existing spell records and one shared adapter renderer;
// selection remains visible and controlled inside the adapter view for all four entries.
const frameworkRegistry = createPreviewCombatScenarioAdapterRegistry(
  SPELLS_SCENARIO_IDS.map(id => {
    const spell = SPELL_SCENARIO_REGISTRY.find(entry => entry.id === id);
    if (!spell) throw new Error(`Missing canonical spell registry entry for ${id}.`);
    return definePreviewCombatScenarioAdapter({
      domain: SPELLS_DOMAIN,
      scenario: { scenarioId: id, scenarioLabel: spell.name },
      render: props => <SpellsScenarioAdapterView {...props} />,
    });
  }),
);

export const spellsScenarioAdapterRegistry: SpellsScenarioAdapterRegistry = {
  adapters: frameworkRegistry.adapters as readonly SpellsScenarioAdapter[],
  get: (domainId, scenarioId) => frameworkRegistry.get(domainId, scenarioId) as SpellsScenarioAdapter | undefined,
};

export const SPELLS_SCENARIO_ADAPTERS = spellsScenarioAdapterRegistry.adapters;
export const SPELLS_SCENARIO_ADAPTER_REGISTRY = spellsScenarioAdapterRegistry;

export default spellsScenarioAdapterRegistry;
