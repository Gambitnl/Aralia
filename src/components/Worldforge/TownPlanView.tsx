// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 14/07/2026, 20:48:40
 * Dependents: components/DesignPreview/steps/PreviewTown3D.tsx, components/DesignPreview/steps/PreviewTowns.tsx, components/MapPane.tsx
 * Imports: 15 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { polygonBounds, pointInPolygon, type Pt } from '../../systems/worldforge/submap/submapEngine';
import type { TownPlan, CivicKind, BuildingPlot } from '../../systems/worldforge/town/townEngine';
import { generateHousehold } from '../../systems/worldforge/town/household';
import { BUILDING_FILL, BUILDING_LABEL } from '../../systems/worldforge/town/buildingStyle';
import {
  resolveArchitectureVariant,
  type ArchitectureVariant,
  type ClimateClass,
  type StyleFamily,
} from '../../systems/worldforge/town/architectureStyle';
import {
  resolveBuildingMotifs,
  type BuildingMotifResolution,
} from '../../systems/worldforge/town/buildingMotifs';
import { fnv1a, type SeedPath } from '../../systems/worldforge/seedPath';
import { buildingTypeForRole } from '../../systems/worldforge/interior/generateInterior';
import { roleForPlot } from '../../systems/worldforge/town/townPlanAdapter';
import { resolveBuildingAgeBand } from '../../systems/worldforge/town/buildingAge';
import { resolveBuildingWeathering } from '../../systems/worldforge/town/buildingWeathering';
import type {
  CourtyardAmenity,
  TownCourtyardSpace,
} from '../../systems/worldforge/town/courtyardSpaces';
import type {
  BuildingConstruction,
  BuildingAgeBand,
  BuildingEnsemble,
  BuildingWeathering,
  BuildingMotif,
  FacadePattern,
  WallPatina,
} from '../../systems/worldforge/interior/blueprintTypes';
import { useTownLayers, TOWN_LAYER_DEFS } from './useDrillLayers';
import DrillLayerPanel from './DrillLayerPanel';

export interface TownPlanViewProps {
  plan: TownPlan;
  width?: number;
  height?: number;
  /** Town seed-path — enables naming the household living in a hovered home. */
  seedPath?: SeedPath;
  /** Per-save scope for the town layer toggles (pass the world seed). */
  prefsScope?: string | number;
  /**
   * Regional architecture family from the burg's FMG culture type. When set,
   * building fills, facade patterns, roof outlines, and role-motif evidence use
   * the same layered resolver as the production 3D building bridge.
   */
  styleFamily?: StyleFamily;
  /** Exact production settlement key (`burg:<id>`) for 2D/3D style parity. */
  settlementKey?: string;
  /** Atlas climate used by the same patina resolver as generated 3D buildings. */
  climate?: ClimateClass;
}

const CIVIC_COLOR: Record<CivicKind, string> = {
  plaza: '#c9b88a', temple: '#8a9bc4', keep: '#7a4b4b', citadel: '#5a2f2f', dock: '#3f6f8f', bridge: '#caa86a',
};

const CIVIC_LABEL: Record<CivicKind, string> = {
  plaza: 'Market Plaza', temple: 'Temple', keep: 'Keep', citadel: 'Citadel', dock: 'Docks', bridge: 'Bridge',
};

// Outskirts land-use fills: farmland (tilled, furrow-hatched) hugs the town,
// pasture (grassland) beyond, scrub/barren at the rim.
const OUTSKIRT_FILL: Record<'farm' | 'pasture' | 'scrub', string> = {
  farm: 'url(#town-farm)', pasture: '#7c9a57', scrub: '#9b9576',
};

const poly = (pts: Pt[]): string => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
const open = (pts: Pt[]): string => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L');

const centroidOf = (pts: Pt[]): Pt => {
  let x = 0, y = 0;
  for (const [px, py] of pts) { x += px; y += py; }
  return [x / pts.length, y / pts.length];
};

/** Shoelace area (absolute) of a polygon in its own coordinate frame. */
const areaOf = (pts: Pt[]): number => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

/** Stable hash of a point (rounded) — deterministic building flavour across renders. */
const hashPt = (x: number, y: number): number => {
  let h = 2166136261 >>> 0;
  const s = `${Math.round(x)},${Math.round(y)}`;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
};

// Architectural building types by position — town-map categories, not wired to
// specific NPCs/businesses. Central street-fronts read as commercial/civic,
// outer fronts residential, ward interiors as utility/outbuildings.
// (Fallback only — used when a plan carries no population/buildingType data.)
const TYPES_CENTRAL = ['Inn', 'Tavern', 'Trade Hall', 'Merchant Shop', 'Guild House', 'Townhouse'];
const TYPES_OUTER = ['Townhouse', 'Cottage', 'Workshop', 'Smithy', 'Bakehouse', 'Longhouse'];
const TYPES_INTERIOR = ['Cottage', 'Storehouse', 'Stable', 'Workshop', 'Granary'];

// Building-type colours + labels live in the shared `buildingStyle` module so the
// 2D map and the 3D town agree (see BUILDING_FILL / BUILDING_LABEL imports).

// Ward social-class label for the inspector.
const DISTRICT_LABEL: Record<'wealthy' | 'common' | 'poor', string> = {
  wealthy: 'Wealthy quarter', common: 'Common ward', poor: 'Poor district',
};

/** Plain-language construction age shown as a factual inspector field. */
const BUILDING_AGE_LABEL: Readonly<Record<BuildingAgeBand, string>> = {
  new: 'New construction',
  aged: 'Established building',
  old: 'Old building',
  ancient: 'Ancient core building',
};

/** Older outlines gain a subtle broken rhythm without replacing roof color. */
const BUILDING_AGE_DASH: Readonly<Partial<Record<BuildingAgeBand, string>>> = {
  old: '4 1.5',
  ancient: '2 1',
};

/** Plain-language names for district exposure shown by the inspector. */
const WALL_PATINA_LABEL: Readonly<Record<WallPatina, string>> = {
  none: 'clean finish',
  'rain-streaks': 'rain streaks',
  'salt-bloom': 'salt bloom',
  lichen: 'lichen growth',
  'dust-veil': 'windblown dust',
  'soot-wash': 'soot wash',
};

/** Map-scale tint for the patina overlay inside a construction pattern. */
const WALL_PATINA_COLOR: Readonly<Record<WallPatina, string>> = {
  none: 'transparent',
  'rain-streaks': '#59615b',
  'salt-bloom': '#d0d0c3',
  lichen: '#66784e',
  'dust-veil': '#a8875e',
  'soot-wash': '#45433f',
};

const FACADE_LABEL: Record<FacadePattern, string> = {
  plain: 'Plain',
  'belt-course': 'Belt-course',
  'vertical-bays': 'Vertical-bay',
  'half-timber': 'Half-timber',
  'log-bands': 'Log-band',
};

/** Plain-language material names shared by populated and fallback inspectors. */
const WALL_MATERIAL_LABEL: Record<BuildingConstruction['wallMaterial'], string> = {
  'rubble-stone': 'Rubble stone',
  'dressed-stone': 'Dressed stone',
  'limewashed-stone': 'Limewashed stone',
  weatherboard: 'Weatherboard',
  'tarred-board': 'Tarred boards',
  'timber-plaster': 'Timber and plaster',
  'brick-infill': 'Brick infill',
  'round-log': 'Round logs',
  'hewn-log': 'Hewn logs',
  'wattle-daub': 'Wattle and daub',
};

const ROOF_COVERING_LABEL: Record<BuildingConstruction['roofCovering'], string> = {
  slate: 'slate',
  'stone-slab': 'stone slabs',
  'wood-shingle': 'wood shingles',
  'reed-thatch': 'reed thatch',
  'clay-tile': 'clay tiles',
  sod: 'sod',
};

const FOUNDATION_LABEL: Record<BuildingConstruction['foundation'], string> = {
  fieldstone: 'fieldstone base',
  'battered-stone': 'battered stone base',
  'brick-plinth': 'brick plinth',
  'stone-piers': 'stone piers',
  'timber-piles': 'timber piles',
};

const GLAZING_LABEL: Record<BuildingConstruction['glazing'], string> = {
  'open-lattice': 'open lattice windows',
  'oiled-lattice': 'oiled lattice windows',
  'leaded-casement': 'leaded casements',
  'clear-casement': 'clear casements',
};

const SHUTTER_LABEL: Record<BuildingConstruction['shutters'], string> = {
  none: 'no shutters',
  'board-and-batten': 'board shutters',
  louvered: 'louvered shutters',
  paneled: 'paneled shutters',
};

const ENSEMBLE_LABEL: Record<BuildingEnsemble['kind'], string> = {
  detached: 'Detached lot',
  row: 'Street row',
  courtyard: 'Courtyard block',
  'market-arcade': 'Market arcade',
};

/** Plain-language shared-space uses shown by the map inspector. */
const COURTYARD_LABEL: Record<CourtyardAmenity, string> = {
  well: 'Well court',
  'wash-yard': 'Wash yard',
  'work-yard': 'Work yard',
  garden: 'Garden court',
};

/** Shared court ground tint by use; architecture remains on surrounding roofs. */
const COURTYARD_FILL: Record<CourtyardAmenity, string> = {
  well: '#d4c8a8',
  'wash-yard': '#b9c8bf',
  'work-yard': '#c3ad83',
  garden: '#91a873',
};

/** Polygonal circle used only for hover highlighting in the existing path API. */
function courtyardCircle(court: TownCourtyardSpace, steps = 20): Pt[] {
  return Array.from({ length: steps }, (_, index) => {
    const angle = index / steps * Math.PI * 2;
    return [
      court.center[0] + Math.cos(angle) * court.radius,
      court.center[1] + Math.sin(angle) * court.radius,
    ];
  });
}

/**
 * Map-scale symbol for the same amenity later dressed with production props.
 * Geometry is deliberately compact so the surrounding court-facing buildings
 * remain the dominant visual evidence.
 */
const CourtyardGlyph: React.FC<{ court: TownCourtyardSpace }> = ({ court }) => {
  const [cx, cy] = court.center;
  const unit = Math.max(1.4, court.radius * 0.18);
  return (
    <g
      data-testid="town-courtyard"
      data-courtyard-id={court.id}
      data-courtyard-block-key={court.blockKey}
      data-courtyard-district-key={court.districtKey}
      data-courtyard-wealth={court.wealth}
      data-courtyard-amenity={court.amenity}
      data-courtyard-signature={court.courtyardSignature}
    >
      <circle cx={cx} cy={cy} r={court.radius} fill={COURTYARD_FILL[court.amenity]}
        stroke="#75674d" strokeWidth={0.55} strokeDasharray="2 1" vectorEffect="non-scaling-stroke" />
      {court.amenity === 'well' && (
        <g fill="none" stroke="#4d6070" strokeWidth={0.8} vectorEffect="non-scaling-stroke">
          <circle cx={cx} cy={cy} r={unit} />
          <circle cx={cx} cy={cy} r={unit * 0.55} />
        </g>
      )}
      {court.amenity === 'wash-yard' && (
        <rect x={cx - unit * 1.45} y={cy - unit * 0.55} width={unit * 2.9} height={unit * 1.1}
          fill="#668b91" stroke="#415c62" strokeWidth={0.65} vectorEffect="non-scaling-stroke" />
      )}
      {court.amenity === 'work-yard' && (
        <g fill="#8a6842" stroke="#57422e" strokeWidth={0.55} vectorEffect="non-scaling-stroke">
          <rect x={cx - unit * 1.2} y={cy - unit * 0.8} width={unit} height={unit} />
          <rect x={cx + unit * 0.2} y={cy - unit * 0.2} width={unit} height={unit} />
        </g>
      )}
      {court.amenity === 'garden' && (
        <g fill="#547849" stroke="#3f5c38" strokeWidth={0.45} vectorEffect="non-scaling-stroke">
          {[0, 1, 2, 3].map((index) => {
            const angle = index * Math.PI / 2;
            return <circle key={index} cx={cx + Math.cos(angle) * unit * 1.5}
              cy={cy + Math.sin(angle) * unit * 1.5} r={unit * 0.55} />;
          })}
        </g>
      )}
    </g>
  );
};

/** One compact inspector line exposes the town-side massing instruction. */
function ensembleInspectorLine(ensemble: BuildingEnsemble): string {
  const sharedSides = [
    ensemble.partyWallLeft ? 'left' : '',
    ensemble.partyWallRight ? 'right' : '',
  ].filter(Boolean);
  const partyWalls = sharedSides.length > 0
    ? ` · party wall${sharedSides.length > 1 ? 's' : ''} ${sharedSides.join(' + ')}`
    : '';
  const roofRhythm = ensemble.kind === 'row' || ensemble.kind === 'market-arcade'
    ? ' · shared roof rhythm'
    : '';
  return `Block · ${ENSEMBLE_LABEL[ensemble.kind]} · ${ensemble.eaveStoreys}-storey eave${roofRhythm}${partyWalls}`;
}

/** Plain-language names for the visible role cues shown by the inspector. */
const MOTIF_LABEL: Record<BuildingMotif, string> = {
  'front-canopy': 'front canopy',
  'shop-awning': 'shop awning',
  'display-bay': 'display bay',
  'bay-window': 'bay window',
  'jettied-bay': 'jettied bay',
  'hanging-sign': 'hanging sign',
  'vent-stack': 'vent stack',
  'loading-hoist': 'loading hoist',
  'side-shed': 'side shed',
  'covered-gallery': 'covered gallery',
  'entry-portico': 'entry portico',
  'bell-cote': 'bell-cote',
  'roof-finials': 'roof finials',
  battlements: 'battlements',
  'corner-turrets': 'corner turrets',
  buttresses: 'buttresses',
  'log-porch': 'log porch',
};

/** Resolved map dress for one engine plot, keyed from production identity. */
interface TownPlotArchitectureStyle extends ArchitectureVariant, BuildingMotifResolution {
  districtKey: string;
  districtLabel: string;
  buildingKey: string;
  ageBand: BuildingAgeBand;
  weathering: BuildingWeathering;
  ensemble?: BuildingEnsemble;
  trimColor: string;
  patternId: string;
}

/** Reuse SVG pattern definitions whenever wall, trim, and grammar agree. */
function architecturePatternId(
  wallColor: string,
  trimColor: string,
  facadePattern: FacadePattern,
  construction: BuildingConstruction,
  weathering: BuildingWeathering,
  ensemble: BuildingEnsemble | undefined,
): string {
  return `town-architecture-${fnv1a(
    `${wallColor}|${trimColor}|${facadePattern}|${construction.kitId}|` +
    `${weathering.weatheringSignature}|${weathering.intensity}|` +
    `${ensemble?.kind ?? 'none'}|${ensemble?.eaveStoreys ?? 0}`,
  ).toString(36)}`;
}

/**
 * Small map-scale material pattern for one facade grammar.
 *
 * The 2D town cannot show literal wall beams at building scale, but repeating
 * the same horizontal/vertical rhythm makes district dialects readable without
 * inventing a second style system.
 */
const ArchitecturePattern: React.FC<{ style: TownPlotArchitectureStyle }> = ({ style }) => (
  <pattern
    id={style.patternId}
    width={6}
    height={6}
    patternUnits="userSpaceOnUse"
  >
    <rect width={6} height={6} fill={style.wallColor} />
    {/* Construction rhythm sits under the facade grammar. Even a plain facade
        reveals whether its walls are stone, boards, brick, logs, or daub. */}
    <g stroke={style.trimColor} strokeWidth={0.42} opacity={0.5}>
      {(style.construction.wallMaterial === 'rubble-stone' ||
        style.construction.wallMaterial === 'limewashed-stone') && (
        <path d="M0 2H6M0 4.5H6M1.5 0V2M4.5 2V4.5M2.5 4.5V6" />
      )}
      {style.construction.wallMaterial === 'dressed-stone' && (
        <path d="M0 2H6M0 4H6M2 0V2M4 2V4M2 4V6" />
      )}
      {(style.construction.wallMaterial === 'weatherboard' ||
        style.construction.wallMaterial === 'tarred-board') && (
        <path d="M0 1.5H6M0 3H6M0 4.5H6" />
      )}
      {style.construction.wallMaterial === 'brick-infill' && (
        <path d="M0 1.5H6M0 3H6M0 4.5H6M1.5 0V1.5M4.5 1.5V3M1.5 3V4.5M4.5 4.5V6" />
      )}
      {(style.construction.wallMaterial === 'round-log' ||
        style.construction.wallMaterial === 'hewn-log') && (
        <path d="M0 1H6M0 2.5H6M0 4H6M0 5.5H6" />
      )}
      {(style.construction.wallMaterial === 'timber-plaster' ||
        style.construction.wallMaterial === 'wattle-daub') && (
        <path d="M0 0L6 6M6 0L0 6" />
      )}
    </g>
    <g stroke={style.trimColor} strokeWidth={0.7} opacity={0.72}>
      {style.facadePattern === 'belt-course' && <path d="M0 4.5H6" />}
      {style.facadePattern === 'vertical-bays' && <path d="M2 0V6M5 0V6" />}
      {style.facadePattern === 'half-timber' && <path d="M0 0L6 6M6 0L0 6M0 3H6" />}
      {style.facadePattern === 'log-bands' && <path d="M0 1.5H6M0 3H6M0 4.5H6" />}
    </g>
    {/* Age adds a translucent exposure trace without replacing the district's
        material color or facade grammar. New buildings have intensity zero. */}
    {style.weathering.intensity > 0 && (
      <g
        stroke={WALL_PATINA_COLOR[style.weathering.wallPatina]}
        fill={WALL_PATINA_COLOR[style.weathering.wallPatina]}
        opacity={0.08 + style.weathering.intensity * 0.07}
      >
        {style.weathering.wallPatina === 'rain-streaks' && (
          <path d="M1 0V4M3.5 1V6M5 0V3" strokeWidth={0.65} />
        )}
        {(style.weathering.wallPatina === 'salt-bloom' ||
          style.weathering.wallPatina === 'dust-veil') && (
          <path d="M0 4.5H6V6H0Z" strokeWidth={0} />
        )}
        {style.weathering.wallPatina === 'lichen' && (
          <path d="M0.5 5A0.8 0.8 0 0 1 2.1 5M3 4.8A1 1 0 0 1 5 4.8" strokeWidth={1.1} />
        )}
        {style.weathering.wallPatina === 'soot-wash' && (
          <path d="M4.2 0H6V3.5H5Z" strokeWidth={0} />
        )}
      </g>
    )}
    {/* Block grammar remains distinct from facade/material grammar: rows share
        an eave trace, while plaza-facing arcades receive a warmer canopy band. */}
    {(style.ensemble?.kind === 'row' || style.ensemble?.kind === 'market-arcade') && (
      <path
        d="M0 0.7H6"
        stroke={style.ensemble.kind === 'market-arcade' ? '#d2a846' : style.trimColor}
        strokeWidth={style.ensemble.kind === 'market-arcade' ? 1.1 : 0.7}
        opacity={0.9}
      />
    )}
  </pattern>
);

interface HoverInfo {
  poly: Pt[];
  title: string;
  lines: string[];
  px: number; // tooltip anchor in viewBox space
  py: number;
}

/**
 * SP3/SP-T leaf renderer: draws a generated `TownPlan` — footprint, Voronoi
 * wards, party-wall + interior building plots, main streets, defensive walls +
 * gatehouses, and civic anatomy (plaza/temple/keep/citadel/docks/bridges) — with
 * fit-to-view + manual pan/zoom. Hovering a building or civic structure highlights
 * it and shows an inspector tooltip. This is the deepest 2D tier the drill reaches.
 */
const TownPlanView: React.FC<TownPlanViewProps> = ({
  plan,
  width = 900,
  height = 560,
  seedPath,
  prefsScope,
  styleFamily,
  settlementKey,
  climate = 'temperate',
}) => {
  const { layers, toggle } = useTownLayers(prefsScope);
  const bounds = useMemo(() => polygonBounds(plan.footprint), [plan]);

  // Resolve the exact same architecture identity the artifact adapter and 3D
  // blueprint receive. Object identity is safe as the map key because the town
  // plan keeps one canonical plot object in both wards and plan.plots.
  const architectureByPlot = useMemo(() => {
    const resolved = new Map<BuildingPlot, TownPlotArchitectureStyle>();
    if (!styleFamily) return resolved;
    const townKey = settlementKey ?? seedPath ?? 'town-plan-preview';
    plan.wards.forEach((ward, wardIndex) => {
      const wealth = ward.wealth ?? 'common';
      const districtKey = ward.architectureDistrict?.key ?? `wealth:${wealth}`;
      const districtLabel = ward.architectureDistrict?.label ?? `${wealth} quarter`;
      ward.plots.forEach((plot, plotIndex) => {
        const buildingKey = plot.architectureKey
          ?? plot.homeId
          ?? `ward:${wardIndex}/plot:${plotIndex}`;
        const variant = resolveArchitectureVariant(styleFamily, wealth, {
          settlementKey: townKey,
          districtKey,
          buildingKey,
        }, plot.ensemble);
        // Population normally supplies the exact type. For an unpopulated plot,
        // reuse the production interior bridge's closed role mapping so the map
        // never advertises a motif recipe different from the eventual 3D bake.
        const buildingType = plot.buildingType
          ?? buildingTypeForRole(roleForPlot(plot, ward.civic));
        const motifResolution = resolveBuildingMotifs(
          styleFamily.id,
          buildingType,
          variant.districtSignature,
          variant.buildingVariant,
        );
        const ageBand = resolveBuildingAgeBand({
          polygon: plot.polygon,
          townCore: plan.core,
          settlementKey: townKey,
          buildingKey,
        });
        const weathering = resolveBuildingWeathering({
          familyId: styleFamily.id,
          climate,
          ageBand,
          construction: variant.construction,
          architecture: { settlementKey: townKey, districtKey, buildingKey },
          standaloneKey: buildingKey,
        });
        resolved.set(plot, {
          ...variant,
          ...motifResolution,
          districtKey,
          districtLabel,
          buildingKey,
          ageBand,
          weathering,
          ensemble: plot.ensemble ? { ...plot.ensemble } : undefined,
          trimColor: styleFamily.wallTint,
          patternId: architecturePatternId(
            variant.wallColor,
            styleFamily.wallTint,
            variant.facadePattern,
            variant.construction,
            weathering,
            plot.ensemble,
          ),
        });
      });
    });
    return resolved;
  }, [climate, plan, seedPath, settlementKey, styleFamily]);

  const architecturePatterns = useMemo(() => {
    const unique = new Map<string, TownPlotArchitectureStyle>();
    for (const style of architectureByPlot.values()) {
      unique.set(style.patternId, style);
    }
    return [...unique.values()];
  }, [architectureByPlot]);

  const fit = useMemo(() => {
    const w = bounds.maxX - bounds.minX || 1;
    const h = bounds.maxY - bounds.minY || 1;
    const pad = 24;
    const k = Math.min((width - 2 * pad) / w, (height - 2 * pad) / h);
    return {
      k,
      x: pad - bounds.minX * k + (width - 2 * pad - w * k) / 2,
      y: pad - bounds.minY * k + (height - 2 * pad - h * k) / 2,
    };
  }, [bounds, width, height]);

  // Town centre + median plot area: drive relative size categories and the
  // central/outer building-type split (frame-independent, so it works regardless
  // of the normalized submap scale this town was generated in).
  const stats = useMemo(() => {
    const centre = centroidOf(plan.footprint);
    const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) || 1;
    const areas: number[] = [];
    for (const w of plan.wards) for (const pl of w.plots) areas.push(areaOf(pl.polygon));
    areas.sort((a, b) => a - b);
    const median = areas.length ? areas[Math.floor(areas.length / 2)] : 1;
    return { centre, span, median };
  }, [plan, bounds]);

  // homeId → plot, so a home can name the workplace it works at (and vice-versa).
  const homeById = useMemo(() => {
    const m = new Map<string, BuildingPlot>();
    for (const p of plan.plots ?? plan.wards.flatMap((w) => w.plots)) if (p.homeId) m.set(p.homeId, p);
    return m;
  }, [plan]);

  const describeBuilding = (
    pl: BuildingPlot,
    wardCivic?: CivicKind,
    architecture?: TownPlotArchitectureStyle,
  ): { title: string; lines: string[] } => {
    const c = centroidOf(pl.polygon);
    const area = areaOf(pl.polygon);
    const size = area < stats.median * 0.6 ? 'Small' : area > stats.median * 1.6 ? 'Large' : 'Average';

    // Engine-backed path: the population pass tagged this plot with a concrete type,
    // occupancy, district and economy role → show WHO lives/works here.
    if (pl.buildingType) {
      const title = BUILDING_LABEL[pl.buildingType];
      const lines: string[] = [];
      const districtLabel = pl.district ? DISTRICT_LABEL[pl.district] : undefined;
      if (pl.residential) {
        const occ = pl.occupants ?? 0;
        lines.push(`Home · ${occ} resident${occ === 1 ? '' : 's'}${districtLabel ? ` · ${districtLabel}` : ''}`);
        if (seedPath && pl.homeId && occ > 0) {
          const workplaceType = pl.workplaceId ? homeById.get(pl.workplaceId)?.buildingType : undefined;
          const hh = generateHousehold(seedPath, pl.homeId, occ, pl.buildingType, { role: pl.workRole, workplaceType });
          lines.push(hh.summary);
          // Where the breadwinners work.
          if (pl.workRole === 'proprietor' && workplaceType) lines.push(`Runs the local ${BUILDING_LABEL[workplaceType].toLowerCase()}`);
          else if (pl.workRole === 'staff' && workplaceType) lines.push(`Works at the ${BUILDING_LABEL[workplaceType].toLowerCase()}`);
          else if (pl.workRole === 'labourer') lines.push('Unskilled day-labour');
          for (const m of hh.members.slice(0, 3)) lines.push(`• ${m.name}, ${m.age}${m.occupation ? ` — ${m.occupation}` : ` (${m.role})`}`);
          if (hh.members.length > 3) lines.push(`…and ${hh.members.length - 3} more`);
        }
      } else {
        lines.push(`Workplace · no residents${districtLabel ? ` · ${districtLabel}` : ''}`);
        // Who runs it + how many it employs.
        if (seedPath && pl.proprietorHomeId) {
          const prop = homeById.get(pl.proprietorHomeId);
          if (prop?.occupants) {
            const owner = generateHousehold(seedPath, prop.homeId!, prop.occupants, prop.buildingType ?? 'cottage', { role: 'proprietor', workplaceType: pl.buildingType });
            lines.push(`Run by the ${owner.surname}s`);
          }
        }
        lines.push(`Employs ${pl.staffCount ?? 0} ${(pl.staffCount ?? 0) === 1 ? 'hand' : 'hands'}`);
      }
      if (pl.ensemble) lines.push(ensembleInspectorLine(pl.ensemble));
      if (architecture) {
        lines.push(
          `${architecture.districtLabel} · ` +
          `${FACADE_LABEL[architecture.facadePattern]} facade · ${architecture.roofForm} roof`,
        );
        lines.push(`Role cues · ${architecture.motifs.map((motif) => MOTIF_LABEL[motif]).join(', ')}`);
        lines.push(
          `Materials · ${WALL_MATERIAL_LABEL[architecture.construction.wallMaterial]} · ` +
          `${ROOF_COVERING_LABEL[architecture.construction.roofCovering]}`,
        );
        lines.push(
          `Details · ${FOUNDATION_LABEL[architecture.construction.foundation]} · ` +
          `${GLAZING_LABEL[architecture.construction.glazing]} · ` +
          `${SHUTTER_LABEL[architecture.construction.shutters]}`,
        );
        lines.push(`Construction age · ${BUILDING_AGE_LABEL[architecture.ageBand]}`);
        lines.push(
          `Weathering · ${WALL_PATINA_LABEL[architecture.weathering.wallPatina]} · ` +
          `intensity ${architecture.weathering.intensity}/3`,
        );
      }
      if (wardCivic) lines.push(`In the ${CIVIC_LABEL[wardCivic].toLowerCase()} ward`);
      return { title, lines };
    }

    // Fallback (no population data): positional heuristic.
    const dist = Math.hypot(c[0] - stats.centre[0], c[1] - stats.centre[1]) / stats.span; // 0=centre .. ~0.7 edge
    const interior = pl.kind === 'interior';
    const central = !interior && dist < 0.22;
    const pool = interior ? TYPES_INTERIOR : central ? TYPES_CENTRAL : TYPES_OUTER;
    const h = hashPt(c[0], c[1]);
    const title = pool[h % pool.length];
    // Estimated storeys: central commercial taller, interior outbuildings low.
    // (Unsigned shift — a signed >> can go negative when h's top bit is set.)
    const storeys = central ? 2 + ((h >>> 3) % 2) : interior ? 1 : 1 + ((h >>> 3) % 2);
    const lines = [
      interior ? 'Courtyard building (ward interior)' : 'Street-front building',
      `${size} footprint · ${pl.shape === 'L' ? 'L-shaped' : 'rectangular'}`,
      `~${storeys} ${storeys === 1 ? 'storey' : 'storeys'}`,
    ];
    if (pl.ensemble) lines.push(ensembleInspectorLine(pl.ensemble));
    if (architecture) {
      lines.push(
        `${architecture.districtLabel} · ` +
        `${FACADE_LABEL[architecture.facadePattern]} facade · ${architecture.roofForm} roof`,
      );
      lines.push(`Role cues · ${architecture.motifs.map((motif) => MOTIF_LABEL[motif]).join(', ')}`);
      lines.push(
        `Materials · ${WALL_MATERIAL_LABEL[architecture.construction.wallMaterial]} · ` +
        `${ROOF_COVERING_LABEL[architecture.construction.roofCovering]}`,
      );
      lines.push(
        `Details · ${FOUNDATION_LABEL[architecture.construction.foundation]} · ` +
        `${GLAZING_LABEL[architecture.construction.glazing]} · ` +
        `${SHUTTER_LABEL[architecture.construction.shutters]}`,
      );
      lines.push(`Construction age · ${BUILDING_AGE_LABEL[architecture.ageBand]}`);
      lines.push(
        `Weathering · ${WALL_PATINA_LABEL[architecture.weathering.wallPatina]} · ` +
        `intensity ${architecture.weathering.intensity}/3`,
      );
    }
    if (wardCivic) lines.push(`In the ${CIVIC_LABEL[wardCivic].toLowerCase()} ward`);
    return { title, lines };
  };

  const [view, setView] = useState(fit);
  useEffect(() => setView(fit), [fit]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // Native non-passive wheel listener so preventDefault works (React's onWheel
  // prop is passive — preventDefault is a no-op there and warns). Zoom anchors on
  // the cursor (keep the map point under the pointer fixed), not a fixed focal point.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      setView((v) => {
        const nextK = Math.max(0.05, Math.min(64, v.k * f));
        const rect = el.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return { ...v, k: nextK };
        const px = (e.clientX - rect.left) * (width / rect.width);
        const py = (e.clientY - rect.top) * (height / rect.height);
        const wx = (px - v.x) / v.k;
        const wy = (py - v.y) / v.k;
        return { k: nextK, x: px - wx * nextK, y: py - wy * nextK };
      });
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [width, height]);

  // Pointer → town-frame (graph) coordinates, accounting for pan/zoom + viewBox.
  const toGraph = (clientX: number, clientY: number): Pt | null => {
    const el = svgRef.current;
    const rect = el?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const px = (clientX - rect.left) * (width / rect.width);
    const py = (clientY - rect.top) * (height / rect.height);
    return [(px - view.x) / view.k, (py - view.y) / view.k];
  };

  // Hit-test the cursor: civic structures first (drawn on top), then ward plots.
  const inspectAt = (clientX: number, clientY: number): HoverInfo | null => {
    const g = toGraph(clientX, clientY);
    if (!g) return null;
    for (const c of plan.civic) {
      if (pointInPolygon(g, c.polygon)) {
        const [cx, cy] = centroidOf(c.polygon);
        return { poly: c.polygon, title: CIVIC_LABEL[c.kind], lines: ['Civic structure'], px: cx, py: cy };
      }
    }
    for (const w of plan.wards) {
      for (const pl of w.plots) {
        if (pointInPolygon(g, pl.polygon)) {
          const d = describeBuilding(pl, w.civic, architectureByPlot.get(pl));
          const [cx, cy] = centroidOf(pl.polygon);
          return { poly: pl.polygon, title: d.title, lines: d.lines, px: cx, py: cy };
        }
      }
    }
    for (const court of plan.courtyards ?? []) {
      if (Math.hypot(g[0] - court.center[0], g[1] - court.center[1]) <= court.radius) {
        return {
          poly: courtyardCircle(court),
          title: COURTYARD_LABEL[court.amenity],
          lines: [
            `Shared ${court.wealth} block court`,
            `District · ${court.districtKey}`,
          ],
          px: court.center[0],
          py: court.center[1],
        };
      }
    }
    // Rural farmsteads (point homes on the farm parcels) — small hit box.
    for (const f of plan.farmsteads ?? []) {
      if (Math.abs(g[0] - f.x) <= 5 && Math.abs(g[1] - f.y) <= 5) {
        const box: Pt[] = [[f.x - 4, f.y - 6], [f.x + 4, f.y - 6], [f.x + 4, f.y + 3], [f.x - 4, f.y + 3]];
        const lines = [`Rural home · ${f.occupants} resident${f.occupants === 1 ? '' : 's'}`];
        if (seedPath) {
          const hh = generateHousehold(seedPath, f.id, f.occupants, 'farmstead');
          lines.push(hh.summary);
          for (const m of hh.members.slice(0, 3)) lines.push(`• ${m.name}, ${m.age}${m.occupation ? ` — ${m.occupation}` : ` (${m.role})`}`);
          if (hh.members.length > 3) lines.push(`…and ${hh.members.length - 3} more`);
        }
        return { poly: box, title: 'Farmstead', lines, px: f.x, py: f.y };
      }
    }
    return null;
  };

  const onDown = (e: React.MouseEvent) => { drag.current = { x: e.clientX - view.x, y: e.clientY - view.y }; };
  const onMove = (e: React.MouseEvent) => {
    // Capture the drag origin locally: the setView updater runs asynchronously,
    // and onUp/onLeave can null drag.current before it flushes (the crash that
    // surfaced as "Cannot read properties of null (reading 'x')").
    const d = drag.current;
    if (d) {
      const { clientX, clientY } = e;
      setView((v) => ({ ...v, x: clientX - d.x, y: clientY - d.y }));
      if (hover) setHover(null);
      return;
    }
    setHover(inspectAt(e.clientX, e.clientY));
  };
  const onUp = () => { drag.current = null; };
  const onLeave = () => { drag.current = null; setHover(null); };

  // Tooltip anchor in viewBox space (constant-size, follows the hovered shape).
  const tipX = hover ? hover.px * view.k + view.x : 0;
  const tipY = hover ? hover.py * view.k + view.y : 0;
  const tipW = 214;
  const tipLeft = Math.min(Math.max(tipX + 12, 4), width - tipW - 4);
  const lineH = 14;
  const tipH = 22 + (hover?.lines.length ?? 0) * lineH + 6;
  const tipTop = Math.min(Math.max(tipY + 12, 4), height - tipH - 4);

  return (
    <div style={{ position: 'relative', width, height }}>
    <DrillLayerPanel layers={layers} toggle={toggle} defs={TOWN_LAYER_DEFS} />
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ background: '#3a5a40', userSelect: 'none', cursor: drag.current ? 'grabbing' : hover ? 'pointer' : 'grab' }}
      onMouseDown={onDown}
      onMouseMove={onMove}
      onMouseUp={onUp}
      onMouseLeave={onLeave}
      data-testid="town-plan-view"
    >
      <defs>
        {/* Tilled-field furrows for farmland parcels. */}
        <pattern id="town-farm" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
          <rect width="7" height="7" fill="#c7a567" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="#a6843f" strokeWidth="1.5" />
        </pattern>
        {/* District facade grammars reuse the production resolver's wall and
            trim colors. Definitions are deduplicated by material + pattern. */}
        {architecturePatterns.map((style) => (
          <ArchitecturePattern key={style.patternId} style={style} />
        ))}
      </defs>
      <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
        {/* Cell base = open countryside (the whole parent cell is land). */}
        <path d={poly(plan.footprint)} fill="#88a05f" />
        {/* Outskirts: farmland near the town, pasture beyond, scrub at the rim —
            so the town isn't hardset to the cell's edge. */}
        {(plan.outskirts ?? []).map((o, i) => (
          <path key={`out${i}`} d={poly(o.polygon)} fill={OUTSKIRT_FILL[o.kind]} stroke="#6f7a52" strokeWidth={0.3} vectorEffect="non-scaling-stroke" data-testid={`town-outskirt-${o.kind}`} />
        ))}
        {/* Organic built-up CORE filled in the STREET/ground tone: the gaps between
            block fills (the ward insets) then read as the street network. */}
        <path d={poly(plan.core ?? plan.footprint)} fill="#cdbf9c" stroke="#8a7a55" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {/* Buildable blocks (ward insets) in parchment — the area between them is
            street. Fall back to the full ward if no block (older plans). */}
        {plan.wards.map((w, i) => (
          <path key={`w${i}`} d={poly(w.block ?? w.polygon)} fill={w.civic === 'plaza' ? '#e7dcc0' : '#efe6d2'} stroke="#b7a77f" strokeWidth={0.4} vectorEffect="non-scaling-stroke"
            data-architecture-district-key={w.architectureDistrict?.key}
            data-architecture-district-label={w.architectureDistrict?.label} />
        ))}
        {/* Shared courts sit below roofs and above the block fill. Each glyph is
            backed by the same canonical receipt consumed by production props. */}
        {layers.buildings && (plan.courtyards ?? []).map((court) => (
          <CourtyardGlyph key={court.id} court={court} />
        ))}
        {/* Inherited main roads on top of the street grid (wider, distinct). */}
        {layers.roads && plan.streets.map((s, i) => (
          <path key={`st${i}`} d={open(s)} fill="none" stroke="#b8a577" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
        {layers.buildings && plan.wards.flatMap((w, wi) => w.plots.map((pl, pi) => {
          const architecture = architectureByPlot.get(pl);
          const fill = architecture
            ? `url(#${architecture.patternId})`
            : pl.buildingType
              ? BUILDING_FILL[pl.buildingType]
              : pl.kind === 'interior' ? '#b89a72' : '#9c7b54';
          return (
            <path key={`p${wi}-${pi}`} d={poly(pl.polygon)}
              fill={fill}
              stroke={architecture?.roofColor ?? '#5f4527'}
              strokeWidth={architecture ? 0.8 : 0.5}
              strokeDasharray={architecture
                ? BUILDING_AGE_DASH[architecture.ageBand]
                : undefined}
              vectorEffect="non-scaling-stroke"
              data-testid={pl.buildingType ? `town-building-${pl.buildingType}` : undefined}
              data-architecture-district-key={architecture?.districtKey}
              data-architecture-district-label={architecture?.districtLabel}
              data-architecture-district-signature={architecture?.districtSignature}
              data-architecture-building-key={architecture?.buildingKey}
              data-architecture-building-variant={architecture?.buildingVariant}
              data-architecture-pitch-scale={architecture?.pitchScale}
              data-architecture-eave-offset-ft={architecture?.eaveOffsetFt}
              data-building-age-band={architecture?.ageBand}
              data-building-ensemble-kind={pl.ensemble?.kind}
              data-building-ensemble-block-key={pl.ensemble?.blockKey}
              data-building-ensemble-signature={pl.ensemble?.ensembleSignature}
              data-building-ensemble-eave-storeys={pl.ensemble?.eaveStoreys}
              data-building-ensemble-party-left={pl.ensemble?.partyWallLeft}
              data-building-ensemble-party-right={pl.ensemble?.partyWallRight}
              data-architecture-facade-pattern={architecture?.facadePattern}
              data-architecture-construction-kit={architecture?.construction.kitId}
              data-architecture-construction-signature={architecture?.construction.constructionSignature}
              data-architecture-wall-material={architecture?.construction.wallMaterial}
              data-architecture-roof-covering={architecture?.construction.roofCovering}
              data-architecture-foundation={architecture?.construction.foundation}
              data-architecture-glazing={architecture?.construction.glazing}
              data-architecture-shutters={architecture?.construction.shutters}
              data-architecture-ornament-kit={architecture?.construction.ornamentKit}
              data-building-weathering-signature={architecture?.weathering.weatheringSignature}
              data-building-weathering-variant={architecture?.weathering.weatheringVariant}
              data-building-weathering-wall-patina={architecture?.weathering.wallPatina}
              data-building-weathering-roof-patina={architecture?.weathering.roofPatina}
              data-building-weathering-intensity={architecture?.weathering.intensity}
              data-building-weathering-coverage={architecture?.weathering.coverage}
              data-architecture-motifs={architecture?.motifs.join(',')}
              data-architecture-motif-signature={architecture?.motifSignature}
              data-architecture-motif-variant={architecture?.motifVariant}
              data-architecture-roof-form={architecture?.roofForm}
              data-architecture-wall-color={architecture?.wallColor}
              data-architecture-roof-color={architecture?.roofColor} />
          );
        }))}
        {/* Rural farmsteads: scattered homes out on the farm parcels (where the
            rural share of the population lives, working the fields). */}
        {layers.buildings && (plan.farmsteads ?? []).map((f, i) => (
          <g key={`fs${i}`} data-testid="town-farmstead">
            <rect x={f.x - 3.5} y={f.y - 3} width={7} height={6} fill="#a98a5f" stroke="#5f4527" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            <path d={`M${(f.x - 4).toFixed(1)},${(f.y - 3).toFixed(1)}L${f.x.toFixed(1)},${(f.y - 6).toFixed(1)}L${(f.x + 4).toFixed(1)},${(f.y - 3).toFixed(1)}`} fill="#8a6643" stroke="#5f4527" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
        {layers.civic && plan.civic.map((c, i) => (
          <path key={`c${i}`} d={poly(c.polygon)} fill={CIVIC_COLOR[c.kind]} stroke="#1c150a" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        {layers.walls && plan.walls.ring.length > 0 && (
          <path d={poly(plan.walls.ring)} fill="none" stroke="#6b5836" strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )}
        {layers.walls && plan.walls.gatehouses.map((g, i) => (
          <rect key={`g${i}`} x={g[0] - 4} y={g[1] - 4} width={8} height={8} fill="#5a4a2a" stroke="#2a1f10" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={poly(plan.footprint)} fill="none" stroke="#3a2a14" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {/* Hover highlight — drawn last so it sits above the building it traces. */}
        {hover && (
          <path d={poly(hover.poly)} fill="#fff3" stroke="#ffe08a" strokeWidth={2.5}
            strokeLinejoin="round" vectorEffect="non-scaling-stroke" pointerEvents="none" data-testid="town-hover-highlight" />
        )}
      </g>
      {/* Inspector tooltip — screen space, constant size. */}
      {hover && (
        <g pointerEvents="none" data-testid="town-inspector">
          <rect x={tipLeft} y={tipTop} width={tipW} height={tipH} rx={4}
            fill="#1c150aee" stroke="#ffe08a" strokeWidth={1} />
          <text x={tipLeft + 8} y={tipTop + 16} fontFamily="Georgia, serif" fontSize={12} fontWeight={700} fill="#ffe08a">
            {hover.title}
          </text>
          {hover.lines.map((ln, i) => (
            <text key={i} x={tipLeft + 8} y={tipTop + 16 + (i + 1) * lineH} fontFamily="Georgia, serif" fontSize={10} fill="#e8dcc0">
              {ln}
            </text>
          ))}
        </g>
      )}
    </svg>
    </div>
  );
};

export default TownPlanView;
