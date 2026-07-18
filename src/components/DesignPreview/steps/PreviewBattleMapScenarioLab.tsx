// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 16/07/2026, 17:39:38
 * Dependents: components/DesignPreview/DesignPreviewPage.tsx
 * Imports: 10 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * This file is the visual debugging harness for WorldForge-derived combat maps.
 *
 * It builds a real generated location in the existing world-generation worker,
 * projects that GroundWorld through the production five-foot combat extractor,
 * and mounts the full playable BattleMapDemo over the result. A diagnostics rail
 * compares source-world facts with tactical facts so missing roads, objects, or
 * structures are visible during review instead of hidden behind plausible art.
 *
 * Called by: DesignPreviewPage.tsx at ?step=battlemaplab
 * Depends on: createWorldGenClient, worldBattleScenario, and BattleMapDemo
 */
import React, { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Landmark,
  PanelRightClose,
  PanelRightOpen,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Swords,
  TreePine,
  UsersRound,
  Waves,
  XCircle,
} from "lucide-react";
import { loadMonstersData } from "../../../data/monsters";
import { buildWorldBattleLabParty } from "../../../devtools/worldBattleLabParty";
import type { Monster } from "../../../types";
import type {
  BattleMapOpeningSceneResolution,
  BattleMapOpeningThreatEntity,
  CombatCharacter,
} from "../../../types/combat";
import { Button } from "../../ui/Button";
import { createWorldGenClient } from "../../World3D/createWorldGenClient";
import {
  WORLD_BATTLE_SCENARIO_PRESETS,
  createWorldBattleScenarioFromGround,
  type WorldBattleParityStatus,
  type WorldBattleScenario,
  type WorldBattleScenarioPreset,
} from "../../../systems/combat/worldScenario/worldBattleScenario";
import { createWorldDefenderCombatants } from "../../../systems/combat/worldScenario/worldEncounterCombatants";
import { createEnemyFromMonster } from "../../../utils/combat/createEnemyFromMonster";

const BattleMapDemo = lazy(() => import("../../BattleMap/BattleMapDemo"));

// ============================================================================
// Small Diagnostic Primitives
// ============================================================================
// These rows keep dense source/referee counts aligned without introducing a
// second card system inside the lab's two primary regions.
// ============================================================================

const FactRow: React.FC<{ label: string; value: number | string }> = ({
  label,
  value,
}) => (
  <div className="flex min-h-6 items-center justify-between gap-4 border-b border-slate-800/80 py-1.5 text-xs last:border-b-0">
    <span className="text-slate-400">{label}</span>
    <span className="font-mono font-semibold text-slate-100">
      {typeof value === "number" ? value.toLocaleString() : value}
    </span>
  </div>
);

const parityVisual: Record<
  WorldBattleParityStatus,
  {
    Icon: typeof CheckCircle2;
    className: string;
  }
> = {
  pass: { Icon: CheckCircle2, className: "text-emerald-400" },
  warning: { Icon: CircleAlert, className: "text-amber-400" },
  gap: { Icon: XCircle, className: "text-rose-400" },
};

// ============================================================================
// Source Location Link
// ============================================================================
// Reviewers can open the same seed/cell in the real 3D ground view and compare
// it with the tactical crop. Query pairs come from the preset recipe.
// ============================================================================

function openSourceLocation(query: string): void {
  const url = new URL("/Aralia/", window.location.origin);
  for (const pair of query.split("&")) {
    const [key, value] = pair.split("=");
    if (key) url.searchParams.set(key, value ?? "");
  }
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

// ============================================================================
// Explicit Opening-Threat Visual Fixture
// ============================================================================
// A real opening normally receives this roster from the model. The deterministic
// lab cannot depend on a live model, so the preset labels its substitute and
// passes it through the same bestiary-to-combatant bridge as production.
// ============================================================================

async function createOpeningThreatFixtureCombatants(
  fixture: NonNullable<WorldBattleScenarioPreset["visualOpeningThreatFixture"]>,
  sourceEntities: readonly BattleMapOpeningThreatEntity[],
  sceneResolution?: BattleMapOpeningSceneResolution,
): Promise<CombatCharacter[]> {
  // Match production defender loading: never let an unloaded registry silently
  // collapse a named threat into the converter's generic fallback creature.
  await loadMonstersData();

  const expectedSceneEntities = fixture.reduce(
    (total, entry) => total + entry.quantity,
    0,
  );
  if (
    expectedSceneEntities !==
    (sceneResolution?.entityOutcomes.length ?? sourceEntities.length)
  ) {
    throw new Error(
      `Opening fixture describes ${expectedSceneEntities} source creatures but the scene remembers ${sceneResolution?.entityOutcomes.length ?? sourceEntities.length}.`,
    );
  }

  // Build only creatures that remain physically present. A resolved return can
  // therefore show downed bodies without resurrecting withdrawn survivors as
  // ordinary enemy tokens.
  return sourceEntities.map((sourceEntity) => {
    const entry = fixture.find(
      (candidate) => candidate.name === sourceEntity.monsterName,
    );
    if (!entry || sourceEntity.monsterOrdinal > entry.quantity) {
      throw new Error(
        `Opening source entity ${sourceEntity.entityId} has no matching labeled monster fixture.`,
      );
    }
    const monster: Monster = {
      name: entry.name,
      quantity: 1,
      cr: entry.cr,
      description: `${entry.name} from the deterministic hostile-opening visual fixture.`,
    };
    const combatant = createEnemyFromMonster(
      monster,
      sourceEntity.monsterOrdinal - 1,
    );
    const { position: _sourcePosition, ...worldSource } = sourceEntity;
    const outcome = sceneResolution?.entityOutcomes.find(
      (candidate) => candidate.sourceEntityId === sourceEntity.entityId,
    );
    return {
      ...combatant,
      id: `opening-fixture:${sourceEntity.entityId}`,
      name: `${entry.name} ${sourceEntity.monsterOrdinal}`,
      currentHP: outcome?.status === "downed" ? 0 : combatant.currentHP,
      worldSource,
    };
  });
}

// ============================================================================
// Scenario Lab
// ============================================================================
// World generation stays off the UI thread. Selecting or rebuilding a preset
// replaces the worker request; only the latest result mounts into combat.
// ============================================================================

export const PreviewBattleMapScenarioLab: React.FC = () => {
  const [presetId, setPresetId] = useState(() => {
    // A query-selected recipe gives the deterministic screenshot runner a
    // stable deep link while unknown values still fall back to the first lab.
    const requested =
      typeof window === "undefined"
        ? null
        : new URLSearchParams(window.location.search).get("scenario");
    return WORLD_BATTLE_SCENARIO_PRESETS.some(
      (candidate) => candidate.id === requested,
    )
      ? requested!
      : WORLD_BATTLE_SCENARIO_PRESETS[0].id;
  });
  const [rebuildNonce, setRebuildNonce] = useState(0);
  const [scenario, setScenario] = useState<WorldBattleScenario | null>(null);
  const [scenarioCharacters, setScenarioCharacters] = useState<
    CombatCharacter[]
  >([]);
  const [buildStage, setBuildStage] = useState("Resolving atlas cell");
  const [buildError, setBuildError] = useState<string | null>(null);
  const [diagnosticsVisible, setDiagnosticsVisible] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 1280px)").matches,
  );
  // Each recipe opens on the layer it is meant to audit. Reviewers can still
  // combine layers manually, but the default screenshot avoids unrelated pins
  // obscuring the scenario's primary source fact.
  const [objectFactsVisible, setObjectFactsVisible] = useState(
    () => presetId === "legium-town-skirmish",
  );
  const [occupantFactsVisible, setOccupantFactsVisible] = useState(
    // The gate audit opens with residents because schedule parity is its focus.
    // The live-watch audit instead opens clean so 248 ambient markers do not
    // hide the party and patrol whose deployment it is meant to judge.
    () => presetId === "legium-settlement-edge",
  );

  const preset = useMemo(
    () =>
      WORLD_BATTLE_SCENARIO_PRESETS.find(
        (candidate) => candidate.id === presetId,
      ) ?? WORLD_BATTLE_SCENARIO_PRESETS[0],
    [presetId],
  );
  // The visual harness uses canonical level-one class packages so selecting any
  // party member exposes real weapon and armor mechanics rather than the dummy
  // fixture's generic Unarmed Strike fallback.
  const party = useMemo(() => buildWorldBattleLabParty(), []);

  useEffect(() => {
    let active = true;
    const client = createWorldGenClient();

    client.generate(
      {
        wfSeed: preset.worldSeed,
        entryCellId: preset.entryCellId,
        centerPx: preset.centerPx,
        hour: preset.hour ?? 12,
      },
      {
        onProgress: () => {
          if (active) setBuildStage("Building local terrain and structures");
        },
        onStageA: () => {
          if (active) setBuildStage("Placing source-world props");
        },
        onStageB: (ground) => {
          if (!active) return;
          try {
            const builtScenario = createWorldBattleScenarioFromGround(
              preset,
              ground,
              {
                // The lab opts into a deterministic wanted-party fixture so the
                // real combat UI can exercise the hostility bridge. Production
                // callers must supply live crime or faction-standing state.
                useVisualHostilityFixture: true,
              },
            );
            const defendingForce =
              builtScenario.mapData.encounterContext?.kind ===
                "settlement-edge" ||
              builtScenario.mapData.encounterContext?.kind ===
                "settlement-watch" ||
              builtScenario.mapData.encounterContext?.kind ===
                "settlement-state-patrol"
                ? builtScenario.mapData.encounterContext.defendingForce
                : undefined;
            const openingThreatFixture =
              builtScenario.mapData.encounterContext?.kind ===
              "opening-standoff"
                ? preset.visualOpeningThreatFixture
                : undefined;
            const openingSourceEntities =
              builtScenario.mapData.encounterContext?.kind ===
              "opening-standoff"
                ? builtScenario.mapData.encounterContext.sourceEntities
                : [];
            const openingSceneResolution =
              builtScenario.mapData.encounterContext?.kind ===
              "opening-standoff"
                ? builtScenario.mapData.encounterContext.sceneResolution
                : undefined;
            setBuildStage(
              openingThreatFixture
                ? "Loading labeled opening-threat mechanics"
                : defendingForce
                  ? "Loading source defender mechanics"
                  : "Ready",
            );

            // Mount the combat shell only after the source roles have real
            // bestiary mechanics. The hostile-opening roster is explicitly a
            // deterministic model substitute; all other context still comes
            // from the production WorldForge projector.
            const combatantRequest = openingSceneResolution
              ? Promise.resolve([])
              : openingThreatFixture
                ? createOpeningThreatFixtureCombatants(
                    openingThreatFixture,
                    openingSourceEntities,
                    openingSceneResolution,
                  )
                : createWorldDefenderCombatants(defendingForce);
            void combatantRequest
              .then((combatants) => {
                if (!active) return;
                setScenarioCharacters(combatants);
                setScenario(builtScenario);
                setBuildStage("Ready");
              })
              .catch((error: unknown) => {
                if (active)
                  setBuildError(
                    error instanceof Error ? error.message : String(error),
                  );
              });
          } catch (error) {
            setBuildError(
              error instanceof Error ? error.message : String(error),
            );
          }
        },
        onError: (message) => {
          if (active) setBuildError(message);
        },
      },
    );

    return () => {
      active = false;
      client.dispose();
    };
  }, [preset, rebuildNonce]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1280px)");
    const followViewport = (event: MediaQueryListEvent): void => {
      setDiagnosticsVisible(event.matches);
    };
    desktop.addEventListener("change", followViewport);
    return () => desktop.removeEventListener("change", followViewport);
  }, []);

  // Reset in the originating interaction rather than inside the worker effect.
  // This keeps the effect focused on synchronizing with the external worker and
  // avoids an extra cascading render whenever a scenario recipe changes.
  const selectPreset = (nextPresetId: string): void => {
    if (nextPresetId === presetId) return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("scenario", nextPresetId);
    window.history.replaceState(null, "", nextUrl);
    setScenario(null);
    setScenarioCharacters([]);
    setBuildError(null);
    setBuildStage("Resolving atlas cell");
    setObjectFactsVisible(nextPresetId === "legium-town-skirmish");
    setOccupantFactsVisible(nextPresetId === "legium-settlement-edge");
    setPresetId(nextPresetId);
  };

  const rebuildPreset = (): void => {
    setScenario(null);
    setScenarioCharacters([]);
    setBuildError(null);
    setBuildStage("Resolving atlas cell");
    setRebuildNonce((value) => value + 1);
  };

  const sourceLabel = scenario
    ? `${scenario.locationLabel} / World ${scenario.preset.worldSeed} / Cell ${scenario.preset.entryCellId}`
    : "";
  const openingContext =
    scenario?.mapData.encounterContext?.kind === "opening-standoff"
      ? scenario.mapData.encounterContext
      : null;
  const paritySummary = scenario?.diagnostics.parity.reduce(
    (counts, check) => ({
      ...counts,
      [check.status]: counts[check.status] + 1,
    }),
    { pass: 0, warning: 0, gap: 0 },
  ) ?? { pass: 0, warning: 0, gap: 0 };
  const objectParity = scenario?.diagnostics.parity.find(
    (check) => check.id === "object-targeting",
  );
  const occupantParity = scenario?.diagnostics.parity.find(
    (check) => check.id === "occupant-projection",
  );
  const defenderSourceParity = scenario?.diagnostics.parity.find(
    (check) => check.id === "settlement-defender-source",
  );
  const hostilityParity = scenario?.diagnostics.parity.find(
    (check) => check.id === "faction-hostility",
  );
  const hostilityLiveParity = scenario?.diagnostics.parity.find(
    (check) => check.id === "faction-hostility-live-input",
  );
  // The section badge answers whether the defending force itself is valid.
  // A visual fixture can leave the separate "live input" proof open without
  // turning a real regiment and hostile verdict into a misleading force gap.
  const defendingForceStatus: WorldBattleParityStatus = [
    defenderSourceParity,
    hostilityParity,
  ].some((check) => check?.status === "gap")
    ? "gap"
    : [defenderSourceParity, hostilityParity].some(
          (check) => check?.status === "warning",
        )
      ? "warning"
      : "pass";
  const encounterClock = preset.hour ?? 12;
  const encounterHour = Math.floor(encounterClock);
  const encounterMinute = Math.round((encounterClock - encounterHour) * 60);
  const encounterClockLabel = `${String(encounterHour).padStart(2, "0")}:${String(encounterMinute).padStart(2, "0")}`;

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#0b1119] text-slate-100"
      data-testid="battle-map-scenario-lab"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-700 bg-slate-950 px-3 py-2">
        <div className="mr-auto min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">
            WorldForge tactical projection
          </div>
          <div className="truncate font-cinzel text-base font-bold text-amber-300">
            {scenario?.locationLabel ?? preset.label}{" "}
            <span className="text-xs font-sans font-medium text-slate-500">
              {preset.encounterFrame}
            </span>
          </div>
          {/* Every scene carries an authored description; keeping it visible
              (not just a hover tooltip) tells reviewers what the scenario is
              meant to prove before they judge the map. */}
          <p
            className="mt-0.5 max-w-3xl text-xs leading-snug text-slate-400"
            data-testid="scenario-description"
          >
            {preset.description}
          </p>
        </div>

        {/* Scenario choices are a compact segmented control because they switch
            the lab's data source rather than execute an in-world command. */}
        <div className="flex h-9 items-stretch rounded-md border border-slate-700 bg-slate-900 p-0.5">
          {WORLD_BATTLE_SCENARIO_PRESETS.map((candidate) => {
            const selected = candidate.id === preset.id;
            const Icon = candidate.id.startsWith("legium-hostile-opening")
              ? Swords
              : candidate.id === "boreal-woodland"
                ? TreePine
                : candidate.id === "river-bridge-crossing"
                  ? Waves
                  : candidate.id === "legium-settlement-edge" ||
                      candidate.id === "legium-watch-interception" ||
                      candidate.id === "legium-state-patrol"
                    ? UsersRound
                    : Landmark;
            return (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                key={candidate.id}
                aria-pressed={selected}
                onClick={() => selectPreset(candidate.id)}
                className={`min-w-0 rounded px-2.5 text-xs font-semibold transition-colors ${
                  selected
                    ? "bg-emerald-600 text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
                title={`${candidate.label}: ${candidate.description}`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Icon size={14} aria-hidden="true" />
                  <span className="hidden sm:inline">{candidate.label}</span>
                </span>
              </Button>
            );
          })}
        </div>

        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-pressed={occupantFactsVisible}
          aria-label={`${occupantFactsVisible ? "Hide" : "Show"} source residents`}
          onClick={() => setOccupantFactsVisible((visible) => !visible)}
          className={`h-9 w-9 border p-0 transition-colors ${
            occupantFactsVisible
              ? "border-violet-400/70 bg-violet-950 text-violet-200 hover:bg-violet-900"
              : "border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
          title={`${occupantFactsVisible ? "Hide" : "Show"} source residents`}
        >
          <UsersRound size={16} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={rebuildPreset}
          className="h-9 border border-slate-600 bg-slate-800 px-2.5 text-xs text-slate-100 hover:bg-slate-700"
          title="Rebuild this exact world seed and cell"
        >
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Rebuild</span>
          </span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => openSourceLocation(preset.sourceRouteQuery)}
          className="h-9 border border-sky-500/50 bg-sky-950/70 px-2.5 text-xs text-sky-100 hover:bg-sky-900"
          title="Open this source location in the 3D ground view"
        >
          <span className="inline-flex items-center gap-1.5">
            <ExternalLink size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Source 3D</span>
          </span>
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-pressed={objectFactsVisible}
          aria-label={`${objectFactsVisible ? "Hide" : "Show"} targetable object facts`}
          onClick={() => setObjectFactsVisible((visible) => !visible)}
          className={`h-9 w-9 border p-0 transition-colors ${
            objectFactsVisible
              ? "border-cyan-400/70 bg-cyan-950 text-cyan-200 hover:bg-cyan-900"
              : "border-slate-600 bg-slate-800 text-slate-400 hover:bg-slate-700"
          }`}
          title={`${objectFactsVisible ? "Hide" : "Show"} targetable object facts`}
        >
          <ScanSearch size={16} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-pressed={diagnosticsVisible}
          aria-label={`${diagnosticsVisible ? "Hide" : "Show"} projection diagnostics`}
          onClick={() => setDiagnosticsVisible((visible) => !visible)}
          className="h-9 w-9 border border-slate-600 bg-slate-800 p-0 text-slate-200 hover:bg-slate-700"
          title={`${diagnosticsVisible ? "Hide" : "Show"} projection diagnostics`}
        >
          {diagnosticsVisible ? (
            <PanelRightClose size={16} aria-hidden="true" />
          ) : (
            <PanelRightOpen size={16} aria-hidden="true" />
          )}
        </Button>
      </header>

      {/* A side-by-side audit rail needs enough room for both combat rosters
          and an 80-column board. At narrower desktop widths the rail moves
          below the battle UI so whole-map fit does not collapse into a tiny
          strip surrounded by unused vertical space. */}
      <div className="flex min-h-0 flex-1 flex-col 2xl:flex-row">
        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          {buildError ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-xl border border-rose-500/50 bg-rose-950/40 p-4 text-sm text-rose-100">
                <div className="mb-1 font-bold">Scenario build failed</div>
                <div className="font-mono text-xs text-rose-200">
                  {buildError}
                </div>
              </div>
            </div>
          ) : !scenario ? (
            <div
              className="absolute inset-0 flex items-center justify-center"
              aria-live="polite"
            >
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <RefreshCw
                  size={18}
                  className="animate-spin text-emerald-400"
                  aria-hidden="true"
                />
                <span>{buildStage}</span>
              </div>
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                  Loading combat shell
                </div>
              }
            >
              <BattleMapDemo
                key={scenario.key}
                onExit={() => setRebuildNonce((value) => value + 1)}
                initialCharacters={scenarioCharacters}
                party={party}
                initialMapData={scenario.mapData}
                allowSandboxGeneration={false}
                // A resolved return contains world-body facts, not enemy
                // combatants. Never let the developer demo fill that honest
                // empty roster with its generic arena opponents.
                allowFallbackEnemies={!openingContext?.sceneResolution}
                sourceLabel={sourceLabel}
                // World-composition recipes open fitted. The live-watch recipe
                // opens at the production usability floor and auto-centers the
                // active combatant so token spacing and interception direction
                // can be inspected instead of reduced to four-pixel dots.
                preferFullMapFit={
                  preset.id !== "legium-watch-interception" &&
                  preset.id !== "legium-state-patrol" &&
                  !preset.id.startsWith("legium-hostile-opening")
                }
                showTargetableObjectFacts={objectFactsVisible}
                showWorldOccupants={occupantFactsVisible}
              />
            </Suspense>
          )}
        </main>

        {diagnosticsVisible && (
          <aside
            className="max-h-[42%] w-full shrink-0 overflow-y-auto border-t border-slate-700 bg-slate-950 2xl:max-h-none 2xl:w-80 2xl:border-l 2xl:border-t-0"
            data-testid="scenario-diagnostics"
          >
            <section className="border-b border-slate-700 px-4 py-3">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-amber-300">
                Provenance
              </h2>
              <div className="mt-2 flex flex-wrap gap-1">
                {(
                  scenario?.mapData.provenance?.generationPath ?? [
                    "World",
                    "Region",
                    "Local",
                    "Ground",
                    "Tactical patch",
                  ]
                ).map((stage, index, stages) => (
                  <React.Fragment key={stage}>
                    <span className="rounded border border-slate-700 bg-slate-900 px-1.5 py-1 text-[10px] font-semibold text-slate-200">
                      {stage}
                    </span>
                    {index < stages.length - 1 && (
                      <span className="self-center text-[10px] text-slate-600">
                        /
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-slate-500">
                Seed {preset.worldSeed} / cell {preset.entryCellId} /{" "}
                {encounterClockLabel}
              </div>
              {/* Captures must reveal an active parity problem even when the
                  detailed explanations continue below the visible rail. */}
              <div
                className="mt-2 grid grid-cols-3 divide-x divide-slate-700 overflow-hidden rounded border border-slate-700 bg-slate-900/70"
                aria-label="Parity summary"
              >
                <div
                  className="flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold text-emerald-300"
                  title="Passing parity checks"
                >
                  <CheckCircle2 size={12} aria-hidden="true" />{" "}
                  {paritySummary.pass} pass
                </div>
                <div
                  className="flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold text-amber-300"
                  title="Parity warnings"
                >
                  <CircleAlert size={12} aria-hidden="true" />{" "}
                  {paritySummary.warning} warn
                </div>
                <div
                  className="flex items-center justify-center gap-1 py-1.5 text-[10px] font-semibold text-rose-300"
                  title="Missing semantic bridges"
                >
                  <XCircle size={12} aria-hidden="true" /> {paritySummary.gap}{" "}
                  gap
                </div>
              </div>
            </section>

            {openingContext && (
              <section
                className="border-b border-slate-700 px-4 py-3"
                data-testid="scenario-opening-source-facts"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-cyan-300">
                    <Swords size={13} aria-hidden="true" />{" "}
                    {openingContext.sceneResolution
                      ? "Opening aftermath"
                      : "Opening standoff"}
                  </h2>
                  <span className="text-[10px] font-bold uppercase text-emerald-300">
                    {openingContext.sceneContinuity === "resolved-return"
                      ? "aftermath replayed"
                      : openingContext.sceneContinuity === "saved-replay"
                        ? "scene replayed"
                        : "scene authored"}
                  </span>
                </div>
                <div className="mt-1">
                  <FactRow
                    label="Source receipt"
                    value={openingContext.sourceReceiptId}
                  />
                  <FactRow
                    label="Entity scene"
                    value={openingContext.sourceSceneReceiptId}
                  />
                  <FactRow
                    label="Scene continuity"
                    value={openingContext.sceneContinuity ?? "legacy / unknown"}
                  />
                  <FactRow
                    label="Source atlas cell"
                    value={openingContext.sourceWorldCellId}
                  />
                  <FactRow
                    label="Player anchor"
                    value={`${openingContext.anchorTile.x}, ${openingContext.anchorTile.y}`}
                  />
                  <FactRow
                    label="Labeled model substitute"
                    value={
                      (preset.visualOpeningThreatFixture ?? [])
                        .map((entry) => `${entry.quantity}x ${entry.name}`)
                        .join(", ") || "None"
                    }
                  />
                  <FactRow
                    label="Source enemy positions"
                    value={
                      openingContext.sceneResolution
                        ? `${openingContext.sourceEntities.length} physical / ${openingContext.sceneResolution.entityOutcomes.length} resolved`
                        : `${openingContext.sourceEntities.length} authored`
                    }
                  />
                  <FactRow
                    label="Approach direction"
                    value={`${openingContext.approachDirection.x.toFixed(2)}, ${openingContext.approachDirection.y.toFixed(2)}`}
                  />
                  <FactRow
                    label="Social topology"
                    value={openingContext.sourceEntities
                      .map((entity) => entity.socialRole)
                      .join(" / ")}
                  />
                  <FactRow
                    label="Body silhouettes"
                    value={`${openingContext.sourceEntities.filter((entity) => entity.bodyState).length} authored / ${new Set(openingContext.sourceEntities.map((entity) => entity.bodyState?.posture).filter(Boolean)).size} postures`}
                  />
                  <FactRow
                    label="Carried profiles"
                    value={
                      openingContext.sourceEntities
                        .map((entity) => entity.bodyState?.carriedProfile)
                        .filter((profile) => profile && profile !== "none")
                        .join(" / ") || "None"
                    }
                  />
                  <FactRow
                    label="Ecological traces"
                    value={openingContext.ecologicalTraces.length}
                  />
                  <FactRow
                    label="Terrain memory"
                    value={
                      (openingContext.terrainImprints ?? [])
                        .map((imprint) => imprint.kind)
                        .join(" / ") || "Missing"
                    }
                  />
                  <FactRow
                    label="Activity site"
                    value={
                      openingContext.activitySite
                        ? `${openingContext.activitySite.label} / ${openingContext.activitySite.ageBand}`
                        : "Missing"
                    }
                  />
                  <FactRow
                    label="Physical evidence"
                    value={
                      openingContext.activitySite?.contents.join(" / ") ??
                      "Missing"
                    }
                  />
                  {openingContext.sceneResolution && (
                    <>
                      <FactRow
                        label="Battle outcome"
                        value={openingContext.sceneResolution.outcome}
                      />
                      <FactRow
                        label="Creature outcomes"
                        value={openingContext.sceneResolution.entityOutcomes
                          .map((outcome) => outcome.status)
                          .join(" / ")}
                      />
                      <FactRow
                        label="Site after combat"
                        value={
                          openingContext.sceneResolution.activitySiteCondition
                        }
                      />
                      <FactRow
                        label="Combat disturbance"
                        value={`${openingContext.sceneResolution.combatDisturbance.severity} / ${openingContext.sceneResolution.combatDisturbance.extentCells.length.toFixed(1)} x ${openingContext.sceneResolution.combatDisturbance.extentCells.width.toFixed(1)} cells`}
                      />
                    </>
                  )}
                  <FactRow
                    label="Trace ages"
                    value={[
                      ...new Set(
                        openingContext.ecologicalTraces.map(
                          (trace) => trace.ageBand ?? "unknown",
                        ),
                      ),
                    ].join(" / ")}
                  />
                  <FactRow label="Omitted history" value="Pre-contact route" />
                </div>
                <div className="mt-2 border-l-2 border-emerald-400 pl-2 text-[10px] leading-4 text-emerald-100">
                  {openingContext.sceneResolution
                    ? "The original site and ecology remain source facts; only combat-authored bodies, withdrawals, and ground disturbance alter this return view. Earlier travel history remains explicitly unauthored."
                    : "Current positions, roles, body posture, carried load, facing, trace ages, and the occupied activity site are frozen WorldForge scene facts. Earlier travel history remains explicitly unauthored."}
                </div>
              </section>
            )}

            {scenario?.diagnostics.defense.stateName && (
              <section
                className="border-b border-slate-700 px-4 py-3"
                data-testid="scenario-defender-facts"
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-red-300">
                    <ShieldCheck size={13} aria-hidden="true" /> Defending force
                  </h2>
                  <span
                    className={`text-[10px] font-bold uppercase ${
                      defendingForceStatus === "gap"
                        ? "text-rose-300"
                        : defendingForceStatus === "warning"
                          ? "text-amber-300"
                          : "text-emerald-300"
                    }`}
                  >
                    {defendingForceStatus}
                  </span>
                </div>
                {/* Regiment scale and tactical scale stay side by side so a
                    screenshot cannot imply that one token equals one troop. */}
                <div className="mt-1">
                  <FactRow
                    label="Controlling state"
                    value={
                      scenario.diagnostics.defense.stateFullName ??
                      scenario.diagnostics.defense.stateName
                    }
                  />
                  <FactRow
                    label="Stationed regiments / troops"
                    value={`${scenario.diagnostics.defense.stationedRegiments} / ${scenario.diagnostics.defense.stationedTroops.toLocaleString()}`}
                  />
                  <FactRow
                    label="Selected regiment"
                    value={scenario.diagnostics.defense.selectedRegiment ?? "-"}
                  />
                  <FactRow
                    label="Regiment troops / state alert"
                    value={`${scenario.diagnostics.defense.selectedRegimentTroops.toLocaleString()} / ${scenario.diagnostics.defense.stateAlert ?? "-"}`}
                  />
                  <FactRow
                    label="Tactical sample"
                    value={`${scenario.diagnostics.defense.tacticalActors}: ${scenario.diagnostics.defense.tacticalUnits.join(", ")}`}
                  />
                  <FactRow
                    label="Not in gate patrol"
                    value={
                      scenario.diagnostics.defense.excludedUnits.join(", ") ||
                      "None"
                    }
                  />
                  <FactRow
                    label="Combat verdict"
                    value={
                      scenario.diagnostics.defense.hostility.verdict ===
                      "hostile"
                        ? "Hostile"
                        : scenario.diagnostics.defense.hostility.verdict ===
                            "withhold-combat"
                          ? "Withhold combat"
                          : "Not required"
                    }
                  />
                  <FactRow
                    label="Encounter trigger"
                    value={`${scenario.diagnostics.defense.hostility.triggerKind} / ${scenario.diagnostics.defense.hostility.triggerSource}`}
                  />
                  <FactRow
                    label="Player-state relation"
                    value={
                      scenario.diagnostics.defense.hostility.relationSummary
                    }
                  />
                </div>
                <div className="mt-2 border-l-2 border-amber-500 pl-2 text-[10px] leading-4 text-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <span>Hostility authority</span>
                    <span
                      className={
                        hostilityParity?.status === "pass"
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }
                    >
                      {hostilityParity?.status ?? "building"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>Live player-state input</span>
                    <span
                      className={
                        hostilityLiveParity?.status === "gap"
                          ? "text-rose-300"
                          : "text-emerald-300"
                      }
                    >
                      {hostilityLiveParity?.status ?? "building"}
                    </span>
                  </div>
                  <div className="mt-1 text-amber-200">
                    {scenario.diagnostics.defense.hostility.inputKind ===
                    "visual-harness-fixture"
                      ? "Deterministic fixture; production must provide the current crime or faction standing."
                      : scenario.diagnostics.defense.hostility.detail}
                  </div>
                </div>
              </section>
            )}

            <section
              className="border-b border-slate-700 px-4 py-3"
              data-testid="scenario-occupant-facts"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-violet-300">
                  Resident facts
                </h2>
                <span
                  className={`text-[10px] font-bold uppercase ${
                    occupantParity?.status === "gap"
                      ? "text-rose-300"
                      : occupantParity?.status === "warning"
                        ? "text-amber-300"
                        : "text-emerald-300"
                  }`}
                >
                  {occupantParity?.status ?? "building"}
                </span>
              </div>
              {/* The board groups residents by cell for legibility; these counts
                  prove that grouping did not discard source identities. */}
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-400">
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-violet-300 bg-violet-950 text-violet-100"
                  aria-hidden="true"
                >
                  <UsersRound size={10} strokeWidth={2.5} />
                </span>
                Ambient resident, fuchsia ring while moving
              </div>
              <div className="mt-1">
                <FactRow
                  label="Source identities (crop / window)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.source.occupantsInCrop} / ${scenario.diagnostics.source.occupants}`
                      : "-"
                  }
                />
                <FactRow
                  label="Projected identities / occupied cells"
                  value={
                    scenario
                      ? `${scenario.diagnostics.tactical.worldOccupants} / ${scenario.diagnostics.tactical.occupiedOccupantCells}`
                      : "-"
                  }
                />
                <FactRow
                  label={`Moving at ${encounterClockLabel} (source / projected)`}
                  value={
                    scenario
                      ? `${scenario.diagnostics.source.movingOccupantsInCrop} / ${scenario.diagnostics.tactical.movingOccupants}`
                      : "-"
                  }
                />
                <FactRow
                  label="Residents on blocked cells"
                  value={
                    scenario?.diagnostics.tactical.occupantsOnBlockedTiles ??
                    "-"
                  }
                />
              </div>
            </section>

            <section
              className="border-b border-slate-700 px-4 py-3"
              data-testid="scenario-object-facts"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[11px] font-bold uppercase tracking-widest text-cyan-300">
                  Object facts
                </h2>
                <span
                  className={`text-[10px] font-bold uppercase ${
                    objectParity?.status === "gap"
                      ? "text-rose-300"
                      : objectParity?.status === "warning"
                        ? "text-amber-300"
                        : "text-emerald-300"
                  }`}
                >
                  {objectParity?.status ?? "building"}
                </span>
              </div>
              {/* These swatches match the transparent marks drawn over the
                  board. Keeping the key beside the counts makes a static
                  screenshot understandable without relying on hover text. */}
              <div className="mt-2 flex items-center gap-4 text-[10px] text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded-full border-2 border-cyan-300 bg-cyan-500/10"
                    aria-hidden="true"
                  />
                  Feature
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rotate-45 rounded-sm border-2 border-amber-300 bg-amber-500/10"
                    aria-hidden="true"
                  />
                  Prop
                </span>
              </div>
              <div className="mt-1">
                <FactRow
                  label="Source anchors (feature / prop)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.source.naturalFeaturesInCrop} / ${scenario.diagnostics.source.placedPropsInCrop}`
                      : "-"
                  }
                />
                <FactRow
                  label="Tactical targets (feature / prop)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.tactical.targetableFeatures} / ${scenario.diagnostics.tactical.targetableProps}`
                      : "-"
                  }
                />
                <FactRow
                  label="Incomplete mobility / weight"
                  value={
                    scenario?.diagnostics.tactical.incompleteTargetFacts ?? "-"
                  }
                />
              </div>
            </section>

            <section className="border-b border-slate-700 px-4 py-3">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-sky-300">
                Source world
              </h2>
              <div className="mt-1">
                <FactRow
                  label="Natural features (crop / window)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.source.naturalFeaturesInCrop} / ${scenario.diagnostics.source.naturalFeatures}`
                      : "-"
                  }
                />
                <FactRow
                  label="Placed props (crop / window)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.source.placedPropsInCrop} / ${scenario.diagnostics.source.placedProps}`
                      : "-"
                  }
                />
                <FactRow
                  label="Roads (regional / town)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.source.roadRuns} (${scenario.diagnostics.source.regionalRoadRuns} / ${scenario.diagnostics.source.townStreetRuns})`
                      : "-"
                  }
                />
                <FactRow
                  label="River runs"
                  value={scenario?.diagnostics.source.riverRuns ?? "-"}
                />
                <FactRow
                  label="Crossings (bridge / ford)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.source.crossings} (${scenario.diagnostics.source.bridges} / ${scenario.diagnostics.source.fords})`
                      : "-"
                  }
                />
                <FactRow
                  label="Buildings (crop / window)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.source.buildingsInCrop} / ${scenario.diagnostics.source.buildings}`
                      : "-"
                  }
                />
                <FactRow
                  label="Gatehouses (crop / window)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.source.gatehousesInCrop} / ${scenario.diagnostics.source.gatehouses}`
                      : "-"
                  }
                />
                <FactRow
                  label="Residents (crop / window)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.source.occupantsInCrop} / ${scenario.diagnostics.source.occupants}`
                      : "-"
                  }
                />
                <FactRow
                  label="Hostiles"
                  value={scenario?.diagnostics.source.hostiles ?? "-"}
                />
              </div>
            </section>

            <section className="border-b border-slate-700 px-4 py-3">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">
                Tactical projection
              </h2>
              <div className="mt-1">
                <FactRow
                  label="Referee tiles"
                  value={scenario?.diagnostics.tactical.tiles ?? "-"}
                />
                <FactRow
                  label="Decorated tiles"
                  value={scenario?.diagnostics.tactical.decoratedTiles ?? "-"}
                />
                <FactRow
                  label="Road tiles (regional / town)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.tactical.roadTiles} (${scenario.diagnostics.tactical.regionalRoadTiles} / ${scenario.diagnostics.tactical.townStreetTiles})`
                      : "-"
                  }
                />
                <FactRow
                  label="Passable road tiles"
                  value={
                    scenario?.diagnostics.tactical.passableRoadTiles ?? "-"
                  }
                />
                <FactRow
                  label="Crossing tiles (bridge / ford)"
                  value={
                    scenario
                      ? `${scenario.diagnostics.tactical.crossingTiles} (${scenario.diagnostics.tactical.bridgeTiles} / ${scenario.diagnostics.tactical.fordTiles})`
                      : "-"
                  }
                />
                <FactRow
                  label="Passable crossing"
                  value={
                    scenario?.diagnostics.tactical.passableCrossingTiles ?? "-"
                  }
                />
                <FactRow
                  label="Encounter frame"
                  value={
                    scenario?.diagnostics.tactical.encounterContext ===
                    "opening-standoff"
                      ? "Opening standoff"
                      : scenario?.diagnostics.tactical.encounterContext ===
                          "road-ambush"
                        ? "Road ambush"
                        : scenario?.diagnostics.tactical.encounterContext ===
                            "river-crossing"
                          ? "River crossing"
                          : scenario?.diagnostics.tactical.encounterContext ===
                              "settlement-edge"
                            ? "Settlement edge"
                            : scenario?.diagnostics.tactical
                                  .encounterContext === "settlement-watch"
                              ? "Watch interception"
                              : scenario?.diagnostics.tactical
                                    .encounterContext ===
                                  "settlement-state-patrol"
                                ? "State patrol"
                                : "None"
                  }
                />
                <FactRow
                  label="Blocked tiles"
                  value={scenario?.diagnostics.tactical.blockedTiles ?? "-"}
                />
                <FactRow
                  label="Cover tiles"
                  value={scenario?.diagnostics.tactical.coverTiles ?? "-"}
                />
              </div>
            </section>

            <section className="px-4 py-3">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-violet-300">
                Parity checks
              </h2>
              <div className="mt-2 space-y-3">
                {(scenario?.diagnostics.parity ?? []).map((check) => {
                  const visual = parityVisual[check.status];
                  const Icon = visual.Icon;
                  return (
                    <div
                      key={check.id}
                      className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2"
                    >
                      <Icon
                        size={15}
                        aria-hidden="true"
                        className={`mt-0.5 ${visual.className}`}
                      />
                      <div>
                        <div className="text-xs font-semibold text-slate-100">
                          {check.label}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-4 text-slate-500">
                          {check.detail}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        )}
      </div>
    </div>
  );
};

export default PreviewBattleMapScenarioLab;
