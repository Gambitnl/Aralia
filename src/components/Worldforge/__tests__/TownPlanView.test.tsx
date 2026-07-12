import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import TownPlanView from '../TownPlanView';
import { generateTownPlan } from '../../../systems/worldforge/town/townEngine';
import { rootSeedPath } from '../../../systems/worldforge/seedPath';
import type { Pt } from '../../../systems/worldforge/submap/submapEngine';
import { STYLE_FAMILIES } from '../../../systems/worldforge/town/architectureStyle';
import { toArtifactPlan } from '../../../systems/worldforge/town/townPlanAdapter';
import { transformTownPlan } from '../../../systems/worldforge/town/canonicalTown';

const footprint: Pt[] = [[0, 0], [120, 0], [140, 90], [70, 140], [0, 100]];

// Town layer toggles persist to localStorage; isolate tests.
beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

describe('TownPlanView', () => {
  it('renders a generated town plan as an SVG with ward + plot paths', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    const { getByTestId, container } = render(
      <TownPlanView plan={plan} width={600} height={400} />,
    );
    expect(getByTestId('town-plan-view')).toBeTruthy();
    // Footprint + wards + plots + civic should yield many path elements.
    expect(container.querySelectorAll('path').length).toBeGreaterThan(plan.wards.length);
  });

  it('colors buildings by their population-assigned type and seats rural farmsteads', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    const { container } = render(<TownPlanView plan={plan} width={600} height={400} />);
    // At least cottages should be tagged with their concrete building type.
    expect(container.querySelectorAll('[data-testid^="town-building-"]').length).toBeGreaterThan(0);
    // The rural population lives in farmsteads drawn out on the farm parcels.
    expect(plan.farmsteads.length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-testid="town-farmstead"]').length).toBe(plan.farmsteads.length);
  });

  it('accepts a seedPath and renders without crashing (household naming wiring)', () => {
    // Hover-driven household naming needs real layout (jsdom has none), so the
    // household content itself is covered by household.test.ts + the headless proof.
    // Here we just ensure the seedPath prop is accepted and a residential home exists.
    const seed = rootSeedPath(42);
    const plan = generateTownPlan(footprint, seed, { population: 4000 });
    const { getByTestId } = render(<TownPlanView plan={plan} width={600} height={400} seedPath={seed} />);
    expect(getByTestId('town-plan-view')).toBeTruthy();
    expect(plan.wards.flatMap((w) => w.plots).some((p) => p.residential && (p.occupants ?? 0) > 0)).toBe(true);
  });

  it('town layer panel toggles buildings off', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    const { container, getByTestId, getByLabelText } = render(
      <TownPlanView plan={plan} width={600} height={400} />,
    );
    const buildingCount = () => container.querySelectorAll('[data-testid^="town-building-"]').length;
    expect(buildingCount()).toBeGreaterThan(0); // buildings drawn by default

    fireEvent.click(getByTestId('drill-layers-toggle')); // open the town layers menu
    fireEvent.click(getByLabelText('Buildings'));
    expect(buildingCount()).toBe(0); // building plots hidden
  });

  it('survives a pan drag that ends before the final move (no null drag-ref crash)', () => {
    // Regression: onMove scheduled a setView updater that read drag.current.x
    // asynchronously; onMouseUp/Leave could null the ref first → "Cannot read
    // properties of null (reading 'x')". The handlers now capture the ref locally.
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    const { getByTestId } = render(<TownPlanView plan={plan} width={600} height={400} />);
    const svg = getByTestId('town-plan-view');
    expect(() => {
      fireEvent.mouseDown(svg, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(svg, { clientX: 130, clientY: 120 });
      fireEvent.mouseUp(svg);
      // A move after the drag has ended must hit the hover branch, never read a null ref.
      fireEvent.mouseMove(svg, { clientX: 150, clientY: 140 });
      fireEvent.mouseLeave(svg);
    }).not.toThrow();
  });

  it('uses family wall palette when styleFamily is provided', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    const fam = STYLE_FAMILIES.highlandStone;
    const { container } = render(
      <TownPlanView plan={plan} width={600} height={400} styleFamily={fam} />,
    );
    const wallColors = new Set(
      Array.from(container.querySelectorAll('[data-architecture-wall-color]'))
        .map((el) => el.getAttribute('data-architecture-wall-color'))
        .filter(Boolean),
    );
    expect(fam.wallPalette.some((color) => wallColors.has(color))).toBe(true);
  });

  it('renders repeated facade dialects across multiple spatial districts', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    // River half-timber has no plain facade option, so every styled building
    // must visibly use one of the generated SVG material patterns.
    const family = STYLE_FAMILIES.riverHalfTimber;
    const { container } = render(
      <TownPlanView
        plan={plan}
        width={600}
        height={400}
        styleFamily={family}
        settlementKey="burg:17"
      />,
    );
    const buildings = Array.from(
      container.querySelectorAll<SVGPathElement>('[data-architecture-building-key]'),
    );
    const districtKeys = new Set(
      buildings.map((building) => building.dataset.architectureDistrictKey),
    );

    expect(buildings.length).toBeGreaterThan(0);
    expect(districtKeys.size).toBeGreaterThan(1);
    expect(container.querySelectorAll('pattern[id^="town-architecture-"]').length)
      .toBeGreaterThan(0);
    expect(buildings.every((building) => building.getAttribute('fill')?.startsWith('url(')))
      .toBe(true);

    // Wealth may change finish colors inside a district, but its structural
    // signature remains one coherent construction tradition.
    for (const districtKey of districtKeys) {
      const districtBuildings = buildings.filter(
        (building) => building.dataset.architectureDistrictKey === districtKey,
      );
      expect(new Set(districtBuildings.map(
        (building) => building.dataset.architectureDistrictSignature,
      )).size).toBe(1);
      expect(new Set(districtBuildings.map(
        (building) => building.dataset.architectureFacadePattern,
      )).size).toBeLessThanOrEqual(2);
    }
  });

  it('exposes recognizable role motifs from the same production resolver', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(91), { population: 4000 });
    const roleProofs = [
      ['shop', 'hanging-sign'],
      ['smithy', 'vent-stack'],
      ['workshop', 'loading-hoist'],
      ['farmstead', 'side-shed'],
      ['inn', 'hanging-sign'],
      ['storehouse', 'loading-hoist'],
    ] as const;
    const plots = plan.wards.flatMap((ward) => ward.plots);

    // Give six real plan polygons explicit roles so this focused rendering test
    // does not depend on population-balancing changes elsewhere in townEngine.
    roleProofs.forEach(([buildingType], index) => {
      plots[index].buildingType = buildingType;
    });

    const { container } = render(
      <TownPlanView
        plan={plan}
        width={600}
        height={400}
        styleFamily={STYLE_FAMILIES.highlandStone}
        settlementKey="burg:motif-proof"
      />,
    );

    roleProofs.forEach(([buildingType, expectedCoreMotif]) => {
      const building = container.querySelector<SVGPathElement>(
        `[data-testid="town-building-${buildingType}"]`,
      );
      expect(building).toBeTruthy();
      expect(building!.dataset.architectureMotifs?.split(','))
        .toContain(expectedCoreMotif);
      expect(building!.dataset.architectureMotifSignature).toBeTruthy();
      expect(Number(building!.dataset.architectureMotifVariant)).toBeGreaterThanOrEqual(0);
      expect(Number(building!.dataset.architectureMotifVariant)).toBeLessThanOrEqual(2);
    });
  });

  it('matches the artifact identity and resolved dialect consumed by 3D', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    const family = STYLE_FAMILIES.coastalTimber;
    // Production adapts the same normalized plan only after scaling it into
    // feet. Preserve that path here so legitimate normalized plots are not
    // rejected by the adapter's 10-foot sliver guard.
    const artifact = toArtifactPlan(transformTownPlan(plan, 10), 17, family).plan;
    const artifactPlot = artifact.plots.find((plot) =>
      plot.architecture?.buildingKey.startsWith('plot:'))!;
    const { container } = render(
      <TownPlanView
        plan={plan}
        width={600}
        height={400}
        styleFamily={family}
        settlementKey="burg:17"
      />,
    );
    const mapPlot = container.querySelector<SVGPathElement>(
      `[data-architecture-building-key="${artifactPlot.architecture!.buildingKey}"]`,
    )!;

    expect(mapPlot).toBeTruthy();
    expect(mapPlot.dataset.architectureDistrictKey)
      .toBe(artifactPlot.architecture!.districtKey);
    expect(mapPlot.dataset.architectureDistrictSignature)
      .toBe(artifactPlot.architecture!.districtSignature);
    expect(mapPlot.dataset.architectureBuildingVariant)
      .toBe(artifactPlot.architecture!.buildingVariant);
    expect(mapPlot.dataset.architectureFacadePattern)
      .toBe(artifactPlot.architecture!.facadePattern);
    expect(mapPlot.dataset.architectureRoofForm).toBe(artifactPlot.roofForm);
    expect(mapPlot.dataset.architectureWallColor).toBe(artifactPlot.wallColorHex);
    expect(mapPlot.dataset.architectureRoofColor).toBe(artifactPlot.roofColorHex);
  });

  it('keeps legacy type fills without styleFamily', () => {
    const plan = generateTownPlan(footprint, rootSeedPath(42), { population: 4000 });
    const fam = STYLE_FAMILIES.highlandStone;
    const { container } = render(<TownPlanView plan={plan} width={600} height={400} />);
    const fills = new Set(
      Array.from(container.querySelectorAll('path'))
        .map((el) => el.getAttribute('fill'))
        .filter(Boolean),
    );
    // highlandStone's greys don't coincide with the legacy BUILDING_FILL / fallback palette.
    expect(fam.wallPalette.some((c) => fills.has(c))).toBe(false);
    expect(container.querySelectorAll('[data-architecture-building-key]').length).toBe(0);
  });
});
