/**
 * @file previewDungeon/compositor.ts
 * @description The sheet compositor for the dungeon design preview (extracted
 * verbatim from PreviewDungeon.tsx): renderSheet lays the canonical ISO-A page —
 * aged-vellum substrate, title cartouche, the rotated map blit from drawMap, the
 * surveyor's rail (compass/scale/key), legend and frame — into a supersampled
 * buffer the viewport samples. SHEET_CSS_W / SHEET_CSS_H are the canonical page
 * footprint.
 */
import { type DungeonPlan, type DungeonRoom } from '../../../../systems/worldforge/dungeon/types';
import { SHEETS, type Overlays } from './theme';
import { hash2, keyedRooms } from './geometry';
import { drawMap } from './painter';

/** The finished sheet's canonical CSS footprint (ISO A portrait, 1:√2). The
 * sheet is always COMPOSED at this size; the interactive viewport ({@link
 * blitViewport}) samples a supersampled buffer of it, so zoom/pan never changes
 * how the sheet is drawn — only which part of it fills the visible canvas. */
export const SHEET_CSS_W = 800;
export const SHEET_CSS_H = Math.round(SHEET_CSS_W * Math.SQRT2);

/** Supersample factor for the offscreen sheet buffer. The whole sheet is drawn
 * ONCE at (device × this) resolution, then a zoom/pan window of it is blitted to
 * the screen. This is the entire crispness story: detail stays sharp when the
 * viewport magnifies, up to this factor, because we downsample real pixels
 * rather than upscaling screen pixels. ~2.75 keeps a burial gallery's coffins
 * and linework crisp to ~4× while bounding the buffer to a sane size (an 800×
 * 1131 sheet at dpr 2 becomes ~4400×6200 — a few hundred MB is avoided by the
 * ≤3 dpr clamp the caller already applies). */
const SHEET_SUPERSAMPLE = 2.75;

/**
 * Composites the sheet: one CANONICAL ISO-portrait page (1:√2) for every
 * dungeon — the frame is the constant, the art is the variable. The rotated
 * art bounding box is fit-and-centered between a boxed title cartouche and a
 * legend footer, with a guaranteed safe gap (≥6% of the short side) from both
 * the frame and the cartouche so the art never kisses either.
 *
 * Renders into (and RETURNS) a fresh offscreen buffer sized in DEVICE pixels ×
 * {@link SHEET_SUPERSAMPLE}, so it is sharp on HiDPI and holds enough real
 * pixels for the viewport to magnify without blur. Every drawing call below is
 * unchanged: the buffer's base transform bakes in the density, so all the WS1–8
 * work keeps composing in the same 800×1131 CSS coordinate space it always did.
 */
export function renderSheet(plan: DungeonPlan, ov: Overlays): HTMLCanvasElement {
  const sheet = SHEETS[plan.params.theme] ?? SHEETS.crypt;
  const dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  // Density the sheet is rasterized at = screen density × supersample headroom.
  const ss = dpr * SHEET_SUPERSAMPLE;

  const cssW = SHEET_CSS_W;
  const cssH = SHEET_CSS_H; // ISO A portrait
  const safe = Math.round(cssW * 0.06); // guaranteed art gap, both frame + cartouche

  // Seed cant: kept (hand-surveyed look) but clamped to ±4–9° so the rotated
  // bounding box wastes little corner space and never clips.
  const mag = 4 + (((plan.seed >>> 3) % 50) / 10);
  const angle = ((plan.seed & 1) === 0 ? 1 : -1) * (mag * Math.PI / 180);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));

  // Page furniture bands (deliberate, not floating chrome).
  const cartTop = 28;
  const cartH = 82;
  const legendBandH = 46;
  const artY0 = cartTop + cartH + safe;
  const artY1 = cssH - legendBandH - safe;
  // WS7: reserve a right MARGIN RAIL for the surveyor's furniture — the numbered
  // key panel, the compass rose, and the scale bar. The map fits to the left of
  // it, so the orientation furniture never collides with the art no matter the
  // plan's shape (the classic module-map map-left / key-right layout).
  const railW = 156;
  const railGap = Math.round(safe * 0.6);
  const railX = cssW - safe - railW;

  // WS8 composition rebalance: the rail furniture (compass + scale + key panel)
  // only fills the TOP of the right column; on a short key list it left a big
  // empty lower-right margin while the art stayed cramped map-left. So fit the
  // art into an L-shaped area — the better of two boxes — instead of always the
  // left-of-rail column:
  //   A) LEFT-OF-RAIL, full art height (the classic map-left / key-right).
  //   B) FULL PAGE WIDTH, but only BELOW where the rail furniture ends.
  // Whichever admits the larger cell wins, so a compact plan spreads wide into
  // the reclaimed width and drops to fill the lower margin, while a tall plan
  // keeps the side-by-side layout. `railBottom` estimates the furniture extent.
  const keyedCount = keyedRooms(plan).length;
  const compassBlockH = 6 + 34 * 2 + 4 + 16;                 // rose + gap
  const scaleBlockH = 12 + 6 + 20;                            // heading + bar + labels
  const keyPanelH = keyedCount > 0 ? 16 + 7 + keyedCount * 15 + 7 : 0;
  const railBottom = Math.min(artY1, artY0 + 6 + compassBlockH + scaleBlockH + keyPanelH);

  const denomW = plan.W * cos + plan.H * sin;
  const denomH = plan.W * sin + plan.H * cos;
  const cellFor = (aw: number, ah: number): number =>
    Math.min(13, Math.max(3, Math.floor(Math.min(aw / denomW, ah / denomH))));
  // Box A — left of the rail, full height.
  const aW = railX - railGap - safe;
  const aH = artY1 - artY0;
  const cellA = cellFor(aW, aH);
  // Box B — full width, below the rail furniture (only worth it if there is real
  // room under the furniture).
  const bY0 = railBottom + railGap;
  const bW = cssW - safe * 2;
  const bH = artY1 - bY0;
  const cellB = bH > 120 ? cellFor(bW, bH) : 0;

  const useB = cellB > cellA;
  const availW = useB ? bW : aW;
  const availH = useB ? bH : aH;
  const artX0 = safe; // both boxes start at the left safe margin
  const artTop = useB ? bY0 : artY0;

  // Fit: pick the cell size whose ROTATED bounding box fills the chosen art
  // area, then center; a fractional blit scale is the floor-guard so huge
  // plans can never overflow the page.
  const cell = useB ? cellB : cellA;
  const mapW = plan.W * cell;
  const mapH = plan.H * cell;
  const rotW = mapW * cos + mapH * sin;
  const rotH = mapW * sin + mapH * cos;
  const fit = Math.min(1, availW / rotW, availH / rotH);

  // The buffer we compose into (device pixels × supersample). Nothing about the
  // drawing below knows it is supersampled — the base transform hides it.
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(cssW * ss);
  canvas.height = Math.round(cssH * ss);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.setTransform(ss, 0, 0, ss, 0, 0);

  // ── Aged-vellum substrate (WS8) ─ the one texture that sells "a real map on
  // real stock". Layered, procedural (coord-hash — no Math.random), theme-WARM
  // (frost keeps warm paper, the cold lives in its ink), and a WHISPER under the
  // linework so the value ladder (walls ≫ floors ≫ this) survives. Build order:
  // warm base → low-frequency tonal mottle → fibre/tooth → a few foxing blotches
  // → a darkened deckle vignette creeping in from the border → corner stains.
  ctx.fillStyle = sheet.paper;
  ctx.fillRect(0, 0, cssW, cssH);
  // (1) low-frequency tonal variation — broad soft patches of warmer/cooler stock.
  for (let k = 0; k < 150; k++) {
    const bx = hash2(k, 11, plan.seed % 1000) * cssW;
    const by = hash2(k, 23, plan.seed % 1000) * cssH;
    const br = 14 + hash2(k, 31, 5) * 60;
    const g = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    const a = 0.012 + hash2(k, 41, 7) * 0.02;
    g.addColorStop(0, sheet.paperMottle.replace('1)', `${a})`));
    g.addColorStop(1, sheet.paperMottle.replace('1)', '0)'));
    ctx.fillStyle = g;
    ctx.fillRect(bx - br, by - br, br * 2, br * 2);
  }
  // (2) FIBRE / TOOTH — a dense scatter of hair-fine short strokes, half a touch
  // darker (fibre shadow) and half a touch lighter (raised tooth catching light),
  // so the stock reads laid, not printed. Alpha floored very low = felt, not seen.
  {
    const fibreDark = sheet.paperMottle.replace('1)', '0.05)');
    const fibreLite = `${sheet.roomShadeLight}, 0.06)`;
    ctx.lineCap = 'round';
    for (let k = 0; k < 1400; k++) {
      const fx = hash2(k, 3, plan.seed % 997) * cssW;
      const fy = hash2(k, 5, plan.seed % 997) * cssH;
      const ang = hash2(k, 7, 13) * Math.PI; // laid roughly along the sheet
      const len = 3 + hash2(k, 9, 17) * 7;
      ctx.strokeStyle = hash2(k, 2, 19) < 0.5 ? fibreDark : fibreLite;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(fx - Math.cos(ang) * len * 0.5, fy - Math.sin(ang) * len * 0.5);
      ctx.lineTo(fx + Math.cos(ang) * len * 0.5, fy + Math.sin(ang) * len * 0.5);
      ctx.stroke();
    }
  }
  // (3) FOXING — a few soft irregular age-blotches (the brown speckle old paper
  // grows), each a lobed low-alpha stain, placed off the art's busy centre band.
  for (let k = 0; k < 7; k++) {
    const sx = (0.08 + hash2(k, 51, plan.seed % 900) * 0.84) * cssW;
    const sy = (0.08 + hash2(k, 57, plan.seed % 900) * 0.84) * cssH;
    const sr = 10 + hash2(k, 61, 3) * 26;
    const lobes = 7;
    ctx.fillStyle = `${sheet.cornerStain}, ${(0.03 + hash2(k, 63, 5) * 0.04).toFixed(3)})`;
    ctx.beginPath();
    for (let s = 0; s <= lobes; s++) {
      const a = (s / lobes) * Math.PI * 2;
      const rr = sr * (0.6 + hash2(k, 65 + s, 7) * 0.6);
      const xx = sx + Math.cos(a) * rr;
      const yy = sy + Math.sin(a) * rr * 0.8;
      if (s === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.closePath();
    ctx.fill();
  }
  // (4) DECKLE VIGNETTE — age darkening creeping IN from the border, inside the
  // frame: four edge gradients that fade to nothing ~9% in, so the sheet looks
  // worn at its deckle without a round photo-vignette (which the header forbids).
  {
    const inset = 15; // just inside the double-rule frame
    const band = Math.round(cssW * 0.11);
    const deckle = (x0: number, y0: number, x1: number, y1: number): void => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `${sheet.cornerStain}, 0.14)`);
      g.addColorStop(0.5, `${sheet.cornerStain}, 0.03)`);
      g.addColorStop(1, `${sheet.cornerStain}, 0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, cssW, cssH);
    };
    deckle(inset, 0, inset + band, 0);                 // left
    deckle(cssW - inset, 0, cssW - inset - band, 0);   // right
    deckle(0, inset, 0, inset + band);                 // top
    deckle(0, cssH - inset, 0, cssH - inset - band);   // bottom
  }
  // (5) corner stains — the darkest age pooling at the four dog-eared corners.
  const stain = (gx0: number, gy0: number, gx1: number, gy1: number): void => {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, `${sheet.cornerStain}, 0.12)`);
    g.addColorStop(1, `${sheet.cornerStain}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
  };
  stain(0, 0, 52, 52);
  stain(cssW, 0, cssW - 52, 52);
  stain(0, cssH, 52, cssH - 52);
  stain(cssW, cssH, cssW - 52, cssH - 52);

  // Title cartouche: a FRAMED panel — derived name + blurb inside deliberate
  // rule-work, sized to its content and centered on the page. The header spans
  // the FULL page width (it sits above the art + rail band, so the rail does not
  // constrain it).
  const headW = cssW - safe * 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let titleSize = 26;
  ctx.font = `700 ${titleSize}px Georgia, 'Times New Roman', serif`;
  while (titleSize > 15 && ctx.measureText(plan.name).width > headW - 96) {
    titleSize -= 1;
    ctx.font = `700 ${titleSize}px Georgia, 'Times New Roman', serif`;
  }
  const titleW = ctx.measureText(plan.name).width;
  let blurbSize = Math.max(10, Math.round(titleSize * 0.46));
  ctx.font = `italic 400 ${blurbSize}px Georgia, serif`;
  while (blurbSize > 9 && ctx.measureText(plan.blurb).width > headW - 60) {
    blurbSize -= 1;
    ctx.font = `italic 400 ${blurbSize}px Georgia, serif`;
  }
  const blurbW = ctx.measureText(plan.blurb).width;
  const cartW = Math.min(headW, Math.max(titleW, blurbW) + 64);
  const cartX = (cssW - cartW) / 2;
  ctx.strokeStyle = sheet.ink;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(cartX + 0.5, cartTop + 0.5, cartW, cartH);
  ctx.lineWidth = 0.7;
  ctx.strokeRect(cartX + 4.5, cartTop + 4.5, cartW - 8, cartH - 8);
  ctx.globalAlpha = 1;
  ctx.fillStyle = sheet.ink;
  ctx.font = `700 ${titleSize}px Georgia, 'Times New Roman', serif`;
  ctx.fillText(plan.name, cssW / 2, cartTop + cartH * 0.38);
  ctx.strokeStyle = sheet.ink;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(cssW / 2 - titleW * 0.32, cartTop + cartH * 0.585);
  ctx.lineTo(cssW / 2 + titleW * 0.32, cartTop + cartH * 0.585);
  ctx.stroke();
  ctx.globalAlpha = 0.7;
  ctx.font = `italic 400 ${blurbSize}px Georgia, serif`;
  ctx.fillText(plan.blurb, cssW / 2, cartTop + cartH * 0.76);
  ctx.globalAlpha = 1;

  // Rotated map blit — fit-and-centered in the chosen art area (left-of-rail, or
  // full-width-below-furniture when that reclaims the empty lower margin).
  const artCx = artX0 + availW / 2;
  const artCy = artTop + availH / 2;
  const off = document.createElement('canvas');
  drawMap(off, plan, ov, cell, ss);
  ctx.save();
  ctx.translate(artCx, artCy);
  ctx.rotate(angle);
  ctx.drawImage(off, 0, 0, off.width, off.height, -(mapW * fit) / 2, -(mapH * fit) / 2, mapW * fit, mapH * fit);
  ctx.restore();

  // ── WS7 surveyor's furniture in the right margin rail ──────────────────────
  // A coherent type system across the whole rail (small-caps serif labels, a
  // tabular numeral column) shared with the cartouche + legend, so the compass,
  // scale bar, and numbered key read as one cartographer's hand. Top→bottom:
  // compass rose, scale bar, then the numbered key panel filling what remains.
  const railCx = railX + railW / 2;
  let railCursor = artY0 + 6;
  const inkA = (a: number): void => { ctx.strokeStyle = sheet.ink; ctx.globalAlpha = a; };

  // (A) COMPASS ROSE — north is HONEST: the map is blitted at `angle`, so map-
  // north (up in map space) points on the page at screen-angle `angle` from
  // vertical. The needle is rotated to match, so it tracks the plan's cant.
  {
    const cr = 34;
    const ccx = railCx;
    const ccy = railCursor + cr + 4;
    // face
    ctx.fillStyle = `${sheet.roomShadeLight}, 0.5)`;
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
    ctx.fill();
    inkA(0.7);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 0.7;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(ccx, ccy, cr * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // tick marks every 45°, canted with the map
    ctx.save();
    ctx.translate(ccx, ccy);
    ctx.rotate(angle);
    inkA(0.5);
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4;
      const inner = k % 2 === 0 ? cr * 0.78 : cr * 0.86;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * inner, -Math.cos(a) * inner);
      ctx.lineTo(Math.sin(a) * cr * 0.96, -Math.cos(a) * cr * 0.96);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // the four-point star needle: N half filled ink, S half hollow.
    const needle = (len: number, wide: number): void => {
      ctx.beginPath();
      ctx.moveTo(0, -len);
      ctx.lineTo(wide, 0);
      ctx.lineTo(0, len);
      ctx.lineTo(-wide, 0);
      ctx.closePath();
    };
    // E-W arm (hollow, thin)
    ctx.save();
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = `${sheet.roomShadeLight}, 0.85)`;
    needle(cr * 0.62, cr * 0.12);
    ctx.fill();
    inkA(0.6); ctx.lineWidth = 0.8; needle(cr * 0.62, cr * 0.12); ctx.stroke();
    ctx.restore();
    // N-S arm: N solid accent-tipped ink, S hollow.
    ctx.globalAlpha = 1;
    // south half (hollow)
    ctx.fillStyle = `${sheet.roomShadeLight}, 0.9)`;
    ctx.beginPath();
    ctx.moveTo(0, cr * 0.72);
    ctx.lineTo(cr * 0.15, 0);
    ctx.lineTo(-cr * 0.15, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = sheet.ink; ctx.lineWidth = 1; ctx.stroke();
    // north half (solid ink, accent tip)
    ctx.fillStyle = sheet.ink;
    ctx.beginPath();
    ctx.moveTo(0, -cr * 0.82);
    ctx.lineTo(cr * 0.15, 0);
    ctx.lineTo(-cr * 0.15, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = sheet.accent;
    ctx.beginPath();
    ctx.moveTo(0, -cr * 0.82);
    ctx.lineTo(cr * 0.09, -cr * 0.5);
    ctx.lineTo(-cr * 0.09, -cr * 0.5);
    ctx.closePath();
    ctx.fill();
    // N letter riding just outside the ring, canted with the rose
    ctx.fillStyle = sheet.ink;
    ctx.font = `700 12px Georgia, 'Times New Roman', serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('N', 0, -cr - 8);
    ctx.restore();
    railCursor = ccy + cr + 16;
  }

  // (B) SCALE BAR — an honest graphic scale on the 5 ft cell basis at the map's
  // fitted cell size. A "nice" round division (10/20/25/50 ft) is chosen so each
  // span is wide enough to label without collision; only 0, the first division,
  // and the end carry a number (interior ticks stay unlabelled) so the ruler
  // reads clean. Alternating filled/empty spans, ticked, "… ft" on the end.
  {
    const pxPerFt = (cell * fit) / plan.cellFt; // page px per foot at the blit scale
    // pick the division whose pixel width is a comfortable ≥30px for a label.
    const nice = [10, 20, 25, 50, 100];
    let spanFt = nice[0];
    for (const n of nice) { spanFt = n; if (n * pxPerFt >= 30) break; }
    const spanPx = spanFt * pxPerFt;
    const maxSpans = Math.max(1, Math.min(4, Math.floor((railW - 20) / spanPx)));
    const barW = spanPx * maxSpans;
    const barH = 6;
    const bx = railCx - barW / 2;
    const by = railCursor + 12;
    // heading (shared italic voice with the cartouche blurb)
    ctx.fillStyle = sheet.ink;
    ctx.font = `italic 400 9px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 0.7;
    ctx.fillText('scale', railCx, by - 5);
    ctx.globalAlpha = 1;
    // bar body: alternating fill
    for (let s = 0; s < maxSpans; s++) {
      ctx.fillStyle = s % 2 === 0 ? sheet.ink : `${sheet.roomShadeLight}, 0.9)`;
      ctx.fillRect(bx + s * spanPx, by, spanPx, barH);
    }
    inkA(0.8);
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 0.5, by + 0.5, barW, barH);
    ctx.globalAlpha = 1;
    // ticks on every division; labels only where they will not collide.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `600 8.5px Georgia, serif`;
    for (let s = 0; s <= maxSpans; s++) {
      const lx = bx + s * spanPx;
      inkA(0.6);
      ctx.beginPath();
      ctx.moveTo(lx, by - 2);
      ctx.lineTo(lx, by + barH + 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // label 0, the first division, and the end (skip crowded interior ticks).
      const labelled = s === 0 || s === 1 || s === maxSpans;
      if (!labelled) continue;
      ctx.fillStyle = sheet.ink;
      ctx.globalAlpha = 0.85;
      const lbl = s === maxSpans ? `${s * spanFt} ft` : String(s * spanFt);
      ctx.fillText(lbl, lx, by + barH + 3);
      ctx.globalAlpha = 1;
    }
    railCursor = by + barH + 20;
  }

  // (C) NUMBERED KEY PANEL — the map's discs, indexed. A boxed legend seated in
  // the rar margin: each keyed room's number beside a terse label (the way-in
  // and the objective flagged with ▾/★), so the reader learns the disc language
  // here. Full DM notes stay in the DOM list below the sheet; this is the map's
  // own key. The disc numbers on the map match these rows exactly.
  {
    const keyed = keyedRooms(plan);
    if (keyed.length > 0) {
      const panelX = railX;
      const panelY = railCursor;
      const panelW = railW;
      const rowH = 15;
      const headH = 16;
      const pad = 7;
      const panelH = Math.min(artY1 - panelY, headH + pad + keyed.length * rowH + pad);
      const maxRows = Math.max(1, Math.floor((panelH - headH - pad * 2) / rowH));
      // panel ground + frame
      ctx.fillStyle = `${sheet.roomShadeLight}, 0.42)`;
      ctx.fillRect(panelX, panelY, panelW, panelH);
      inkA(0.7);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW, panelH);
      ctx.lineWidth = 0.6;
      ctx.globalAlpha = 0.4;
      ctx.strokeRect(panelX + 3.5, panelY + 3.5, panelW - 6, panelH - 6);
      ctx.globalAlpha = 1;
      // header
      ctx.fillStyle = sheet.ink;
      ctx.font = `700 9px Georgia, serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.85;
      // letter-spaced small-caps feel via manual spacing
      ctx.fillText('K E Y', panelX + pad, panelY + headH * 0.62);
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(panelX + pad, panelY + headH + 1.5);
      ctx.lineTo(panelX + panelW - pad, panelY + headH + 1.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // rows
      const label = (r: DungeonRoom): string => {
        if (r.type === 'boss') return 'objective';
        if (r.type === 'entrance') return 'entrance';
        return r.purpose.replace(/-/g, ' ');
      };
      const numColX = panelX + pad + 8;
      const txtColX = panelX + pad + 20;
      const shown = Math.min(keyed.length, maxRows);
      for (let i = 0; i < shown; i++) {
        const r = keyed[i];
        const ry = panelY + headH + pad + i * rowH + rowH * 0.5;
        const isBoss = r.type === 'boss';
        const isEnt = r.type === 'entrance';
        // number disc (mirrors the map marker style, small)
        const dr = 6;
        ctx.fillStyle = sheet.ink;
        ctx.beginPath();
        ctx.arc(numColX, ry, dr, 0, Math.PI * 2);
        ctx.fill();
        if (isBoss || isEnt) {
          ctx.strokeStyle = isBoss ? sheet.accent : sheet.ink;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(numColX, ry, dr + 1.6, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = sheet.floor;
        ctx.font = `700 8.5px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), numColX, ry + 0.5);
        // glyph + label
        ctx.textAlign = 'left';
        ctx.fillStyle = sheet.ink;
        ctx.globalAlpha = 0.9;
        const glyph = isBoss ? '★ ' : isEnt ? '▾ ' : '';
        ctx.font = `${isBoss || isEnt ? '700' : '400'} 9px Georgia, serif`;
        let lbl = glyph + label(r);
        // truncate to fit
        while (lbl.length > 3 && ctx.measureText(lbl).width > panelW - (txtColX - panelX) - pad) {
          lbl = lbl.slice(0, -2) + '…';
        }
        ctx.fillText(lbl, txtColX, ry + 0.5);
        ctx.globalAlpha = 1;
      }
      if (keyed.length > shown) {
        ctx.fillStyle = sheet.ink;
        ctx.globalAlpha = 0.6;
        ctx.font = `italic 400 8px Georgia, serif`;
        ctx.textAlign = 'left';
        ctx.fillText(`+${keyed.length - shown} more below`, panelX + pad, panelY + panelH - 6);
        ctx.globalAlpha = 1;
      }
    }
  }

  // Legend footer: page furniture seated on the base of the sheet. The SYMBOL
  // glossary only — the compass owns orientation, the scale bar owns the 5 ft
  // basis, and the boxed key panel owns entrance/objective, so the footer no
  // longer repeats them (one voice, no duplication). Same serif hand as the rail.
  const legend = '▾ entrance   ★ objective   S secret door   △ trap   ▦ red brick = walled up';
  const legendY = cssH - legendBandH * 0.75;
  ctx.fillStyle = sheet.ink;
  ctx.font = '400 11px Georgia, serif';
  ctx.globalAlpha = 0.75;
  ctx.fillText(legend, cssW / 2, legendY + 7);
  const legW = ctx.measureText(legend).width;
  ctx.strokeStyle = sheet.ink;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(cssW / 2 - legW / 2 - 14, legendY - 7);
  ctx.lineTo(cssW / 2 + legW / 2 + 14, legendY - 7);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Double-rule cartographic frame.
  ctx.strokeStyle = sheet.ink;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(8.5, 8.5, cssW - 17, cssH - 17);
  ctx.lineWidth = 0.8;
  ctx.strokeRect(13.5, 13.5, cssW - 27, cssH - 27);
  ctx.globalAlpha = 1;

  return canvas;
}
