#!/usr/bin/env node
/**
 * @file scripts/visual/frame-stats.mjs
 *
 * Quantitative capture analyzer for the 3D visual-quality program.
 *
 * WHY: capture-based visual review requires a vision-capable model to "read" a
 * frame. Not every review session has one (this session's model cannot see
 * images). The program's own rule is that visual claims are judged on captured
 * frames, never from opinion. This tool gives every builder/critic an objective,
 * reproducible, non-visual read of a rendered frame so a claim like "half the
 * frame is dead pure-black" or "the darkness has a cool tint" is a NUMBER, not
 * an impression. It is the measurement half of the verifier; the vision half
 * still must confirm craft quality, and this tool never substitutes for it.
 *
 * USAGE:
 *   node scripts/visual/frame-stats.mjs <png> [<png> ...]
 *   node scripts/visual/frame-stats.mjs --json a.png b.png > out.json
 *
 * OUTPUT (per image), all over the luma (Rec.709) axis 0-255:
 *   - p1/p5/p10/p50/p90/p95/p99  luma percentiles
 *   - meanLuma
 *   - darkFrac   = fraction of pixels with luma < 10  (index 0-9)
 *   - blackFrac  = fraction with luma <= 0 (pure zero)
 *   - lowFrac    = fraction with luma < 64  (the "dead darks" band)
 *   - darkRGB    = mean R/G/B of pixels with luma < 24, i.e. the TINT of the
 *                  darkness floor — a cool crypt gloom has B > R; a flat black
 *                  floor has R==G==B and a very dark mean.
 *   - satFrac    = fraction of pixels with meaningful chroma (colorfulness)
 *
 * The metrics are computed with sharp on the decoded RGBA buffer, so they are
 * portable across GPU/no-GPU capture backends and deterministic for a given PNG.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

function percentiles(sorted, ps) {
  const out = {};
  for (const p of ps) {
    const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
    out[`p${p}`] = sorted[idx];
  }
  return out;
}

async function analyze(file) {
  const img = sharp(file).removeAlpha();
  const meta = await img.metadata();
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const n = info.width * info.height;

  // Rec.709 luma + per-pixel chroma, computed once per pixel.
  const lumas = new Uint8Array(n);
  // Dark-pixel channel accumulation (luma < 24) for the tint read.
  let darkR = 0, darkG = 0, darkB = 0, darkCount = 0;
  let dark10 = 0, black = 0, low64 = 0, sat = 0;
  const satMin = 24; // max |channel - luma| threshold for "meaningful colour"

  for (let i = 0; i < n; i += 1) {
    const o = i * info.channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const luma = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
    lumas[i] = luma;
    if (luma < 10) dark10 += 1;
    if (luma <= 0) black += 1;
    if (luma < 64) low64 += 1;
    if (luma < 24) { darkR += r; darkG += g; darkB += b; darkCount += 1; }
    if (Math.max(Math.abs(r - luma), Math.abs(g - luma), Math.abs(b - luma)) >= satMin) sat += 1;
  }

  const sorted = Array.from(lumas).sort((a, b) => a - b);
  const meanLuma = lumas.reduce((s, v) => s + v, 0) / n;
  const sum = (arr) => arr.reduce((s, v) => s + v, 0);
  const darkRGB = darkCount === 0
    ? { r: null, g: null, b: null, count: 0 }
    : {
        r: Math.round(darkR / darkCount),
        g: Math.round(darkG / darkCount),
        b: Math.round(darkB / darkCount),
        count: darkCount,
      };

  return {
    file: path.basename(file),
    width: info.width,
    height: info.height,
    ...percentiles(sorted, [1, 5, 10, 50, 90, 95, 99]),
    meanLuma: Math.round(meanLuma * 10) / 10,
    darkFrac: +(dark10 / n).toFixed(4),
    blackFrac: +(black / n).toFixed(4),
    lowFrac: +(low64 / n).toFixed(4),
    satFrac: +(sat / n).toFixed(4),
    darkRGB,
  };
}

async function main(args) {
  const json = args.includes('--json');
  const files = args.filter((a) => a !== '--json');
  if (files.length === 0) {
    console.error('usage: node scripts/visual/frame-stats.mjs [--json] <png> [<png> ...]');
    process.exit(1);
  }
  const results = [];
  for (const f of files) {
    try {
      results.push(await analyze(f));
    } catch (e) {
      results.push({ file: path.basename(f), error: e.message });
    }
  }
  if (json) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
  } else {
    for (const r of results) {
      if (r.error) { console.log(`${r.file}: ERROR ${r.error}`); continue; }
      console.log(`${r.file}  ${r.width}x${r.height}`);
      console.log(`  luma p1/p5/p10/p50/p95 : ${r.p1}/${r.p5}/${r.p10}/${r.p50}/${r.p95}`);
      console.log(`  mean luma ${r.meanLuma}  dark(<10) ${r.darkFrac}  pure-black ${r.blackFrac}  low(<64) ${r.lowFrac}  colourful ${r.satFrac}`);
      console.log(`  darkness floor (luma<24) mean RGB : ${r.darkRGB.r}/${r.darkRGB.g}/${r.darkRGB.b}  (${r.darkRGB.count}px)`);
    }
  }
}

main(process.argv.slice(2));
