// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 12/08/2026, 21:43:05
 * Dependents: components/DesignPreview/DesignPreviewPage.tsx
 * Imports: 6 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink,
  Eye,
  Layers3,
  Map,
  Mountain,
  Route,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import AtlasMapView from '../../Worldforge/AtlasMapView';
import AtlasSvgView from '../../Worldforge/AtlasSvgView';
import type { AtlasOverlayMode } from '../../Worldforge/atlasDraw';
import { getBridgeAtlas } from '../../../systems/worldforge/bridge/legacySubmapBridge';
import type { FmgAtlasResult } from '../../../systems/worldforge/fmg/generateAtlas';
import { Button } from '../../ui/Button';

/**
 * This file provides Design Preview's side-by-side world-map comparison.
 *
 * Both panels receive the same deterministic atlas object. The left panel uses
 * the retired canvas renderer so its color and line work can still be judged;
 * the right panel uses the canonical SVG renderer used by World Generation and
 * live play. The canvas remains a review specimen only: this file does not
 * restore its retired route or give it any gameplay state authority.
 *
 * Called by: DesignPreviewPage.tsx at `?step=worldforge`.
 * Depends on: getBridgeAtlas for shared geography, AtlasMapView for the retired
 * reference, and AtlasSvgView for the maintained player-facing renderer.
 */

// ============================================================================
// Shared comparison controls
// ============================================================================
// One fixed initial seed makes screenshots repeatable. Reviewers may apply a
// different positive whole-number seed, and both panels always change together.
// ============================================================================

const DEFAULT_COMPARISON_SEED = 1337;

const REFERENCE_LENSES: Array<{ id: AtlasOverlayMode; label: string }> = [
  { id: 'political', label: 'States' },
  { id: 'culture', label: 'Cultures' },
  { id: 'religion', label: 'Religions' },
  { id: 'province', label: 'Provinces' },
];

/** Canonical SVG world-map deep link shared with the main-menu launcher. */
export const WORLD_MAP_PREVIEW_QUERY = 'worldmap=1';

/**
 * Build an application URL from the current origin. This keeps the comparison
 * useful on local Vite ports and deployed previews without hardcoding a host.
 */
const getAraliaBaseUrl = () => new URL('/Aralia/', window.location.origin).toString();

/** Open a real application surface in a new tab without granting it opener access. */
const openAppRoute = (query: string) => {
  const url = new URL(getAraliaBaseUrl());
  query.split('&').forEach((pair) => {
    const [key, value] = pair.split('=');
    if (key) url.searchParams.set(key, value ?? '');
  });
  window.open(url.toString(), '_blank', 'noopener,noreferrer');
};

// ============================================================================
// Responsive renderer measurement
// ============================================================================
// Both map components require exact pixel dimensions. Each panel measures only
// its own map well, so the two renderers remain equal-sized on desktop and fill
// the available width when the workbench stacks them on a narrow screen.
// ============================================================================

interface MeasuredPanel {
  ref: React.RefObject<HTMLDivElement | null>;
  width: number;
  height: number;
}

const useMeasuredPanel = (): MeasuredPanel => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 640, height: 420 });

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;

    // Ignore zero-sized transition frames and avoid re-rendering when the
    // browser reports the same rounded dimensions twice.
    const measure = () => {
      const width = Math.max(1, Math.floor(element.clientWidth));
      const height = Math.max(1, Math.floor(element.clientHeight));
      setSize((current) => (
        current.width === width && current.height === height
          ? current
          : { width, height }
      ));
    };

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
};

// ============================================================================
// Map specimens
// ============================================================================
// These wrappers give both renderers the same physical space. They deliberately
// do not synchronize pan and zoom: reviewers can inspect each renderer freely,
// while the seed and generated geography remain the controlled comparison.
// ============================================================================

interface MapSpecimenProps {
  atlas: FmgAtlasResult;
}

interface CanvasReferenceSpecimenProps extends MapSpecimenProps {
  lens: AtlasOverlayMode;
}

const CanvasReferenceSpecimen: React.FC<CanvasReferenceSpecimenProps> = ({ atlas, lens }) => {
  const { ref: panelRef, width, height } = useMeasuredPanel();

  return (
    <div
      ref={panelRef}
      data-testid="world-map-comparison-canvas-panel"
      className="h-[clamp(340px,52vh,620px)] min-w-0 overflow-hidden rounded-b-lg bg-slate-950"
    >
      <AtlasMapView
        key={`${atlas.seed}:${lens}`}
        atlas={atlas}
        width={width}
        height={height}
        overlayMode={lens}
        showPolitical
        showScaleBar
      />
    </div>
  );
};

const CanonicalSvgSpecimen: React.FC<MapSpecimenProps> = ({ atlas }) => {
  const { ref: panelRef, width, height } = useMeasuredPanel();

  return (
    <div
      ref={panelRef}
      data-testid="world-map-comparison-svg-panel"
      className="h-[clamp(340px,52vh,620px)] min-w-0 overflow-hidden rounded-b-lg bg-slate-950"
    >
      <AtlasSvgView
        key={atlas.seed}
        atlas={atlas}
        width={width}
        height={height}
        fitMode="contain"
        prefsScope={`design-preview-world-map-comparison:${atlas.seed}`}
      />
    </div>
  );
};

// ============================================================================
// Preserved Worldforge hierarchy summary
// ============================================================================
// The old launcher also explained what exists below the world map. Keep that
// useful orientation beneath the comparison instead of shrinking this page to
// a renderer beauty contest with no gameplay context.
// ============================================================================

const pipelineCards = [
  {
    title: 'Atlas',
    icon: Map,
    detail: 'The canonical SVG world level used by generation, selection, travel and live play.',
  },
  {
    title: 'Region',
    icon: Mountain,
    detail: 'Biome-blended terrain windows, clipped rivers, roads and marker handoff.',
  },
  {
    title: 'Local',
    icon: Route,
    detail: 'Five-foot local terrain cells with deterministic features and town placement.',
  },
  {
    title: 'Ground',
    icon: Sparkles,
    detail: 'Enterable 3D terrain and settlements reached from the maintained hierarchy.',
  },
];

// ============================================================================
// Preview surface
// ============================================================================
// The comparison leads with the rendered evidence, followed by compact context
// and links to the real player surfaces. Copy is explicit about which renderer
// is maintained so this developer tool cannot be mistaken for route revival.
// ============================================================================

export const PreviewWorldforge: React.FC = () => {
  const [seed, setSeed] = useState(DEFAULT_COMPARISON_SEED);
  const [seedInput, setSeedInput] = useState(String(DEFAULT_COMPARISON_SEED));
  const [seedError, setSeedError] = useState<string | null>(null);
  const [referenceLens, setReferenceLens] = useState<AtlasOverlayMode>('political');

  // Generate once per applied seed, then hand the exact same object to both
  // renderers. This prevents data drift from being mistaken for visual drift.
  const atlas = useMemo(() => getBridgeAtlas(seed), [seed]);
  const cellCount = atlas.pack.cells.h.length;
  const townCount = atlas.pack.burgs?.filter((burg) => burg && !burg.removed).length ?? 0;

  // Apply only valid positive whole-number seeds. Invalid drafts stay visible
  // so the reviewer can correct them without either map changing underneath.
  const applySeed = (event: React.FormEvent) => {
    event.preventDefault();
    const nextSeed = Number(seedInput);
    if (!Number.isSafeInteger(nextSeed) || nextSeed <= 0) {
      setSeedError('Enter a whole number greater than 0.');
      return;
    }
    setSeedError(null);
    setSeed(nextSeed);
  };

  // Expose concise comparison state for local browser proof without replacing
  // any game-wide render_game_to_text hook owned by another preview surface.
  useEffect(() => {
    const host = window as unknown as Record<string, unknown>;
    host.__worldMapComparison = {
      seed,
      atlasSeed: atlas.seed,
      referenceRenderer: 'canvas',
      canonicalRenderer: 'svg',
      referenceLens,
      cellCount,
      townCount,
    };
    return () => { delete host.__worldMapComparison; };
  }, [atlas.seed, cellCount, referenceLens, seed, townCount]);

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-slate-100 scrollable-content">
      <div className="mx-auto flex min-h-full w-full max-w-[1800px] flex-col gap-5 p-4 sm:p-5">
        <header className="rounded-lg border border-slate-700 bg-slate-900/95 p-4 shadow-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-sky-200">
                  <Eye size={14} aria-hidden="true" /> Design review only
                </span>
                <span className="rounded-full border border-slate-600 bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                  Same generated atlas
                </span>
              </div>
              <h2 className="font-cinzel text-2xl font-bold text-amber-300 sm:text-3xl">
                World map renderer comparison
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
                Compare the retired canvas artwork with the maintained SVG map using exactly the same world seed and geography. Pan and zoom either side independently. Only the SVG map is used by players.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => openAppRoute(WORLD_MAP_PREVIEW_QUERY)}
                className="min-h-11 rounded-md text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  Open canonical runtime <ExternalLink size={16} aria-hidden="true" />
                </span>
              </Button>
              <Button
                type="button"
                variant="success"
                size="md"
                onClick={() => openAppRoute('phase=playing&wf_ground=1&wf_town=1&wf_seed=42')}
                className="min-h-11 rounded-md text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  Open Ground <ExternalLink size={16} aria-hidden="true" />
                </span>
              </Button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-slate-700 pt-4 lg:flex-row lg:items-end lg:justify-between">
            {/* Keep validation in one explicit path so the preview shows the same
                GOV.UK-style error copy in browsers and in focused tests. */}
            <form noValidate onSubmit={applySeed} className="flex flex-wrap items-end gap-2">
              <label htmlFor="world-map-comparison-seed" className="grid gap-1 text-xs font-semibold text-slate-300">
                World seed
                <input
                  id="world-map-comparison-seed"
                  type="number"
                  min="1"
                  step="1"
                  value={seedInput}
                  onChange={(event) => setSeedInput(event.target.value)}
                  aria-invalid={seedError ? 'true' : 'false'}
                  aria-describedby={seedError ? 'world-map-comparison-seed-error' : undefined}
                  className="h-11 w-36 rounded-md border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/30"
                />
              </label>
              <Button
                type="submit"
                variant="action"
                size="md"
                className="min-h-11 rounded-md text-sm"
              >
                Apply to both maps
              </Button>
              <div id="world-map-comparison-seed-error" aria-live="polite" className="self-center text-xs font-semibold text-rose-300">
                {seedError}
              </div>
            </form>

            <div className="flex flex-wrap items-end gap-3">
              <label htmlFor="world-map-reference-lens" className="grid gap-1 text-xs font-semibold text-slate-300">
                Reference color lens
                <select
                  id="world-map-reference-lens"
                  value={referenceLens}
                  onChange={(event) => setReferenceLens(event.target.value as AtlasOverlayMode)}
                  className="h-11 rounded-md border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30"
                >
                  {REFERENCE_LENSES.map((lens) => (
                    <option key={lens.id} value={lens.id}>{lens.label}</option>
                  ))}
                </select>
              </label>
              <div className="rounded-md border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs text-slate-300">
                <span className="font-semibold text-white">Seed {seed}</span>
                <span className="mx-2 text-slate-600">|</span>
                {cellCount.toLocaleString()} cells
                <span className="mx-2 text-slate-600">|</span>
                {townCount.toLocaleString()} towns
              </div>
            </div>
          </div>
        </header>

        <section
          data-testid="world-map-renderer-comparison"
          data-world-seed={seed}
          className="grid min-w-0 gap-4 lg:grid-cols-2"
          aria-label="Side-by-side world map renderer comparison"
        >
          <article
            data-testid="retired-world-map-panel"
            className="min-w-0 overflow-hidden rounded-lg border border-amber-500/45 bg-slate-900 shadow-xl"
          >
            <div className="flex min-h-[112px] flex-col justify-between gap-2 border-b border-amber-500/30 bg-amber-950/20 p-4 sm:flex-row sm:items-start">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300">Retired reference</div>
                <h3 className="mt-1 font-cinzel text-xl font-bold text-amber-100">Canvas renderer</h3>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-300">
                  Kept here to inspect ocean depth, coast ink, terrain shading and political color. It has no player route and owns no geography.
                </p>
              </div>
              <span className="w-fit rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-200">Reference only</span>
            </div>
            <CanvasReferenceSpecimen atlas={atlas} lens={referenceLens} />
          </article>

          <article
            data-testid="canonical-world-map-panel"
            className="min-w-0 overflow-hidden rounded-lg border border-emerald-500/45 bg-slate-900 shadow-xl"
          >
            <div className="flex min-h-[112px] flex-col justify-between gap-2 border-b border-emerald-500/30 bg-emerald-950/20 p-4 sm:flex-row sm:items-start">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">Maintained system</div>
                <h3 className="mt-1 font-cinzel text-xl font-bold text-emerald-100">Canonical SVG renderer</h3>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-300">
                  Used by start selection, World Generation and the live MapPane. Use its Layers menu to compare equivalent coloring modes.
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-200">
                <ShieldCheck size={14} aria-hidden="true" /> Canonical
              </span>
            </div>
            <CanonicalSvgSpecimen atlas={atlas} />
          </article>
        </section>

        <section className="rounded-lg border border-slate-700 bg-slate-900/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Layers3 size={18} className="text-sky-300" aria-hidden="true" />
            <h3 className="font-cinzel text-lg font-bold text-slate-100">What stays shared beyond the comparison</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {pipelineCards.map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.title} className="rounded-md border border-slate-700 bg-slate-950/70 p-3">
                  <div className="mb-2 flex items-center gap-2 text-amber-200">
                    <Icon size={17} aria-hidden="true" />
                    <h4 className="font-cinzel font-bold">{card.title}</h4>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">{card.detail}</p>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
