/**
 * @file oceanExtras/mouth.ts — mounts the river mouth in the ocean viewer:
 * a river runs through the beach into the sea, as ONE water (ADR 0006,
 * GG-341; river mouth round 1).
 *
 * `?extras=mouth&sea=surf` turns it on (Remy, 2026-10-09: the judged beach
 * moves to a surf-sized sea). Any sea works; every number of the coast and
 * the mouth is derived from the sea it mounts on (`oceanMouthMath.ts`).
 *
 * THE COAST AND ITS PLACES (`COAST_PLACES` in oceanMouthMath.ts; Remy,
 * 2026-10-09: "why can't we have all variations somewhere on the map?"):
 * one long sand coast facing the swell, the shoreline along X through the
 * origin, the land at -Z. Along the shore (the beach frame's a, toward -X):
 *   - THE JUDGED BEACH, a = -24 .. 30: the beach's judged poses (beach-seq,
 *     beach-top) on the mouth's right bank;
 *   - THE SARCELLE MOUTH, a = 40: a 40 m river (31 m^3/s, from the clip's
 *     width; round 2) across the beach, the default place;
 *   - THE CREEK MOUTH, a = -200: the round-1 river (1.5 m^3/s), `?mouthplace=creek`;
 *   - THE DELTA REACH, a = -360: kept for a wide delta plume (later);
 *   - THE LAGOON MOUTH, a = +400: kept for a barrier lagoon's inlet (later).
 *
 * WHAT IT MOUNTS. The beach (`createOceanBeach`) on the coast's floor with
 * the river's valley cut in, its swash grid run on past the mouth so the
 * swash runs on both banks (the mouth's grid owns the valley's cells: the
 * swash's walls); the mouth (`createOceanMouth`): the near field in a
 * worker, the plume, and the reader the sea's one surface draws them
 * through (`setRiver`); the mouth's foam into the one foam field (shown with
 * `extras=mouth,foam`); and the ebb bar as a shelf of the sea's one
 * bathymetry, so the sea's own breaker sees it.
 *
 * THE BEACH COMES WITH IT: do not list `beach` or `seabed` with `mouth`.
 * A pinned capture waits for `__OCEAN__.extras.mouth.settled()` (the beach
 * and the near field both at the pinned time).
 */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 12/10/2026, 05:45:34
 * Dependents: None (Orphan)
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import type { OceanSurface } from '@/systems/world3d/ocean/oceanSurface';
import { createOceanBeach } from '@/systems/world3d/ocean/oceanBeach';
import * as THREE from 'three/webgpu';
import { applyDaySea, createOceanMouth, mouthDisplayCurveNode } from '@/systems/world3d/ocean/oceanMouth';
import { coastBeachGrid, daySeaCascades, deriveMouthDesign, mouthFloorDetail, mouthHandoverLengthM, mouthPlaceConditions, mouthPlaceOf, mouthSwashWalls } from '@/systems/world3d/ocean/oceanMouthMath';
import { oceanFoamSources } from '@/systems/world3d/ocean/oceanFoam';
import { OCEAN_DEEP_M, oceanBathymetryFor, type OceanShelf } from '@/systems/world3d/ocean/oceanBathymetry';
import { FLOOR_LIGHT } from '@/systems/world3d/ocean/oceanSeabedMath';
import type { OceanExtra, OceanExtraContext } from '../oceanExtras';

/** Off unless asked for. */
export const enabledByDefault = false;

export default async function mount(ctx: OceanExtraContext): Promise<OceanExtra> {
  const surface = ctx.field.surface as OceanSurface;
  if (typeof surface.setRiver !== 'function' || typeof surface.setSeabed !== 'function') {
    throw new Error('[ocean] The river mouth is drawn through the surface hooks `setRiver` and `setSeabed`, and this surface lacks one.');
  }
  const q = new URLSearchParams(window.location.search);
  const listed = (q.get('extras') ?? '').split(',').map((s) => s.trim());
  if (listed.includes('beach') || listed.includes('seabed')) {
    throw new Error('[ocean] extras=mouth brings its own beach and sea floor. Mount it without `beach` and `seabed`: two floors would fight over the surface\'s one reader.');
  }
  // Round 2: the place on the coast, `?mouthplace=sarcelle` (the default: 31 m^3/s at a = 40) or `creek`
  // (the round-1 1.5 m^3/s mouth, at a = -200). One place a page: the floor holds one valley.
  const place = mouthPlaceOf(q.get('mouthplace'));
  /* ROUND 10 (law 1): the place's tide (the record's still water, the low water) is the design's default;
   * `&mouthtide=0` mounts the mean sea level (the control).
   * ROUND 11 (law 1): the scene runs the CLIP'S DAY (`MouthPlaceConditions.dayDischargeM3S`: the near field's inflow,
   * the drawn jet, the load and the wind over the water at the day's flow; the channel and the bar at the mean
   * flow's) with the swash bar, the record's defaults. Controls: `&mouthbar=break` rounds 3 to 10's crest,
   * `&mouthday=mean` the day at the mean flow (round 10's flow), `&mouthflow=<m^3/s>` the day at another flow. */
  const flowQ = Number(q.get('mouthflow'));
  if (q.get('mouthflow') !== null && !(flowQ > 0)) throw new Error('[ocean] &mouthflow= takes a discharge in m^3/s over 0.');
  const dayQ = flowQ > 0 ? flowQ : q.get('mouthday') === 'mean' ? place.dischargeM3S : undefined;
  const design = deriveMouthDesign({
    cascades: ctx.field.cascades, n: ctx.field.buffers.n, seed: ctx.seed, place: place.name,
    ...(q.get('mouthtide') === '0' ? { tideM: 0 } : {}),
    ...(q.get('mouthbar') === 'break' ? { barLaw: 'break' as const } : {}),
    ...(dayQ !== undefined ? { dayDischargeM3S: dayQ } : {}),
    // ROUND 12 (gap 2): the record's day sea is the default; `&mouthsea=mean` mounts the sea state's own (the control).
    ...(q.get('mouthsea') === 'mean' ? { daySeaHsM: null } : {}),
    // ROUND 13 (law 1; GG-413): the record's drift gives the deflected planform; `&mouthplan=straight` mounts rounds 1 to
    // 12's straight valley (the control).
    ...(q.get('mouthplan') === 'straight' ? { planform: 'straight' as const } : {}),
    // ROUND 14 (rulings 1 and 2): the infragravity band at the near field's sea edge, the platform's washover surface
    // and the spit's seaward terrace are the default; `&mouthig=0`, `&mouthwash=0` and `&mouthterrace=0` take each off.
    ...(q.get('mouthig') === '0' ? { infragravity: false } : {}),
    ...(q.get('mouthwash') === '0' ? { washover: false } : {}),
    ...(q.get('mouthterrace') === '0' ? { terrace: false } : {}),
    // ROUND 15 (rulings 1 to 3): the day's low-flow channel, the record's fitted load and the terrace's front at the
    // record's surf band are the default; `&mouthlow=0`, `&mouthload=rating` and `&mouthband=0` take each off.
    ...(q.get('mouthlow') === '0' ? { lowFlow: false } : {}),
    ...(q.get('mouthload') === 'rating' ? { dayLoadGM3: null } : {}),
    ...(q.get('mouthband') === '0' ? { surfBand: false } : {}),
  });
  /* ROUND 12 (gap 2; the lead's ruling 2): THE SCENE RUNS THE DAY'S SEA. The FFT's forced bands take the day's share
   * of their energy (`applyDaySea`: h0 times its root), and both near fields' sea edges are forced with the same sea
   * (`daySeaCascades`): one sea, at the clip's day height. Undone on dispose. */
  const seaEnergy = design.seaEnergy ?? 1;
  const undoDaySea = applyDaySea(ctx.field, seaEnergy);
  const dayCascades = seaEnergy === 1 ? undefined : daySeaCascades(ctx.field.cascades, seaEnergy);
  /* ROUND 4, THE PLACE'S CONDITIONS (the lead's point 3; Remy, sheet q34):
   * the place judged against a clip carries the clip's weather, measured on
   * the clip (`mouthPlaceConditions`, oceanMouthMath.ts): on the Sarcelle the
   * sky's overcast is the clip's cloud cover. The sky's `uOvercast` is the one
   * node the viewer gave both the sky and the water (`createOceanSky`'s
   * `overcast`), so setting it here before the first frame is the place's
   * overcast in `createOceanSky`; the open sea's scenes never mount this piece
   * and keep overcast 0. `&mouthsky=0` mounts the mouth under the viewer's sky
   * (the control). Restored on dispose. */
  const conditions = q.get('mouthsky') === '0' ? null : mouthPlaceConditions(place.name);
  const overcastBefore = ctx.sky.uOvercast.value as number;
  if (conditions !== null) ctx.sky.uOvercast.value = conditions.overcast;
  /* ROUND 6, THE PLACE'S SKY IS A BRIGHT OVERCAST (law 1): the clip was shot
   * under a thin stratus deck of broken cloud, a sky state between the fair
   * cumulus and the storm deck (oceanSkyDeckMath.ts). The record carries the
   * deck's optical depth, its shape, its cover and the air under it, fitted
   * to the clip's cloud pixels; the sky lays it on (`setDeck`: the field on
   * the CPU and the deck's uniforms, no shader rebuild), and every lit thing
   * of the place takes the light under it. The sun stays the viewer's.
   * `&mouthsky=0` keeps the viewer's sky (the control). Taken off on dispose. */
  if (conditions !== null && conditions.deckTau !== null) {
    ctx.sky.setDeck({
      cloudShare: conditions.cloudShare,
      tauMean: conditions.deckTau,
      tauShape: conditions.deckTauShape,
      floorLight: FLOOR_LIGHT,
      airK: conditions.deckAirK,
      sunMean: conditions.deckSunMean,
    });
  }
  /* ROUND 11 (the lead's ruling 3): THE PLACE'S DISPLAY CURVE. The place's record carries the clip's camera curve
   * (`MouthPlaceConditions.displayCurve`, fitted by measure); this page draws through it in place of the viewer's
   * ACES curve (the renderer's output pass only: no material rebuilds, and no other page mounts this piece).
   * `&mouthcurve=0` keeps the viewer's curve (the control). The probe's `setToneCurve` switches it in the page:
   * 'aces' (the viewer's), 'place' (the record's), 'linear' (the scene's linear light at an exposure, to measure),
   * or 'custom' with its two numbers (the fit's own check). Restored on dispose. */
  const toneBefore = { mapping: ctx.renderer.toneMapping, exposure: ctx.renderer.toneMappingExposure };
  const placeCurve = conditions?.displayCurve ?? null;
  // A fresh node function at each switch to the custom curve: a second switch onto the same function drew black
  // (the output pass rebuilt with the function already set up; mouth11/shots/f6tone-place-mouth-join9.png).
  const useCurve = (c: { exposure: number; gamma: number }) => {
    ctx.renderer.library.addToneMapping(mouthDisplayCurveNode(c).fn, THREE.CustomToneMapping);
  };
  const setToneCurve = (kind: 'aces' | 'place' | 'linear' | 'custom', o?: { exposure?: number; gamma?: number }) => {
    if (kind === 'aces') { ctx.renderer.toneMapping = toneBefore.mapping; ctx.renderer.toneMappingExposure = toneBefore.exposure; return; }
    if (kind === 'linear') { ctx.renderer.toneMapping = THREE.LinearToneMapping; ctx.renderer.toneMappingExposure = o?.exposure ?? 1; return; }
    if (kind === 'place') {
      if (placeCurve === null) throw new Error('[ocean] The place has no display curve in its record.');
      useCurve(placeCurve);
    } else {
      useCurve({ exposure: o?.exposure ?? 1, gamma: o?.gamma ?? 1 });
    }
    ctx.renderer.toneMapping = THREE.CustomToneMapping;
    ctx.renderer.toneMappingExposure = 1;
  };
  if (placeCurve !== null && q.get('mouthcurve') !== '0') setToneCurve('place');
  // The beach's swash grid around the place, both banks (`coastBeachGrid`).
  const beachGrid = coastBeachGrid(design);
  // ROUND 5 (GG-394): the beach's wet band over the mouth's strip reads the mouth grid's own sand; the mouth
  // is built after the beach, so a holder carries its read, set below before the floor is in the scene.
  const stripSoil: { at: ((xz: unknown) => { w: unknown; a: unknown; b: unknown }) | null } = { at: null };
  /* ROUND 12 (gap 3, GG-394): ONE TERRAIN AT THE SPIT. The mouth's grid box less the beach's own patch (whose 0.5 m
   * sand mesh draws its part) is drawn by the floor's detail mesh at the sand mesh's 0.5 m along the shore
   * (`OceanSeabedOptions.detail`): the bar and the near mouth seaward of the beach's patch, and the banks and spits
   * from the beach's top row (the berm, s 24) up the valley. The sand mesh's border vertices on those lines take the
   * same map heights, so the meshes share them. `&mouthfloor=0` keeps the 2.5 m floor there (the control). */
  const floorDetail = q.get('mouthfloor') === '0' ? undefined : mouthFloorDetail(design, beachGrid);
  const beach = await createOceanBeach({
    field: ctx.field,
    sunDir: ctx.sky.sunDir,
    overcast: ctx.sky.uOvercast,
    skyClouds: ctx.sky.cloudReflTexture,
    seed: ctx.seed,
    crestHide: q.get('beachhide') === '1',
    levers: q.get('beachlevers') === '1',
    match: q.get('beachmatch') === '1',
    ...(q.get('beachswash') === 'r16' ? { matchSwash: 'r16' as const } : {}),
    seabedParams: design.params,
    grid: beachGrid,
    // Round 2: the walls stop one hand-over length inside each side of the mouth's grid (the overlap).
    wall: mouthSwashWalls(design, beachGrid, mouthHandoverLengthM(ctx.field.cascades)),
    // The beach's look ends before the mouth's strip (the lead's seam 1): no box ends at the walls.
    // Round 1c: the strip as the look sees it is wider by the hand-over length on each side. There the
    // sea's one surface hands the beach grid's water over (oceanMouth.ts, the beach's hand-over falls to 0
    // at the strip's edge), so it stands under the sheet's water, and the sheet showed through as pale
    // blocks at both banks; the look now ends where that hand-over begins.
    // Round 2 (changed): the look ends where the beach grid's walls begin, the overlap's inner edge. The
    // beach grid now holds its own water over the overlap (`mouthSwashWalls` inset) and the surface's two
    // hand-overs there sum to 1, so the look fades over the overlap instead of outside the mouth's grid.
    wallStripA: [design.grid.a0 + mouthHandoverLengthM(ctx.field.cascades), design.grid.a0 + design.grid.na * design.grid.da - mouthHandoverLengthM(ctx.field.cascades)],
    // The look hands over to the sea over the near field's own hand-over length (the lead's seam 2).
    seaEdgeFadeM: mouthHandoverLengthM(ctx.field.cascades),
    derivedSwash: true,
    // Round 1c: the swash grid's water seaward of the still line goes to the sea's one surface.
    seaSlope: true,
    ...(q.get('mouthsoil') === '0' ? {} : { stripSoil }),
    ...(dayCascades ? { cascades: dayCascades } : {}),
    ...(floorDetail ? { floorDetail } : {}),
  });

  const mouth = await createOceanMouth({
    field: ctx.field, design, map: beach.seabed.map, seed: ctx.seed,
    // Round 1c: the beach's grid hands over to the one surface as the mouth's does (seams 1, 2).
    ...(q.get('mouthbeach') === '0' ? {} : { beach: beach.swash, handoverM: mouthHandoverLengthM(ctx.field.cascades) }),
    // Round 6: `&mouthfilm=0` mounts the reader without the river's film (a control).
    ...(q.get('mouthfilm') === '0' ? { film: false } : {}),
    // Round 12 (gap 2): the near field's sea edge at the day's sea.
    ...(dayCascades ? { cascades: dayCascades } : {}),
  });
  // Round 5: the floor (and so its shader) goes in only once the strip's sand read is set (`stripSoil`).
  stripSoil.at = mouth.stripSoil;
  surface.setSeabed(beach.seabed.reader);
  ctx.scene.add(beach.seabed.mesh);
  // Round 12 (gap 3): the floor's detail mesh at the mouth (null with `&mouthfloor=0`).
  if (beach.seabed.detailMesh !== null) ctx.scene.add(beach.seabed.detailMesh);
  ctx.scene.add(beach.group);
  let riverOn = q.get('mouthriver') !== '0';
  if (riverOn) surface.setRiver(mouth.reader);
  const removeFoam = oceanFoamSources(ctx.field).add(mouth.foamSource);
  // The ebb bar is a floor feature of the sea: one shelf of its bathymetry.
  const bathy = oceanBathymetryFor(ctx.field.buffers);
  const shelvesBefore = bathy.shelves.slice();
  /* ROUND 6 (law 2): THE BAR IS NO LONGER A SHELF of the sea's bathymetry.
   * The shelf law is a disc, and the foam field's reef law broke every crest
   * over it at the raw FFT crest, evenly: one more even strip on the mouth.
   * The bar's planform (`SeabedValley.bar.laterM`) is in the coast's floor,
   * which the river reader takes every depth from (its shoaling divides the
   * bathymetry's gain out) and on which the mouth's foam source breaks the
   * crests by the roller's dissipation: one bar, one law, once.
   * `&mouthbarshelf=1` puts round 5's shelf back (the control). */
  if (design.bar && q.get('mouthbarshelf') === '1') {
    const bar: OceanShelf = {
      xM: design.bar.xM, zM: design.bar.zM, innerM: design.bar.innerM, outerM: design.bar.outerM,
      // Round 1c: past its outer radius the bar claims NO depth (OCEAN_DEEP_M, the module's 'no shelf').
      // A shelf's far depth holds from its outer radius out to every point of the sea: round 1 gave the
      // floor's 3.6 m there, so the bathymetry's shoaling gain lifted every band of the whole sea by
      // (ref / 3.6)^0.25, and the foam field broke the open sea as 3.6 m deep. The coast's own floor is the
      // river reader's (its coast depth holds the bar too).
      depthM: design.bar.depthM, farDepthM: OCEAN_DEEP_M,
    };
    bathy.set([...shelvesBefore, bar]);
  }

  let stepping = true;
  const probe: Record<string, unknown> = {
    ...mouth.probe,
    beach: beach.probe,
    seabed: beach.seabed.probe,
    /** Both the beach and the near field stand at the time last asked for. */
    settled: () => (mouth.probe.settled as () => boolean)() && (beach.probe.settled as () => boolean)(),
    /** Hand the river's reader to the surface (true) or take it back (false); rebuilds the shader. */
    setRiver: (on: boolean) => { riverOn = on; surface.setRiver(on ? mouth.reader : null); },
    riverOn: () => riverOn,
    /** Round 4: the place's conditions in force (null: the viewer's sky). */
    conditions: () => conditions,
    /** Round 6: the light under the place's deck (null: no deck). */
    deckLight: () => ctx.sky.deckLight(),
    /** Round 6: the deck on (the record's) or off, for an A/B in one page. */
    setDeck: (on: boolean) => {
      if (!on || conditions === null || conditions.deckTau === null) { ctx.sky.setDeck(null); return; }
      ctx.sky.setDeck({ cloudShare: conditions.cloudShare, tauMean: conditions.deckTau, tauShape: conditions.deckTauShape, floorLight: FLOOR_LIGHT, airK: conditions.deckAirK, sunMean: conditions.deckSunMean });
    },
    /** Round 11: the display curve in force ('aces', 'place', 'linear' with an exposure, 'custom' with its two numbers). */
    setToneCurve,
    /** Stop asking the workers for new states, for a frame-time A/B. */
    setStepping: (on: boolean) => { stepping = on; },
  };

  return {
    update(simTime: number, dtS: number) {
      beach.update(ctx.renderer, ctx.camera, simTime, dtS === 0, stepping);
      mouth.update(simTime, dtS === 0, stepping);
      // Round 9 (law 1): the young sea's FFT at the sea's time (once a time; a pinned clock steps it once).
      mouth.stepYoung(ctx.renderer, simTime);
    },
    dispose() {
      ctx.renderer.toneMapping = toneBefore.mapping;
      ctx.renderer.toneMappingExposure = toneBefore.exposure;
      ctx.sky.uOvercast.value = overcastBefore;
      undoDaySea();
      ctx.sky.setDeck(null);
      surface.setRiver(null);
      surface.setSeabed(null);
      removeFoam();
      bathy.set(shelvesBefore);
      ctx.scene.remove(beach.seabed.mesh);
      if (beach.seabed.detailMesh !== null) ctx.scene.remove(beach.seabed.detailMesh);
      ctx.scene.remove(beach.group);
      beach.dispose();
      mouth.dispose();
    },
    probe,
  };
}
