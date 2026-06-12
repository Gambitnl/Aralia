/**
 * @file renderTownProof.ts — headless proof renderer for L2 town plan generator.
 *
 * Directive C3 verification: produces PNGs showing organic street networks,
 * plots, envelopes, and gates — LEGIBLE per verifier C2 note.
 *
 * Three proofs:
 * - laneC3-town-hamlet.png: small envelope, 2 gates, few streets/plots
 * - laneC3-town-city.png: large envelope, 5 gates, many streets/plots
 * - laneC3-town-overlay.png: city plan overlaid on region terrain
 *
 * Technique: Playwright canvas pattern.
 * Usage: npx tsx scripts/worldforge/renderTownProof.ts
 * Output: docs/projects/worldforge/orchestration/proof/laneC3-*.png
 *
 * What changed: new script (directive C3).
 */
import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateTownPlan } from '../../src/systems/worldforge/town/generateTownPlan';
import { generateFmgWorld } from '../../src/systems/worldforge/fmg/generateWorld';
import { generateRegion, expandRegionMembership } from '../../src/systems/worldforge/region/generateRegion';
import { rootSeedPath } from '../../src/systems/worldforge/seedPath';
import type { TownPlan, RegionTownSite, RegionArtifact } from '../../src/systems/worldforge/artifacts';
import type { BoundsFt, Feet } from '../../src/systems/worldforge/units';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROOF_DIR = path.resolve(__dirname, '../../docs/projects/worldforge/orchestration/proof');

const W = 960;
const H = 720;
const WORLD_SEED = 42;
const FEET_PER_PIXEL = 9842.52;

function makeSite(
  envelopeSize: number,
  gateCount: number,
  burgId: number,
): RegionTownSite {
  const env: BoundsFt = {
    x: 100000,
    y: 200000,
    width: envelopeSize,
    height: envelopeSize,
  };
  const gates: Array<[Feet, Feet]> = [];
  const cx = env.x + env.width / 2;
  const cy = env.y + env.height / 2;
  for (let i = 0; i < gateCount; i++) {
    const angle = (i / gateCount) * Math.PI * 2 - Math.PI / 2;
    gates.push([
      cx + Math.cos(angle) * (envelopeSize / 2),
      cy + Math.sin(angle) * (envelopeSize / 2),
    ]);
  }
  return { burgId, envelope: env, gates };
}

/**
 * Render a standalone town plan proof (white background, streets + plots + gates).
 */
async function renderTownPlan(
  plan: TownPlan,
  site: RegionTownSite,
  label: string,
  outPath: string,
): Promise<void> {
  const env = site.envelope;
  const padding = env.width * 0.1;
  const viewBounds = {
    x: env.x - padding,
    y: env.y - padding,
    width: env.width + padding * 2,
    height: env.height + padding * 2,
  };

  function toCanvas(ftX: number, ftY: number): [number, number] {
    return [
      (ftX - viewBounds.x) / viewBounds.width * W,
      (ftY - viewBounds.y) / viewBounds.height * H,
    ];
  }

  // Prepare street data
  // TRUE-scale street widths (the ×4 exaggeration made the hamlet an
  // illegible blob — C2 legibility note). Min 2 px so trails stay visible.
  const streetData = plan.streets.map((s) => ({
    pts: s.centerline.flatMap(([x, y]) => toCanvas(x, y)),
    width: Math.max(2, s.widthFt / viewBounds.width * W),
    id: s.id,
  }));

  // Prepare plot data
  const plotData = plan.plots.map((p) => ({
    pts: p.footprint.flatMap(([x, y]) => toCanvas(x, y)),
    role: p.role,
  }));

  // Prepare gate data
  const gateData = site.gates.map(([x, y], i) => {
    const [cx, cy] = toCanvas(x, y);
    return { x: cx, y: cy, label: `G${i}` };
  });

  // Envelope in canvas coords
  const [envX, envY] = toCanvas(env.x, env.y);
  const [envX2, envY2] = toCanvas(env.x + env.width, env.y + env.height);
  const envW = envX2 - envX;
  const envH = envY2 - envY;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(`<canvas id="c" width="${W}" height="${H}" style="display:block;background:#f5f0e8"></canvas>`);

  await page.evaluate(
    ({ streetData, plotData, gateData, envX, envY, envW, envH, label, W, H }) => {
      const canvas = document.getElementById('c') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;

      // Background
      ctx.fillStyle = '#f5f0e8';
      ctx.fillRect(0, 0, W, H);

      // Envelope fill (translucent)
      ctx.fillStyle = 'rgba(180, 160, 120, 0.15)';
      ctx.fillRect(envX, envY, envW, envH);

      // Envelope outline (bold)
      ctx.strokeStyle = '#8B4513';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 6]);
      ctx.strokeRect(envX, envY, envW, envH);
      ctx.setLineDash([]);

      // Plots (filled quads)
      for (const plot of plotData) {
        const pts = plot.pts;
        ctx.beginPath();
        ctx.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) {
          ctx.lineTo(pts[i], pts[i + 1]);
        }
        ctx.closePath();
        if (plot.role === 'market') {
          ctx.fillStyle = 'rgba(200, 150, 50, 0.7)';
          ctx.strokeStyle = '#8B6914';
        } else {
          ctx.fillStyle = 'rgba(180, 100, 80, 0.5)';
          ctx.strokeStyle = '#6B3A2A';
        }
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Streets (bold lines — primary wider than secondary)
      for (const street of streetData) {
        const isPrimary = street.width > 4;
        // Street casing
        ctx.strokeStyle = '#2a2a2a';
        ctx.lineWidth = street.width + 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(street.pts[0], street.pts[1]);
        for (let i = 2; i < street.pts.length; i += 2) {
          ctx.lineTo(street.pts[i], street.pts[i + 1]);
        }
        ctx.stroke();
        // Street fill
        ctx.strokeStyle = isPrimary ? '#e8d8a0' : '#d4c89a';
        ctx.lineWidth = street.width;
        ctx.beginPath();
        ctx.moveTo(street.pts[0], street.pts[1]);
        for (let i = 2; i < street.pts.length; i += 2) {
          ctx.lineTo(street.pts[i], street.pts[i + 1]);
        }
        ctx.stroke();
      }

      // Gates (labeled dots)
      for (const gate of gateData) {
        ctx.fillStyle = '#228B22';
        ctx.beginPath();
        ctx.arc(gate.x, gate.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Label
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(gate.label, gate.x + 10, gate.y + 4);
      }

      // Label bar
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(4, 4, 440, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(label, 8, 18);
    },
    { streetData, plotData, gateData, envX, envY, envW, envH, label, W, H },
  );

  await page.locator('#c').screenshot({ path: outPath });
  console.log(`Wrote ${outPath}`);
  await browser.close();
}

/**
 * Render town plan overlay on region terrain.
 */
async function renderTownOverlay(
  region: RegionArtifact,
  plan: TownPlan,
  site: RegionTownSite,
  label: string,
  outPath: string,
  atlasData: { cellPoints: Array<[number, number]>; cellHeights: Uint8Array | Uint16Array | Uint32Array; memberCells: number[]; feetPerPixel: number },
): Promise<void> {
  const { heightfield, rivers, bounds } = region;
  const { width: gw, height: gh, samples } = heightfield;

  // Local hypsometry
  let localMin = Infinity, localMax = -Infinity;
  for (let i = 0; i < samples.length; i++) {
    localMin = Math.min(localMin, samples[i]);
    localMax = Math.max(localMax, samples[i]);
  }
  const range = localMax - localMin || 1;

  // Water mask
  const waterMask = new Uint8Array(gw * gh);
  const memberData = atlasData.memberCells.map((id) => ({
    x: atlasData.cellPoints[id][0] * atlasData.feetPerPixel,
    y: atlasData.cellPoints[id][1] * atlasData.feetPerPixel,
    h: atlasData.cellHeights[id] / 100,
  }));
  for (let row = 0; row < gh; row++) {
    const sy = bounds.y + row * heightfield.resolutionFt;
    for (let col = 0; col < gw; col++) {
      const sx = bounds.x + col * heightfield.resolutionFt;
      let nearestDist = Infinity, nearestH = 1;
      for (const cell of memberData) {
        const dx = sx - cell.x, dy = sy - cell.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < nearestDist) { nearestDist = d2; nearestH = cell.h; }
      }
      if (nearestH < 0.2) waterMask[row * gw + col] = 1;
    }
  }

  // Hillshade
  const shade = new Float32Array(gw * gh);
  for (let row = 1; row < gh - 1; row++) {
    for (let col = 1; col < gw - 1; col++) {
      const idx = row * gw + col;
      const dzdx = (samples[idx + 1] - samples[idx - 1]) / 2;
      const dzdy = (samples[idx + gw] - samples[idx - gw]) / 2;
      shade[idx] = Math.max(0.4, Math.min(1.6, 1.0 + (dzdx * -0.7 + dzdy * -0.7) * 15));
    }
  }
  for (let i = 0; i < gw * gh; i++) if (!shade[i]) shade[i] = 1.0;

  // Terrain pixels
  const pixels = new Uint8Array(gw * gh * 4);
  for (let i = 0; i < samples.length; i++) {
    const h = samples[i];
    const t = (h - localMin) / range;
    const s = shade[i];
    let r: number, g: number, b: number;
    if (waterMask[i]) {
      r = Math.round((20 + 40 * t) * s);
      g = Math.round((50 + 80 * t) * s);
      b = Math.round((100 + 90 * t) * s);
    } else if (t < 0.3) {
      r = Math.round((50 + 50 * (t / 0.3)) * s);
      g = Math.round((110 + 30 * (t / 0.3)) * s);
      b = Math.round((30 + 20 * (t / 0.3)) * s);
    } else if (t < 0.6) {
      const lt = (t - 0.3) / 0.3;
      r = Math.round((100 + 60 * lt) * s); g = Math.round((140 - 50 * lt) * s); b = Math.round((50 - 20 * lt) * s);
    } else if (t < 0.85) {
      const lt = (t - 0.6) / 0.25;
      r = Math.round((160 - 20 * lt) * s); g = Math.round((90 + 30 * lt) * s); b = Math.round((30 + 60 * lt) * s);
    } else {
      const lt = (t - 0.85) / 0.15;
      r = Math.round((140 + 115 * lt) * s); g = Math.round((120 + 135 * lt) * s); b = Math.round((90 + 165 * lt) * s);
    }
    pixels[i * 4] = Math.min(255, Math.max(0, r));
    pixels[i * 4 + 1] = Math.min(255, Math.max(0, g));
    pixels[i * 4 + 2] = Math.min(255, Math.max(0, b));
    pixels[i * 4 + 3] = 255;
  }

  // River bands (mapped into the cropped view below, after viewBounds exists)
  const riverBands: Array<{ pts: number[]; w: number }> = [];

  // Town plan in canvas coords. The view is CROPPED to ~2.5× the envelope
  // (not the whole 25,000 ft region) so the plan actually reads — at full
  // region zoom a 1,600 ft town is a 60 px speck (C2 legibility note).
  const env = site.envelope;
  const padX = env.width * 0.75;
  const padY = env.height * 0.75;
  const viewBounds = {
    x: env.x - padX,
    y: env.y - padY,
    width: env.width + padX * 2,
    height: env.height + padY * 2,
  };
  const vx = (x: number) => (x - viewBounds.x) / viewBounds.width * W;
  const vy = (y: number) => (y - viewBounds.y) / viewBounds.height * H;

  // Terrain source rect (heightfield pixel coords) for the cropped view
  const srcRect = {
    x: (viewBounds.x - bounds.x) / bounds.width * gw,
    y: (viewBounds.y - bounds.y) / bounds.height * gh,
    w: viewBounds.width / bounds.width * gw,
    h: viewBounds.height / bounds.height * gh,
  };

  const envRect = {
    x: vx(env.x),
    y: vy(env.y),
    w: env.width / viewBounds.width * W,
    h: env.height / viewBounds.height * H,
  };

  const streetLines = plan.streets.map((s) => ({
    pts: s.centerline.flatMap(([x, y]) => [vx(x), vy(y)]),
    width: Math.max(1.5, s.widthFt / viewBounds.width * W),
  }));

  const plotPolys = plan.plots.map((p) => ({
    pts: p.footprint.flatMap(([x, y]) => [vx(x), vy(y)]),
    role: p.role,
  }));

  const gateDots = site.gates.map(([x, y], i) => ({
    x: vx(x),
    y: vy(y),
    label: `G${i}`,
  }));

  for (const bank of rivers) {
    const pts: number[] = [];
    for (const [fx, fy] of bank.centerline) pts.push(vx(fx), vy(fy));
    const w = Math.max(3, bank.widthFt / viewBounds.width * W);
    if (pts.length >= 4) riverBands.push({ pts, w });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  await page.setContent(`<canvas id="c" width="${W}" height="${H}" style="display:block"></canvas>`);

  await page.evaluate(
    ({ pixelsArr, gw, gh, srcRect, riverBands, envRect, streetLines, plotPolys, gateDots, label }) => {
      const canvas = document.getElementById('c') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;

      // Terrain — blit only the cropped sub-window around the town
      const imgData = ctx.createImageData(gw, gh);
      imgData.data.set(new Uint8Array(pixelsArr));
      const off = document.createElement('canvas');
      off.width = gw; off.height = gh;
      off.getContext('2d')!.putImageData(imgData, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#0c1824';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(off, srcRect.x, srcRect.y, srcRect.w, srcRect.h, 0, 0, canvas.width, canvas.height);

      // Rivers
      for (const r of riverBands) {
        ctx.strokeStyle = 'rgba(60,120,180,0.3)'; ctx.lineWidth = r.w * 2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(r.pts[0], r.pts[1]);
        for (let i = 2; i < r.pts.length; i += 2) ctx.lineTo(r.pts[i], r.pts[i + 1]);
        ctx.stroke();
        ctx.strokeStyle = '#2a6090'; ctx.lineWidth = r.w;
        ctx.beginPath(); ctx.moveTo(r.pts[0], r.pts[1]);
        for (let i = 2; i < r.pts.length; i += 2) ctx.lineTo(r.pts[i], r.pts[i + 1]);
        ctx.stroke();
      }

      // Envelope
      ctx.fillStyle = 'rgba(255,220,150,0.2)';
      ctx.fillRect(envRect.x, envRect.y, envRect.w, envRect.h);
      ctx.strokeStyle = '#ff4444';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 5]);
      ctx.strokeRect(envRect.x, envRect.y, envRect.w, envRect.h);
      ctx.setLineDash([]);

      // Plots
      for (const p of plotPolys) {
        ctx.beginPath(); ctx.moveTo(p.pts[0], p.pts[1]);
        for (let i = 2; i < p.pts.length; i += 2) ctx.lineTo(p.pts[i], p.pts[i + 1]);
        ctx.closePath();
        ctx.fillStyle = p.role === 'market' ? 'rgba(200,150,50,0.7)' : 'rgba(180,100,80,0.5)';
        ctx.fill();
        ctx.strokeStyle = '#6B3A2A'; ctx.lineWidth = 1; ctx.stroke();
      }

      // Streets
      for (const s of streetLines) {
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = s.width + 2;
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(s.pts[0], s.pts[1]);
        for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i], s.pts[i + 1]);
        ctx.stroke();
        ctx.strokeStyle = '#e8d8a0'; ctx.lineWidth = s.width;
        ctx.beginPath(); ctx.moveTo(s.pts[0], s.pts[1]);
        for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(s.pts[i], s.pts[i + 1]);
        ctx.stroke();
      }

      // Gates
      for (const g of gateDots) {
        ctx.fillStyle = '#228B22';
        ctx.beginPath(); ctx.arc(g.x, g.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace';
        ctx.fillText(g.label, g.x + 8, g.y + 4);
      }

      // Label
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(4, 4, 440, 24);
      ctx.fillStyle = '#fff'; ctx.font = '12px monospace';
      ctx.fillText(label, 8, 18);
    },
    {
      pixelsArr: Array.from(pixels), gw, gh, srcRect, riverBands, envRect,
      streetLines, plotPolys, gateDots, label,
    },
  );

  await page.locator('#c').screenshot({ path: outPath });
  console.log(`Wrote ${outPath}`);
  await browser.close();
}

// ── Main ────────────────────────────────────────────────────────────────────

(async () => {
  const worldPath = rootSeedPath(WORLD_SEED);

  // 1. Hamlet
  console.log('Generating hamlet town plan...');
  const hamletSite = makeSite(800, 2, 10);
  const hamletPlan = generateTownPlan(hamletSite, worldPath);
  console.log(`  Hamlet: ${hamletPlan.streets.length} streets, ${hamletPlan.plots.length} plots`);
  await renderTownPlan(
    hamletPlan, hamletSite,
    `C3 Hamlet | ${hamletPlan.streets.length} streets, ${hamletPlan.plots.length} plots`,
    path.join(PROOF_DIR, 'laneC3-town-hamlet.png'),
  );

  // 2. City
  console.log('Generating city town plan...');
  const citySite = makeSite(4000, 5, 20);
  const cityPlan = generateTownPlan(citySite, worldPath);
  console.log(`  City: ${cityPlan.streets.length} streets, ${cityPlan.plots.length} plots`);
  await renderTownPlan(
    cityPlan, citySite,
    `C3 City | ${cityPlan.streets.length} streets, ${cityPlan.plots.length} plots`,
    path.join(PROOF_DIR, 'laneC3-town-city.png'),
  );

  // 3. Overlay on region terrain
  console.log('Generating world for overlay...');
  const world = generateFmgWorld('world-42', {
    width: 960, height: 540, cellsDesired: 10000, template: 'continents',
  });

  // Find a burg cell for the overlay
  let burgAnchor = -1;
  for (let i = 0; i < world.pack.cells.h.length; i++) {
    if (world.pack.cells.burg && world.pack.cells.burg[i] > 0 && world.pack.cells.h[i] >= 20) {
      burgAnchor = i;
      break;
    }
  }
  if (burgAnchor < 0) throw new Error('No burg cell found');

  console.log(`Generating region for cell:${burgAnchor}...`);
  const region = generateRegion(world, burgAnchor, worldPath, {
    feetPerPixel: FEET_PER_PIXEL,
    resolutionFt: 100,
    world,
  });

  // Use the first town site from the region for the overlay
  if (region.townSites.length === 0) {
    console.warn('No town sites in region — using a synthetic site for overlay');
  }

  const overlaySite = region.townSites.length > 0
    ? region.townSites[0]
    : citySite;
  const overlayPlan = region.townSites.length > 0
    ? generateTownPlan(overlaySite, worldPath)
    : cityPlan;

  const memberCells = expandRegionMembership(
    world.pack.cells.c, burgAnchor, world.pack.cells.p, FEET_PER_PIXEL,
  );

  console.log(`Generating overlay proof...`);
  await renderTownOverlay(
    region, overlayPlan, overlaySite,
    `C3 Overlay cell:${burgAnchor} | ${overlayPlan.streets.length} streets, ${overlayPlan.plots.length} plots`,
    path.join(PROOF_DIR, 'laneC3-town-overlay.png'),
    {
      cellPoints: world.pack.cells.p,
      cellHeights: world.pack.cells.h,
      memberCells,
      feetPerPixel: FEET_PER_PIXEL,
    },
  );

  console.log('Town proof rendering complete.');
})();
