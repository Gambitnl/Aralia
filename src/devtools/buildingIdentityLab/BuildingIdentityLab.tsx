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

// ============================================================================
// Measured Town Map
// ============================================================================
// TownPlanView receives explicit pixel dimensions, so this wrapper tracks its
// available pane instead of imposing the old preview's fixed maximum size.
// ============================================================================

const MeasuredTownMap: React.FC<{
  model: ReturnType<typeof buildHarnessTown>;
}> = ({ model }) => {
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

  // Every visible surface below shares this one deterministic production model.
  // The revision supports a manual same-seed rebuild, useful when verifying
  // determinism or after hot-module replacement changes a generator module.
  const model = useMemo(() => buildHarnessTown({
    seed,
    population,
    styleId,
    climate,
    withRiver,
  }), [seed, population, styleId, climate, withRiver, generationRevision]);

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
    .filter((plot) => plot.architecture?.districtKey === selectedDistrictKey)
    .slice(0, 8);
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
          <button type="button" className="bil-icon-button" title="Reroll town seed" onClick={() => setSeed(nextSeed)}>
            <Dices size={18} />
          </button>
          <button type="button" className="bil-icon-button" title="Regenerate current seed" onClick={() => setGenerationRevision((revision) => revision + 1)}>
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      <section className="bil-controls" aria-label="Generation controls">
        <label>
          <span>Seed</span>
          <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 1)} />
        </label>
        <label>
          <span>Settlement</span>
          <select value={population} onChange={(event) => setPopulation(Number(event.target.value))}>
            {HARNESS_TOWNS.map((town) => <option key={town.population} value={town.population}>{town.label}</option>)}
          </select>
        </label>
        <label>
          <span>Architecture</span>
          <select value={styleId} onChange={(event) => setStyleId(event.target.value as HarnessStyleId)}>
            {HARNESS_STYLES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label>
          <span>Climate</span>
          <select value={climate} onChange={(event) => setClimate(event.target.value as ClimateClass)}>
            {HARNESS_CLIMATES.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <label className="bil-toggle">
          <input type="checkbox" checked={withRiver} onChange={() => setWithRiver((current) => !current)} />
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
              <MeasuredTownMap model={model} />
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
                    <i style={{ background: plot.wallColorHex }} />
                    <i style={{ background: plot.roofColorHex }} />
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
            <select value={floorLevel} onChange={(event) => setFloorLevel(Number(event.target.value))} aria-label="Blueprint floor">
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

export default BuildingIdentityLab;
