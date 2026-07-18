// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 15/07/2026, 01:31:42
 * Dependents: building-identity-lab.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  CheckCircle2,
  CircleAlert,
  Dices,
  Layers3,
  Map,
  RefreshCw,
} from 'lucide-react';
import TownPlanView from '@/components/Worldforge/TownPlanView';
import { renderBlueprintSvg } from '@/systems/worldforge/interior/renderBlueprintSvg';
import type { ClimateClass } from '@/systems/worldforge/town/architectureStyle';
import PreviewBuilding3D from '@/components/DesignPreview/steps/PreviewBuilding3D';
import {
  blueprintForHarnessPlot,
  buildHarnessTown,
  HARNESS_CLIMATES,
  HARNESS_STYLES,
  HARNESS_TOWNS,
  type BuildingFactField,
  type HarnessPlot,
  type HarnessStyleId,
} from './buildingIdentityLabModel';
import './buildingIdentityLab.css';

/**
 * This page is the visual debugging workbench for procedural building identity.
 * It lets reviewers reroll a production town, inspect district coherence, compare
 * sibling buildings, and view one exact blueprint in both 2D and 3D. All generation
 * remains in Worldforge; this component only presents its evidence and controls.
 */

// ============================================================================
// URL and Formatting Helpers
// ============================================================================
// The seed is shareable in the URL so a visual defect can be reopened exactly.
// ============================================================================

/** Restore a shared defect seed, or open on the canonical architecture proof seed. */
function initialSeed(): number {
  const value = Number(new URLSearchParams(window.location.search).get('seed'));
  return Number.isFinite(value) && value !== 0 ? Math.abs(value | 0) : 792767481;
}

/** Accept only population bands the workbench can represent in its selector. */
function initialPopulation(): number {
  const value = Number(new URLSearchParams(window.location.search).get('population'));
  return HARNESS_TOWNS.some((town) => town.population === value) ? value : 3200;
}

/** Restore a known architecture family without allowing arbitrary URL values. */
function initialStyle(): HarnessStyleId {
  const value = new URLSearchParams(window.location.search).get('style');
  return HARNESS_STYLES.some((style) => style.id === value)
    ? value as HarnessStyleId
    : 'temperateFrame';
}

/** Restore one of the production climate classes that affect construction details. */
function initialClimate(): ClimateClass {
  const value = new URLSearchParams(window.location.search).get('climate');
  return HARNESS_CLIMATES.includes(value as ClimateClass)
    ? value as ClimateClass
    : 'temperate';
}

/** Waterfront generation stays on unless a shared URL explicitly disables it. */
function initialRiver(): boolean {
  return new URLSearchParams(window.location.search).get('river') !== 'off';
}

/** Advance through a deterministic seed sequence so rerolls are reproducible. */
function nextSeed(seed: number): number {
  return Math.abs((Math.imul(seed, 1103515245) + 12345) | 0) || 137;
}

/** Keep long signatures scannable while retaining both identifying ends. */
function shortReceipt(value: string | undefined): string {
  if (!value) return 'none';
  return value.length > 24 ? `${value.slice(0, 11)}...${value.slice(-8)}` : value;
}

/** Prefer the population-authored building type over the adapter's broad role. */
function plotLabel(plot: HarnessPlot): string {
  return plot.pop?.buildingType ?? plot.role;
}

/** Draw a custom SVG silhouette representing the building's roof form, massing, and storeys. */
const BuildingSilhouette: React.FC<{ plot: HarnessPlot }> = ({ plot }) => {
  const roofForm = plot.roofForm ?? 'gable';
  const storeys = plot.storeys ?? 1;
  const wallColor = plot.wallColorHex ?? '#8a7663';
  const roofColor = plot.roofColorHex ?? '#5f4527';

  // Determine roof height based on form
  let roofHeight = 7;
  if (roofForm === 'steep') roofHeight = 11;
  else if (roofForm === 'flat') roofHeight = 2;

  // Wall height scales with storey count
  let wallHeight = 8;
  if (storeys === 2) wallHeight = 12;
  else if (storeys >= 3) wallHeight = 16;

  // Baseline of the SVG frame is at y = 28
  const baselineY = 28;
  const wallY = baselineY - wallHeight;
  const roofY = wallY - roofHeight;

  // Build the SVG path for the selected roof shape
  let roofPath = '';
  if (roofForm === 'flat') {
    roofPath = `M 2,${wallY - 2} L 40,${wallY - 2} L 40,${wallY} L 2,${wallY} Z`;
  } else if (roofForm === 'hip') {
    roofPath = `M 4,${wallY} L 12,${roofY} L 30,${roofY} L 38,${wallY} Z`;
  } else if (roofForm === 'steep' || roofForm === 'gable') {
    roofPath = `M 4,${wallY} L 21,${roofY} L 38,${wallY} Z`;
  }

  return (
    <svg width="42" height="28" viewBox="0 0 42 28" className="bil-mini-building-svg" aria-hidden="true">
      {/* Wall Rect */}
      <rect
        x="6"
        y={wallY}
        width="30"
        height={wallHeight}
        fill={wallColor}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.5"
      />
      {/* Windows to display massing/storeys visually */}
      {storeys >= 2 && (
        <rect x="10" y={wallY + 2} width="4" height="4" fill="rgba(255,255,255,0.3)" />
      )}
      {storeys >= 2 && (
        <rect x="28" y={wallY + 2} width="4" height="4" fill="rgba(255,255,255,0.3)" />
      )}
      {storeys >= 3 && (
        <rect x="10" y={wallY + 7} width="4" height="4" fill="rgba(255,255,255,0.3)" />
      )}
      {storeys >= 3 && (
        <rect x="28" y={wallY + 7} width="4" height="4" fill="rgba(255,255,255,0.3)" />
      )}
      {/* Roof Path */}
      <path d={roofPath} fill={roofColor} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
    </svg>
  );
};

// ============================================================================
// Measured Town Map
// ============================================================================
// TownPlanView receives explicit pixel dimensions, so this wrapper tracks its
// available pane instead of imposing the old preview's fixed maximum size.
// ============================================================================

const MeasuredTownMap: React.FC<{
  model: ReturnType<typeof buildHarnessTown>;
  selectedPlotId: number;
  onSelectPlot: (plotId: number) => void;
}> = ({ model, selectedPlotId, onSelectPlot }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: 430 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const measure = () => {
      const width = Math.max(240, host.clientWidth);
      const height = Math.max(240, host.clientHeight);
      setSize((current) => current.width === width && current.height === height
        ? current
        : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={hostRef} className="bil-map-host" data-testid="identity-town-map">
      <TownPlanView
        plan={model.enginePlan}
        width={size.width}
        height={size.height}
        seedPath={`wf:${model.seed}`}
        settlementKey={`burg:${model.seed}`}
        styleFamily={model.styleFamily}
        selectedPlotId={selectedPlotId}
        onSelectPlot={onSelectPlot}
        artifactPlan={model.artifactPlan}
      />
    </div>
  );
};

// ============================================================================
// Main Workbench
// ============================================================================

const BuildingIdentityLab: React.FC = () => {
  const [seed, setSeed] = useState(initialSeed);
  const [population, setPopulation] = useState(initialPopulation);
  const [styleId, setStyleId] = useState<HarnessStyleId>(initialStyle);
  const [climate, setClimate] = useState<ClimateClass>(initialClimate);
  const [withRiver, setWithRiver] = useState(initialRiver);
  const [generationRevision, setGenerationRevision] = useState(0);
  const [selectedPlotId, setSelectedPlotId] = useState(0);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [floorLevel, setFloorLevel] = useState(0);

  // Active generation inputs that actually drive the rendered model.
  // This separation lets us show a busy state before starting the heavy generation.
  const [activeOptions, setActiveOptions] = useState({
    seed: initialSeed(),
    population: initialPopulation(),
    styleId: initialStyle(),
    climate: initialClimate(),
    withRiver: initialRiver(),
    generationRevision: 0,
  });

  const [isGenerating, setIsGenerating] = useState(false);

  // Yield to the browser paint cycle to display a loading/busy overlay
  useEffect(() => {
    setIsGenerating(true);
    const timer = setTimeout(() => {
      setActiveOptions({
        seed,
        population,
        styleId,
        climate,
        withRiver,
        generationRevision,
      });
      setIsGenerating(false);
    }, 40);
    return () => clearTimeout(timer);
  }, [seed, population, styleId, climate, withRiver, generationRevision]);

  // Every visible surface below shares this one deterministic production model.
  const model = useMemo(() => buildHarnessTown({
    seed: activeOptions.seed,
    population: activeOptions.population,
    styleId: activeOptions.styleId,
    climate: activeOptions.climate,
    withRiver: activeOptions.withRiver,
  }), [activeOptions]);

  const selectedPlot = model.artifactPlan.plots.find((plot) => plot.id === selectedPlotId)
    ?? model.artifactPlan.plots[0];
  const blueprint = useMemo(
    () => blueprintForHarnessPlot(model, selectedPlot?.id ?? 0),
    [model, selectedPlot?.id],
  );

  // Keep selection valid after a seed or population change replaces all receipts.
  useEffect(() => {
    if (!selectedPlot) return;
    setSelectedPlotId(selectedPlot.id);
    setSelectedDistrict(selectedPlot.architecture?.districtKey ?? null);
    setFloorLevel((level) => blueprint.floors.some((floor) => floor.level === level) ? level : 0);
  }, [blueprint, selectedPlot]);

  // Store the active configuration in the address bar for reproducible bug links.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('seed', String(seed));
    url.searchParams.set('style', styleId);
    url.searchParams.set('climate', climate);
    url.searchParams.set('population', String(population));
    url.searchParams.set('river', withRiver ? 'on' : 'off');
    window.history.replaceState(null, '', url);
  }, [seed, styleId, climate, population, withRiver]);

  const blueprintSvg = useMemo(
    () => renderBlueprintSvg(blueprint, floorLevel, {
      seed,
      roof: floorLevel === Math.max(...blueprint.floors.map((floor) => floor.level))
        ? blueprint.roof
        : undefined,
    }),
    [blueprint, floorLevel, seed],
  );
  const style = blueprint.styleResolved;
  const selectedDistrictKey = selectedDistrict ?? selectedPlot?.architecture?.districtKey;
  const comparisonPlots = model.artifactPlan.plots
    .filter((plot) => plot.architecture?.districtKey === selectedDistrictKey);
  const coherentDistricts = model.districts.filter((district) => district.coherent).length;
  const uniqueVariants = new Set(model.artifactPlan.plots
    .map((plot) => plot.architecture?.buildingVariant)
    .filter(Boolean)).size;

  // Expose a concise receipt to browser automation and manual console debugging.
  useEffect(() => {
    window.__buildingIdentityLab = {
      seed,
      buildings: model.artifactPlan.plots.length,
      districts: model.districts.length,
      coherentDistricts,
      uniqueVariants,
      selectedPlotId: selectedPlot?.id ?? null,
      selectedDistrictKey,
      styleFamily: style?.familyId ?? null,
    };
  }, [coherentDistricts, model, seed, selectedDistrictKey, selectedPlot, style, uniqueVariants]);

  return (
    <main className="bil-shell">
      {isGenerating && (
        <div className="bil-busy-overlay" data-testid="bil-busy-indicator">
          <RefreshCw size={24} className="bil-spinner" />
          <span>Regenerating Settlement...</span>
        </div>
      )}
      <header className="bil-header">
        <div className="bil-brand">
          <div className="bil-mark" aria-hidden="true"><Layers3 size={19} /></div>
          <div>
            <h1>Building Identity Lab</h1>
            <p>District coherence / individual variation / production receipts</p>
          </div>
        </div>
        <div className="bil-header-actions">
          <span className="bil-status"><span /> deterministic</span>
          <button type="button" className="bil-icon-button" title="Reroll town seed" aria-label="Reroll town seed" onClick={() => setSeed(nextSeed)}>
            <Dices size={18} />
          </button>
          <button type="button" className="bil-icon-button" title="Regenerate current seed" aria-label="Regenerate current seed" onClick={() => setGenerationRevision((revision) => revision + 1)}>
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      <section className="bil-controls" aria-label="Generation controls">
        <label htmlFor="bil-control-seed">
          <span>Seed</span>
          <input id="bil-control-seed" name="seed" type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 1)} />
        </label>
        <label htmlFor="bil-control-settlement">
          <span>Settlement</span>
          <select id="bil-control-settlement" name="settlement" value={population} onChange={(event) => setPopulation(Number(event.target.value))}>
            {HARNESS_TOWNS.map((town) => <option key={town.population} value={town.population}>{town.label}</option>)}
          </select>
        </label>
        <label htmlFor="bil-control-architecture">
          <span>Architecture</span>
          <select id="bil-control-architecture" name="architecture" value={styleId} onChange={(event) => setStyleId(event.target.value as HarnessStyleId)}>
            {HARNESS_STYLES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label htmlFor="bil-control-climate">
          <span>Climate</span>
          <select id="bil-control-climate" name="climate" value={climate} onChange={(event) => setClimate(event.target.value as ClimateClass)}>
            {HARNESS_CLIMATES.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="bil-toggle" htmlFor="bil-control-waterfront">
          <input id="bil-control-waterfront" name="waterfront" type="checkbox" checked={withRiver} onChange={() => setWithRiver((current) => !current)} />
          <span aria-hidden="true" />
          Waterfront anatomy
        </label>
      </section>

      <section className="bil-metrics" aria-label="Town audit summary">
        <div><strong>{model.artifactPlan.plots.length}</strong><span>buildings</span></div>
        <div><strong>{model.districts.length}</strong><span>districts</span></div>
        <div><strong>{uniqueVariants}</strong><span>unique variants</span></div>
        <div><strong>{Object.keys(model.ensembleCounts).length}</strong><span>ensemble forms</span></div>
        <div className={coherentDistricts === model.districts.length ? 'is-pass' : 'is-fail'}>
          {coherentDistricts === model.districts.length ? <CheckCircle2 size={18} /> : <CircleAlert size={18} />}
          <strong>{coherentDistricts}/{model.districts.length}</strong><span>coherent districts</span>
        </div>
      </section>

      <section className="bil-workspace">
        <aside className="bil-panel bil-districts">
          <div className="bil-panel-title"><Map size={15} /><h2>District ledger</h2></div>
          <div className="bil-panel-scroll">
            {model.districts.map((district) => (
              <button
                type="button"
                key={district.key}
                className={`bil-district-row ${district.key === selectedDistrictKey ? 'is-active' : ''}`}
                onClick={() => {
                  setSelectedDistrict(district.key);
                  const first = model.artifactPlan.plots.find((plot) => plot.architecture?.districtKey === district.key);
                  if (first) setSelectedPlotId(first.id);
                }}
              >
                <span className="bil-row-top">
                  <b>{district.label}</b>
                  <em>{district.buildings}</em>
                </span>
                <span className="bil-row-meta">{district.wealth} / {district.variants} variants</span>
                <span className="bil-swatches">
                  {district.wallColors.slice(0, 4).map((color) => <i key={color} style={{ background: color }} title={`Wall ${color}`} />)}
                  <span />
                  {district.roofColors.slice(0, 3).map((color) => <i key={color} style={{ background: color }} title={`Roof ${color}`} />)}
                </span>
                <span className="bil-row-meta">{district.ensembleKinds.join(' / ')}</span>
              </button>
            ))}
          </div>
          <div className="bil-ensemble-summary">
            <h3>Town composition</h3>
            {Object.entries(model.ensembleCounts).sort((left, right) => right[1] - left[1]).map(([kind, count]) => (
              <div key={kind}><span>{kind}</span><b>{count}</b></div>
            ))}
          </div>
        </aside>

        <section className="bil-stage">
          <div className="bil-stage-grid">
            <article className="bil-viewport-card">
              <div className="bil-card-bar"><span><Map size={14} /> Town plan</span><small>same seed / same districts</small></div>
              <MeasuredTownMap model={model} selectedPlotId={selectedPlot?.id ?? 0} onSelectPlot={setSelectedPlotId} />
            </article>
            <article className="bil-viewport-card">
              <div className="bil-card-bar"><span><Box size={14} /> Selected building</span><small>orbit / exact blueprint</small></div>
              <div className="bil-3d-host">
                <Suspense fallback={<div className="bil-loading">Loading production 3D...</div>}>
                  <PreviewBuilding3D plan={blueprint} upToLevel="all" hour={12} />
                </Suspense>
              </div>
            </article>
          </div>

          <article className="bil-comparison">
            <div className="bil-card-bar"><span><Layers3 size={14} /> District comparison</span><small>shared grammar, bounded exceptions</small></div>
            <div className="bil-specimens">
              {comparisonPlots.map((plot) => (
                <button
                  type="button"
                  key={plot.id}
                  className={`bil-specimen ${plot.id === selectedPlot?.id ? 'is-active' : ''}`}
                  onClick={() => setSelectedPlotId(plot.id)}
                >
                  <span className="bil-mini-building">
                    <BuildingSilhouette plot={plot} />
                  </span>
                  <b>#{plot.id} {plotLabel(plot)}</b>
                  <span>{plot.roofForm} / {plot.architecture?.facadePattern}</span>
                  <span>{plot.ensemble?.kind ?? 'standalone'} / {plot.storeys}F</span>
                  <code>{shortReceipt(plot.architecture?.buildingVariant)}</code>
                </button>
              ))}
            </div>
          </article>
        </section>

        <aside className="bil-panel bil-inspector">
          <div className="bil-panel-title"><Layers3 size={15} /><h2>Building receipt</h2><span>#{selectedPlot?.id}</span></div>
          <div className="bil-blueprint-toolbar">
            <span>{plotLabel(selectedPlot)}</span>
            {/* GG-38 control-naming repair (2026-07-18): this floor selector was
                the last form field in the lab without an id/name attribute —
                Chrome's issues audit flags such fields ("A form field element
                should have an id or name attribute") because unnamed fields
                defeat autofill/label association tooling. The five generation
                controls above were already named (bil-control-*); this select
                joins the same scheme. aria-label kept — it remains the
                accessible name; nothing visual changes. */}
            <select id="bil-control-floor" name="blueprintFloor" value={floorLevel} onChange={(event) => setFloorLevel(Number(event.target.value))} aria-label="Blueprint floor">
              {blueprint.floors.map((floor) => (
                <option key={floor.level} value={floor.level}>{floor.level < 0 ? 'Basement' : floor.level === 0 ? 'Ground' : `Floor ${floor.level}`}</option>
              ))}
            </select>
          </div>
          <div className="bil-blueprint" dangerouslySetInnerHTML={{ __html: blueprintSvg }} />

          <dl className="bil-receipt-grid">
            <div><dt>District</dt><dd>{selectedPlot?.architecture?.districtLabel}</dd></div>
            <div><dt>Family</dt><dd>{style?.familyId}</dd></div>
            <div><dt>Envelope</dt><dd>{blueprint.widthFt} x {blueprint.depthFt} ft</dd></div>
            <div><dt>Roof</dt><dd>{style?.roofForm} / {style?.pitchRiseFt.toFixed(1)} ft</dd></div>
            <div><dt>Facade</dt><dd>{style?.facadePattern}</dd></div>
            <div><dt>Walls</dt><dd>{style?.construction.wallMaterial}</dd></div>
            <div><dt>Covering</dt><dd>{style?.construction.roofCovering}</dd></div>
            <div><dt>Foundation</dt><dd>{style?.construction.foundation}</dd></div>
            <div><dt>Age / wear</dt><dd>{style?.weathering?.ageBand} / {style?.weathering?.wallPatina}</dd></div>
            <div><dt>Motifs</dt><dd>{style?.motifs.join(', ') || 'none'}</dd></div>
            <div><dt>Ensemble</dt><dd>{selectedPlot?.ensemble?.kind ?? 'standalone'}</dd></div>
            <div><dt>Lot / parcel</dt><dd>{selectedPlot?.ensemble?.lotProfile ?? selectedPlot?.ensemble?.parcelProfile ?? 'legacy'}</dd></div>
          </dl>

          <div className="bil-receipts">
            <div><span>district signature</span><code>{shortReceipt(style?.districtSignature)}</code></div>
            <div><span>building variant</span><code>{shortReceipt(style?.buildingVariant)}</code></div>
            <div><span>construction</span><code>{shortReceipt(style?.construction.constructionSignature)}</code></div>
            <div><span>ensemble</span><code>{shortReceipt(selectedPlot?.ensemble?.ensembleSignature)}</code></div>
          </div>
        </aside>
      </section>
    </main>
  );
};

declare global {
  interface Window {
    __buildingIdentityLab?: Record<string, unknown>;
  }
}

export def