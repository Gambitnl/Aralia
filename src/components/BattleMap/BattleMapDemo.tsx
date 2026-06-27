// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/06/2026, 09:58:43
 * Dependents: App.tsx, components/BattleMap/index.ts
 * Imports: 19 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file BattleMapDemo.tsx
 * This component serves as a demonstration and test environment for the new procedural battle map feature.
 * It allows selecting a biome and seed to generate and display a procedural battle map.
 * It now accepts the characters for the battle as a prop.
 */
// TODO: Add ARIA labels, keyboard navigation, and screen reader support for interactive elements in battle maps and UI components
import React, { useState, useMemo, useEffect, useCallback, useRef, useContext } from 'react';
import BattleMap from './BattleMap';
import BattleMap3D from './BattleMap3D';
import { PlayerCharacter } from '../../types';
import { Ability, BattleMapData, CombatCharacter, CombatLogEntry } from '../../types/combat';
import ErrorBoundary from '../ui/ErrorBoundary';
import { useTurnManager } from '../../hooks/combat/useTurnManager';
import { useAbilitySystem } from '../../hooks/useAbilitySystem';
import { generateBattleSetup } from '../../hooks/useBattleMapGeneration';
import InitiativeTracker from './InitiativeTracker';
import AbilityPalette from './AbilityPalette';
import CombatLog from './CombatLog';
import ActionEconomyBar from './ActionEconomyBar';
import PartyDisplay from './PartyDisplay';
import CharacterSheetModal from '../CharacterSheet/CharacterSheetModal';
import { canUseDevTools } from '../../utils/permissions';
import { logger } from '../../utils/logger';
import { createPlayerCombatCharacter } from '../../utils/combatUtils';
import { createQuickCombatCharacter, AVAILABLE_RACE_IDS, getRaceDisplayName } from '../../utils/sandbox/quickCharacterGenerator';
import SpellContext from '../../context/SpellContext';
import { Spell } from '../../types/spells';

// Dev-only: when the demo is opened without real enemies, spawn a small opposing
// force so the 3D battle map shows both teams (team colors, spawn spread, class
// silhouettes, nameplate overlap can all be evaluated). Guarded by canUseDevTools.
function makeTestEnemies(spells: Record<string, Spell>): CombatCharacter[] {
  const configs = [
    { name: 'Orc Reaver',     raceId: 'human', classId: 'fighter', level: 2, useRecommendedStats: true },
    { name: 'Cult Magus',     raceId: 'human', classId: 'wizard',  level: 2, useRecommendedStats: true },
    { name: 'Goblin Skulker', raceId: 'human', classId: 'rogue',   level: 2, useRecommendedStats: true },
    { name: 'Orc Brute',      raceId: 'human', classId: 'fighter', level: 2, useRecommendedStats: true },
  ];
  const out: CombatCharacter[] = [];
  configs.forEach((c, i) => {
    const cc = createQuickCombatCharacter(c, spells as unknown as Record<string, unknown>);
    if (cc) out.push({ ...cc, id: `test-enemy-${i}`, name: c.name, team: 'enemy' });
  });
  return out;
}

// Dev-only verification harness: spawn one fighter of every choosable race as the
// player team so race-driven character visuals can be judged side by side at a
// deterministic camera pose. Enabled by `window.__BM3D_RACE_LINEUP` (the headless
// capture rig sets it via addInitScript). Guarded by canUseDevTools.
function makeRaceLineup(spells: Record<string, Spell>): CombatCharacter[] {
  // A tight, visually-distinct curated set (keeps the scene light enough to
  // capture and lets a close pose frame them all). Fall back to the first few
  // available ids if a preferred id is missing from the data set.
  const PREFERRED = ['human', 'dwarf', 'elf', 'half_orc', 'tiefling', 'halfling'];
  const available = new Set(AVAILABLE_RACE_IDS);
  let ids = PREFERRED.filter(id => available.has(id));
  if (ids.length < 4) ids = AVAILABLE_RACE_IDS.slice(0, 6);
  const out: CombatCharacter[] = [];
  ids.forEach((raceId) => {
    const cc = createQuickCombatCharacter(
      { raceId, classId: 'fighter', level: 1, useRecommendedStats: true },
      spells as unknown as Record<string, unknown>,
    );
    if (cc) out.push({ ...cc, id: `lineup-${raceId}`, name: getRaceDisplayName(raceId), team: 'player' });
  });
  return out;
}

// Dev-only verification harness: an enemy creature lineup. Builds humanoid base
// combatants then overrides creatureTypes/size/name so CharacterActor renders
// distinct creature forms (undead/beast/giant + size scaling). Enabled by
// `window.__BM3D_CREATURE_LINEUP`. Guarded by canUseDevTools.
function makeCreatureLineup(spells: Record<string, Spell>): CombatCharacter[] {
  const specs: Array<{
    name: string; size?: string; creatureTypes: string[]; hp?: number;
    conditions?: CombatCharacter['conditions'];
  }> = [
    { name: 'Goblin',         creatureTypes: ['Humanoid', 'Goblinoid'] },
    { name: 'Skeleton',       creatureTypes: ['Undead'] },
    { name: 'Dire Wolf',      creatureTypes: ['Beast'] },
    { name: 'Orc Reaver',     creatureTypes: ['Humanoid'] },
    { name: 'Ogre',           size: 'Large', creatureTypes: ['Giant'] },
    { name: 'Red Dragon',     size: 'Huge', creatureTypes: ['Dragon'] },
    { name: 'Gray Ooze',      creatureTypes: ['Ooze'] },
    { name: 'Beholder',       size: 'Large', creatureTypes: ['Aberration'] },
    // Spawns already dead — verifies the death/unconscious visual (GOAL #20).
    { name: 'Slain Orc',      creatureTypes: ['Humanoid'], hp: 0 },
    // Spawns pre-conditioned — verifies the condition badge row (GOAL #19,
    // task 76) without needing a scripted combat to apply effects.
    {
      name: 'Afflicted Cultist', creatureTypes: ['Humanoid'],
      conditions: [
        { name: 'Poisoned', duration: { type: 'permanent' }, appliedTurn: 0, source: 'Ray of Sickness' },
        { name: 'Frightened', duration: { type: 'permanent' }, appliedTurn: 0 },
        { name: 'Restrained', duration: { type: 'permanent' }, appliedTurn: 0 },
      ] as CombatCharacter['conditions'],
    },
  ];
  const out: CombatCharacter[] = [];
  specs.forEach((s, i) => {
    const cc = createQuickCombatCharacter(
      { raceId: 'human', classId: 'fighter', level: 1, useRecommendedStats: true },
      spells as unknown as Record<string, unknown>,
    );
    if (cc) {
      out.push({
        ...cc,
        id: `creature-${i}`,
        name: s.name,
        team: 'enemy',
        creatureTypes: s.creatureTypes,
        currentHP: s.hp ?? cc.currentHP,
        conditions: s.conditions ?? cc.conditions,
        stats: { ...cc.stats, size: (s.size ?? cc.stats.size) as typeof cc.stats.size },
      });
    }
  });
  return out;
}


// Dev-only verification harness: one human per class archetype (fighter /
// caster / rogue) as the player team, so class-silhouette readability can be
// judged at a deterministic camera pose with race held constant. Enabled by
// `window.__BM3D_CLASS_LINEUP`. Guarded by canUseDevTools.
function makeClassLineup(spells: Record<string, Spell>): CombatCharacter[] {
  const specs = [
    { classId: 'fighter', name: 'Fighter' },
    { classId: 'wizard',  name: 'Wizard' },
    { classId: 'rogue',   name: 'Rogue' },
  ];
  const out: CombatCharacter[] = [];
  specs.forEach((s, i) => {
    const cc = createQuickCombatCharacter(
      { raceId: 'human', classId: s.classId, level: 1, useRecommendedStats: true },
      spells as unknown as Record<string, unknown>,
    );
    if (cc) out.push({ ...cc, id: `class-${i}`, name: s.name, team: 'player' });
  });
  return out;
}

interface BattleMapDemoProps {
  onExit: () => void;
  initialCharacters: CombatCharacter[];
  party: PlayerCharacter[]; // The full party data
}

type BiomeType = 'forest' | 'cave' | 'dungeon' | 'desert' | 'swamp';

// ---------------------------------------------------------------------------
// 3D Controls Help Panel
// ---------------------------------------------------------------------------

const ControlsHelp: React.FC<{ visible: boolean }> = ({ visible }) => {
  const [expanded, setExpanded] = useState(false);

  if (!visible) return null;

  return (
    <div className="absolute bottom-4 left-4 z-20 select-none flex flex-col-reverse items-start gap-1.5" style={{ pointerEvents: 'auto' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/90 hover:bg-gray-700/90 border border-gray-600/50 rounded-lg text-xs text-gray-300 backdrop-blur-sm shadow-lg transition-colors"
        title="Toggle controls help"
      >
        <span className="text-amber-400">?</span>
        <span>Controls</span>
        <span className="text-gray-500 ml-0.5">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded && (
        <div className="bg-gray-900/95 border border-gray-700/60 rounded-lg p-3 backdrop-blur-sm shadow-xl text-xs leading-relaxed max-w-[280px]">
          {/* Camera */}
          <div className="text-amber-400 font-semibold mb-1.5 text-[11px] uppercase tracking-wide">Camera</div>
          <div className="space-y-1 text-gray-300 mb-3">
            <div className="flex gap-2">
              <span className="text-gray-500 w-[90px] shrink-0">Right-drag</span>
              <span>Rotate view</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-[90px] shrink-0">Middle-drag</span>
              <span>Pan across map</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-[90px] shrink-0">Scroll wheel</span>
              <span>Zoom in / out</span>
            </div>
          </div>

          {/* Selection */}
          <div className="text-amber-400 font-semibold mb-1.5 text-[11px] uppercase tracking-wide">Selection</div>
          <div className="space-y-1 text-gray-300 mb-3">
            <div className="flex gap-2">
              <span className="text-gray-500 w-[90px] shrink-0">Left-click</span>
              <span>Select character (your turn only)</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-[90px] shrink-0">Hover</span>
              <span>Show name &amp; HP bar</span>
            </div>
          </div>

          {/* Actions */}
          <div className="text-amber-400 font-semibold mb-1.5 text-[11px] uppercase tracking-wide">Actions</div>
          <div className="space-y-1 text-gray-300">
            <div className="flex gap-2">
              <span className="text-gray-500 w-[90px] shrink-0">Click tile</span>
              <span>Move selected character</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-[90px] shrink-0">Use ability</span>
              <span>Pick from right panel, then click target</span>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-gray-700/40 text-gray-500 text-[10px]">
            Active turn character is highlighted with a golden ring.
            Enemies have red selection rings when targetable.
          </div>
        </div>
      )}
    </div>
  );
};

const BattleMapDemo: React.FC<BattleMapDemoProps> = ({ onExit, initialCharacters, party }) => {
  const initialBiome: BiomeType = 'forest';
  const [biome, setBiome] = useState<BiomeType>(initialBiome);
  const [seed, setSeed] = useState(() => {
    // Dev-only deterministic seed override so the headless capture rig can take
    // same-map before/after shots (`SEED=` in shoot.mjs → window.__BM3D_SEED).
    if (typeof window !== 'undefined' && canUseDevTools()) {
      const s = (window as unknown as { __BM3D_SEED?: number }).__BM3D_SEED;
      if (typeof s === 'number' && Number.isFinite(s)) return s;
    }
    return Date.now();
  });
  const [combatLog, setCombatLog] = useState<CombatLogEntry[]>([]);
  // [2026-05-21] 3D render mode toggle
  const [renderMode, setRenderMode] = useState<'2d' | '3d'>('2d');

  const allSpells = useContext(SpellContext);
  const spellsRecord = useMemo(
    () => (allSpells ?? {}) as unknown as Record<string, Spell>,
    [allSpells]
  );

  const getBaseCombatants = useCallback((): CombatCharacter[] => {
    // Dev-only race-lineup verification mode (see makeRaceLineup).
    if (typeof window !== 'undefined'
      && (window as unknown as { __BM3D_RACE_LINEUP?: boolean }).__BM3D_RACE_LINEUP
      && canUseDevTools()) {
      return makeRaceLineup(spellsRecord);
    }
    // Dev-only class-silhouette lineup (see makeClassLineup).
    if (typeof window !== 'undefined'
      && (window as unknown as { __BM3D_CLASS_LINEUP?: boolean }).__BM3D_CLASS_LINEUP
      && canUseDevTools()) {
      return makeClassLineup(spellsRecord);
    }
    const partyCombatants = party.map(p => createPlayerCombatCharacter(p, spellsRecord));
    // Dev-only enemy creature lineup (see makeCreatureLineup): keep the party so
    // the encounter is valid, add the creatures as the enemy team to frame.
    if (typeof window !== 'undefined'
      && (window as unknown as { __BM3D_CREATURE_LINEUP?: boolean }).__BM3D_CREATURE_LINEUP
      && canUseDevTools()) {
      return [...partyCombatants, ...makeCreatureLineup(spellsRecord)];
    }
    const enemies = initialCharacters.length > 0
      ? initialCharacters
      : (canUseDevTools() ? makeTestEnemies(spellsRecord) : []);
    return [...partyCombatants, ...enemies];
  }, [initialCharacters, party, spellsRecord]);

  const [initialSetup] = useState(() => {
    const baseCombatants = getBaseCombatants();
    return generateBattleSetup(initialBiome, seed, baseCombatants);
  });

  const [mapData, setMapData] = useState<BattleMapData | null>(initialSetup.mapData);
  const [characters, setCharacters] = useState<CombatCharacter[]>(initialSetup.positionedCharacters);
  const [sheetCharacter, setSheetCharacter] = useState<PlayerCharacter | null>(null);
  const [autoCharacters, setAutoCharacters] = useState<Set<string>>(new Set());
  // TODO(next-agent): Preserve behavior; wire selection state into BattleMap interactions when the demo UI expands.
  const [_selectedCharacterId, _setSelectedCharacterId] = useState<string | null>(null);

  const biomeRef = useRef(biome);
  useEffect(() => {
    biomeRef.current = biome;
  }, [biome]);

  const handleCharacterUpdate = useCallback((updatedChar: CombatCharacter) => {
    setCharacters(prev => {
      const exists = prev.some(c => c.id === updatedChar.id);
      if (!exists) return [...prev, updatedChar];
      return prev.map(c => c.id === updatedChar.id ? updatedChar : c);
    });
  }, []);

  const handleLogEntry = useCallback((entry: CombatLogEntry) => {
    setCombatLog(prev => [...prev, entry]);
  }, []);

  const turnManager = useTurnManager({
    characters,
    mapData,
    onCharacterUpdate: handleCharacterUpdate,
    onLogEntry: handleLogEntry,
    onMapUpdate: setMapData,
    autoCharacters,
    difficulty: 'normal'
  });

  const initializeCombat = turnManager.initializeCombat;
  const turnOrderLength = turnManager.turnState.turnOrder.length;

  // Initialize combat once when the turn order is empty.
  useEffect(() => {
    if (characters.length > 0 && turnOrderLength === 0) {
      initializeCombat(characters);
    }
  }, [characters, initializeCombat, turnOrderLength]);

  // Removed the useEffect that incorrectly attempted to reset the demo component's state when props changed.
  // Because App.tsx advances passive time in the background, props like `party` and `initialCharacters`
  // continuously receive new array references, triggering unintended map regenerations.
  // Initialization is already safely handled on mount via useState.

  const abilitySystem = useAbilitySystem({
    characters,
    mapData,
    onExecuteAction: turnManager.executeAction,
    onCharacterUpdate: handleCharacterUpdate,
    onLogEntry: handleLogEntry,
    onAbilityEffect: turnManager.addDamageNumber,
    reactiveTriggers: turnManager.reactiveTriggers,
    onReactiveTriggerUpdate: turnManager.setReactiveTriggers,
    activeLightSources: turnManager.activeLightSources,
    onActiveLightSourcesUpdate: turnManager.setActiveLightSources,
    onMapUpdate: setMapData,
    onAddSpellZone: turnManager.addSpellZone,
    spellZones: turnManager.spellZones,
    onSpellZonesUpdate: turnManager.setSpellZones,
    onAddScheduledSpellEffect: turnManager.addScheduledSpellEffect,
    onAddMovementDebuff: turnManager.addMovementDebuff,
    onAddSpellMovementVisual: turnManager.addSpellMovementVisual
  });

  const handleToggleAuto = useCallback((characterId: string) => {
    setAutoCharacters(prev => {
      const next = new Set(prev);
      if (next.has(characterId)) {
        next.delete(characterId);
      } else {
        next.add(characterId);
      }
      return next;
    });
  }, []);

  const handleGenerate = () => {
    const nextSeed = Date.now();
    const baseCombatants = getBaseCombatants();
    const setup = generateBattleSetup(biome, nextSeed, baseCombatants);

    setSeed(nextSeed);
    setCombatLog([]); // Clear log on new map
    setSheetCharacter(null);
    setAutoCharacters(new Set());
    setMapData(setup.mapData);
    setCharacters(setup.positionedCharacters);
    turnManager.initializeCombat(setup.positionedCharacters);
  };

  const handleCharacterSelect = useCallback(() => { }, []);

  const handleSheetOpen = (charId: string) => {
    const playerToShow = party.find(p => p.id === charId);
    if (playerToShow) {
      setSheetCharacter(playerToShow);
    } else {
      console.warn(`Could not find full character data for ID: ${charId} in the provided party prop.`);
    }
  };

  const handleSheetClose = () => {
    setSheetCharacter(null);
  };

  const currentCharacter = turnManager.getCurrentCharacter() ?? null;

  // Dev-only deterministic targeting hook (gap #29 / GOAL #14-#15 verification).
  // The headless rig can't reliably click the ability palette: whose turn it is
  // at mount depends on initiative rolls, and an enemy or ability-less character
  // leaves the palette empty (the turn-order flakiness that sank the first
  // capture attempt). `window.__bm3dTargeting.start()` advances turns until a
  // player character with a usable targeted ability is active, then enters
  // targeting mode exactly the way the palette button does.
  const targetingHookRefs = useRef({ turnManager, abilitySystem, characters });
  useEffect(() => { targetingHookRefs.current = { turnManager, abilitySystem, characters }; });
  // Dev-only: expose the generated map so the capture rig can locate terrain
  // features (slopes, water edges) deterministically instead of eyeballing.
  useEffect(() => {
    if (typeof window === 'undefined' || !canUseDevTools()) return;
    (window as unknown as { __bm3dMapData?: unknown }).__bm3dMapData = mapData;
  }, [mapData]);
  useEffect(() => {
    if (typeof window === 'undefined' || !canUseDevTools()) return;
    const w = window as unknown as { __bm3dTargeting?: unknown };
    // Pick the most *visible* showcase: 'area' targeting paints every in-range
    // tile red, while 'single_enemy' only paints enemy-occupied tiles — which
    // is an empty set when spawn separation exceeds the ability's range.
    const pickAbility = (c: CombatCharacter, abilityName?: string) => {
      const abilities = c.abilities ?? [];
      if (abilityName) {
        return abilities.find(a => a.name.toLowerCase().includes(abilityName.toLowerCase()));
      }
      return abilities
        .filter(a => a.targeting !== 'self' && a.range > 0)
        .sort((l, r) =>
          Number(r.targeting === 'area') - Number(l.targeting === 'area')
          || r.range - l.range)[0]
        ?? abilities[0];
    };
    // Synthetic area ability for the AoE-template showcase (GOAL #15): the
    // demo party may have no areaOfEffect ability at all (task 78's best find
    // was single_enemy Acid Splash), and the preview path needs one. Targeting
    // + previewAoE only read shape/size/range — it is never executed.
    const devAoeAbility = {
      id: 'dev-aoe-showcase',
      name: 'Dev AoE Showcase',
      description: 'Dev-only fireball-shaped template for capture verification.',
      type: 'spell',
      targeting: 'area',
      range: 8,
      areaOfEffect: { shape: 'circle', size: 3 },
      cost: { type: 'action' },
      effects: [],
    } as unknown as Ability;
    w.__bm3dTargeting = {
      // prepOnly: advance turns to the chosen caster but do NOT start
      // targeting — gives before/after captures an identical turn state.
      start: async (abilityName?: string, prepOnly?: boolean) => {
        const { characters: roster } = targetingHookRefs.current;
        // '__aoe' selects the synthetic area showcase regardless of roster
        // loadout (real area abilities still win via the normal ranking when
        // present — pass their name instead).
        const useDevAoe = abilityName === '__aoe';
        // Choose the best (caster, ability) across the whole player roster,
        // then advance turns until that caster is active.
        const players = roster.filter(c => c.team === 'player' && c.currentHP > 0);
        const ranked = players
          .map(c => ({ c, a: useDevAoe ? devAoeAbility : pickAbility(c, abilityName) }))
          .filter((x): x is { c: CombatCharacter; a: NonNullable<ReturnType<typeof pickAbility>> } => !!x.a)
          .sort((l, r) =>
            Number(r.a.targeting === 'area') - Number(l.a.targeting === 'area')
            || r.a.range - l.a.range);
        const target = ranked[0];
        if (!target) return 'no-targetable-ability-found';
        for (let attempt = 0; attempt <= roster.length + 2; attempt++) {
          const { turnManager: tmNow, abilitySystem: ab } = targetingHookRefs.current;
          const c = tmNow.getCurrentCharacter();
          if (c && c.id === target.c.id) {
            if (!prepOnly) ab.startTargeting(target.a, c);
            return { character: c.name, team: c.team, ability: target.a.name, targeting: target.a.targeting, range: target.a.range, prepOnly: !!prepOnly };
          }
          await tmNow.endTurn();
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        return 'caster-never-became-active';
      },
      // Deterministic stand-in for hovering tile (x, y) while targeting —
      // drives the same previewAoE the 3D tile-hover path calls (GOAL #15).
      previewAoEAt: (x: number, y: number) => {
        const { turnManager: tmNow, abilitySystem: ab } = targetingHookRefs.current;
        const caster = tmNow.getCurrentCharacter();
        if (!caster) return 'no-active-character';
        if (!ab.targetingMode) return 'not-in-targeting-mode';
        ab.previewAoE({ x, y }, caster);
        return {
          previewedAt: { x, y },
          ability: ab.selectedAbility?.name ?? null,
          hasAreaOfEffect: !!ab.selectedAbility?.areaOfEffect,
        };
      },
      state: () => {
        const ab = targetingHookRefs.current.abilitySystem;
        return { targetingMode: ab.targetingMode, ability: ab.selectedAbility?.name ?? null };
      },
    };
    return () => { delete w.__bm3dTargeting; };
  }, []);

  return (
    <div className="bg-gray-900 text-white h-screen flex flex-col p-4 overflow-hidden">
      {sheetCharacter && (
        <CharacterSheetModal
          isOpen={!!sheetCharacter}
          character={sheetCharacter}
          inventory={[]} // No inventory management in demo
          gold={0} // Default gold value for demo
          onClose={handleSheetClose}
          onAction={(action) => {
            if (canUseDevTools()) {
              logger.debug('Action from sheet:', { action });
            }
          }}
        />
      )}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-amber-400 font-cinzel">Battle Map</h1>
        <button
          onClick={onExit}
          className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg shadow"
        >
          End Battle
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-4 items-center bg-gray-800 p-3 rounded-lg">
        <div>
          <label htmlFor="biomeSelect" className="block text-sm font-medium text-sky-300">
            Select Biome
          </label>
          <select
            id="biomeSelect"
            value={biome}
            onChange={(e) => {
              const nextBiome = e.target.value as BiomeType;
              const baseCombatants = getBaseCombatants();
              const setup = generateBattleSetup(nextBiome, seed, baseCombatants);

              setBiome(nextBiome);
              setCombatLog([]);
              _setSelectedCharacterId(null);
              setSheetCharacter(null);
              setAutoCharacters(new Set());
              setMapData(setup.mapData);
              setCharacters(setup.positionedCharacters);
              turnManager.initializeCombat(setup.positionedCharacters);
            }}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-600 bg-gray-700 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md"
          >
            <option value="forest">Forest</option>
            <option value="cave">Cave</option>
            <option value="dungeon">Dungeon</option>
            <option value="desert">Desert</option>
            <option value="swamp">Swamp</option>
          </select>
        </div>
        <button
          onClick={handleGenerate}
          className="self-end px-5 py-2 bg-green-600 hover:bg-green-500 rounded-lg shadow"
        >
          New Map
        </button>
        <button
          onClick={turnManager.endTurn}
          disabled={!turnManager.isCharacterTurn(currentCharacter?.id || '')}
          className="self-end px-5 py-2 bg-orange-600 hover:bg-orange-500 rounded-lg shadow disabled:bg-gray-500"
        >
          End Turn
        </button>
        {/* [2026-05-21] 2D/3D render mode toggle */}
        <button
          onClick={() => setRenderMode(renderMode === '2d' ? '3d' : '2d')}
          className="self-end px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow font-bold text-sm"
          title={`Switch to ${renderMode === '2d' ? '3D' : '2D'} view`}
        >
          {renderMode === '2d' ? '🎮 3D View' : '🗺️ 2D View'}
        </button>
      </div>

      <div className="flex-grow min-h-0 grid grid-cols-1 xl:grid-cols-5 gap-4 overflow-hidden">
        {/* Left Pane */}
        <div className="xl:col-span-1 flex flex-col gap-4 overflow-y-auto scrollable-content p-1">
          <PartyDisplay
            characters={characters}
            onCharacterSelect={handleCharacterSelect}
            onCharacterInspect={() => {}}
            currentTurnCharacterId={turnManager.turnState.currentCharacterId}
            autoCharacters={autoCharacters}
            onToggleAuto={handleToggleAuto}
          />
        </div>

        {/* Center Pane */}
        <div className="xl:col-span-3 flex flex-col overflow-hidden p-2 relative">
          <ControlsHelp visible={renderMode === '3d'} />
          <ErrorBoundary fallbackMessage="An error occurred in the Battle Map.">
            {renderMode === '3d' ? (
              /* 3D canvas fills entire center pane vertically */
              <BattleMap3D
                mapData={mapData}
                characters={characters}
                combatState={{
                  turnManager: turnManager,
                  turnState: turnManager.turnState,
                  abilitySystem: abilitySystem,
                  isCharacterTurn: turnManager.isCharacterTurn,
                  onCharacterUpdate: handleCharacterUpdate
                }}
              />
            ) : (
              <BattleMap
                mapData={mapData}
                characters={characters}
                combatState={{
                  turnManager: turnManager,
                  turnState: turnManager.turnState,
                  abilitySystem: abilitySystem,
                  isCharacterTurn: turnManager.isCharacterTurn,
                  onCharacterUpdate: handleCharacterUpdate
                }}
              />
            )}
          </ErrorBoundary>
        </div>

        {/* Right Pane */}
        <div className="xl:col-span-1 flex flex-col gap-4 overflow-y-auto scrollable-content p-1">
          <InitiativeTracker
            characters={characters}
            turnState={turnManager.turnState}
            onCharacterSelect={handleSheetOpen}
          />
          {currentCharacter && (
            <ActionEconomyBar
              character={currentCharacter}
              onExecuteAction={turnManager.executeAction}
            />
          )}
          <AbilityPalette
            character={currentCharacter}
            onSelectAbility={(ability) => currentCharacter && abilitySystem.startTargeting(ability, currentCharacter)}
            canAffordAction={(cost) => currentCharacter ? turnManager.canAffordAction(currentCharacter, cost) : false}
          />
          <CombatLog logEntries={combatLog} />
        </div>
      </div>
    </div >
  );
};

export default BattleMapDemo;
