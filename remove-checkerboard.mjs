/**
 * Detect checkerboard pattern in race sprites and remove it.
 *
 * APPROACH FOR "HARD MODE" SPRITES (dark characters with grey clothing):
 * 1. Detect the exact checkerboard block size by analyzing edges
 * 2. Identify the two alternating colors/brightness levels
 * 3. Build a mask: for each block position, check if the pixel matches
 *    the expected checkerboard color (within tolerance)
 * 4. Flood-fill from edges but ONLY follow pixels that match the
 *    checkerboard pattern — not just any desaturated pixel
 *
 * This prevents the flood fill from eating grey clothing that happens
 * to be the same brightness as the checkerboard squares.
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const SPRITE_DIR = 'F:/Repos/Aralia/public/assets/images/race-sprites';

/**
 * Detect checkerboard parameters by sampling edge pixels.
 * Returns the two brightness values and the block size.
 */
function detectCheckerboard(pixels, w, h) {
    // Sample the top row to find brightness transitions
    const topRow = [];
    for (let x = 0; x < Math.min(w, 200); x++) {
        const i = x * 4; // y=0
        topRow.push({
            x,
            brightness: (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3,
            r: pixels[i], g: pixels[i + 1], b: pixels[i + 2], a: pixels[i + 3]
        });
    }

    // Find transitions in brightness to detect block size
    let transitions = [];
    for (let i = 1; i < topRow.length; i++) {
        const diff = Math.abs(topRow[i].brightness - topRow[i - 1].brightness);
        if (diff > 15) { // Significant change
            transitions.push(i);
        }
    }

    // The block size = distance between transitions
    let blockSize = 16; // default
    if (transitions.length >= 2) {
        // Most common gap between transitions
        const gaps = [];
        for (let i = 1; i < transitions.length; i++) {
            gaps.push(transitions[i] - transitions[i - 1]);
        }
        gaps.sort((a, b) => a - b);
        blockSize = gaps[Math.floor(gaps.length / 2)]; // median
    }

    // Get the two checkerboard colors from corners
    const topLeftBrightness = topRow[0].brightness;
    // Find the other color in the next block
    const nextBlockX = Math.min(blockSize, w - 1);
    const ni = nextBlockX * 4;
    const topRightBlockBrightness = (pixels[ni] + pixels[ni + 1] + pixels[ni + 2]) / 3;

    const colorA = Math.min(topLeftBrightness, topRightBlockBrightness);
    const colorB = Math.max(topLeftBrightness, topRightBlockBrightness);

    return { blockSize, colorA, colorB };
}

/**
 * Check if a pixel matches the expected checkerboard color at its position.
 * The checkerboard alternates in blocks: if (blockX + blockY) is even,
 * the block is one color; if odd, the other.
 */
function matchesCheckerboard(r, g, b, a, x, y, checker) {
    if (a < 5) return true; // Already transparent

    const { blockSize, colorA, colorB } = checker;
    const blockX = Math.floor(x / blockSize);
    const blockY = Math.floor(y / blockSize);
    const isEvenBlock = (blockX + blockY) % 2 === 0;

    const brightness = (r + g + b) / 3;
    const expectedBrightness = isEvenBlock ? colorA : colorB;

    // Check saturation — checkerboard is always grey
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    if (sat > 0.15) return false; // Too colorful to be checkerboard

    // Allow generous tolerance for imperfect checkerboard
    const tolerance = 25;
    // Match against either expected color (checkerboard can be imperfect)
    const matchA = Math.abs(brightness - colorA) < tolerance;
    const matchB = Math.abs(brightness - colorB) < tolerance;

    return matchA || matchB;
}

async function processImage(filePath) {
    const image = sharp(filePath);
    const { data, info } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const pixels = Buffer.from(data);
    const w = info.width;
    const h = info.height;

    // Detect the checkerboard pattern
    const checker = detectCheckerboard(pixels, w, h);
    console.log(`  Pattern: blockSize=${checker.blockSize}, colors=[${checker.colorA.toFixed(0)}, ${checker.colorB.toFixed(0)}]`);

    const idx = (x, y) => (y * w + x) * 4;
    const flatIdx = (x, y) => y * w + x;

    const visited = new Uint8Array(w * h);
    const isBackground = new Uint8Array(w * h);

    // BFS flood fill from edges
    const queue = [];
    for (let x = 0; x < w; x++) {
        queue.push(x + 0 * w);
        queue.push(x + (h - 1) * w);
    }
    for (let y = 1; y < h - 1; y++) {
        queue.push(0 + y * w);
        queue.push((w - 1) + y * w);
    }

    let head = 0;
    while (head < queue.length) {
        const fi = queue[head++];
        if (visited[fi]) continue;
        visited[fi] = 1;

        const x = fi % w;
        const y = (fi / w) | 0;
        const pi = fi * 4;
        const r = pixels[pi];
        const g = pixels[pi + 1];
        const b = pixels[pi + 2];
        const a = pixels[pi + 3];

        // Use checkerboard-aware matching
        if (!matchesCheckerboard(r, g, b, a, x, y, checker)) continue;

        isBackground[fi] = 1;

        if (x > 0 && !visited[fi - 1]) queue.push(fi - 1);
        if (x < w - 1 && !visited[fi + 1]) queue.push(fi + 1);
        if (y > 0 && !visited[fi - w]) queue.push(fi - w);
        if (y < h - 1 && !visited[fi + w]) queue.push(fi + w);
    }

    // Make background transparent
    let bgCount = 0;
    for (let i = 0; i < w * h; i++) {
        if (isBackground[i]) {
            bgCount++;
            const pi = i * 4;
            pixels[pi] = 0;
            pixels[pi + 1] = 0;
            pixels[pi + 2] = 0;
            pixels[pi + 3] = 0;
        }
    }

    const bgPercent = ((bgCount / (w * h)) * 100).toFixed(1);

    const tmpPath = filePath + '.tmp';
    await sharp(pixels, { raw: { width: w, height: h, channels: 4 } })
        .png()
        .toFile(tmpPath);

    fs.renameSync(tmpPath, filePath);
    console.log(`  ✓ ${path.basename(filePath)} — removed ${bgCount} bg pixels (${bgPercent}%)`);
}

async function main() {
    // Only process the ones that had issues
    const targets = ['drow_male.png', 'elf_male.png'];

    for (const f of targets) {
        const filePath = path.join(SPRITE_DIR, f);
        console.log(`\nProcessing ${f}...`);
        try {
            await processImage(filePath);
        } catch (err) {
            console.error(`  ✗ ${f} — ERROR: ${err.message}`);
        }
    }

    console.log('\nDone!');
}

main();
