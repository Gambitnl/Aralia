/**
 * Debug: sample edge pixels from a sprite image to understand
 * the exact checkerboard pattern colors.
 */
import sharp from 'sharp';
import path from 'path';

const SPRITE_DIR = 'F:/Repos/Aralia/public/assets/images/race-sprites';

async function samplePixels(filePath) {
    const image = sharp(filePath);
    const { data, info } = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const idx = (x, y) => (y * w + x) * 4;

    console.log(`\n=== ${path.basename(filePath)} (${w}x${h}) ===`);

    // Sample corners and edges
    const samples = [
        [0, 0, 'top-left corner'],
        [5, 5, 'near top-left'],
        [10, 10, 'offset top-left'],
        [w - 1, 0, 'top-right corner'],
        [0, h - 1, 'bottom-left corner'],
        [w - 1, h - 1, 'bottom-right corner'],
        [w / 2 | 0, 0, 'top center'],
        [w / 2 | 0, h - 1, 'bottom center'],
        [0, h / 2 | 0, 'left center'],
        [w - 1, h / 2 | 0, 'right center'],
        // Sample a 2x2 block to detect alternating pattern
        [1, 1, '(1,1)'],
        [2, 1, '(2,1)'],
        [1, 2, '(1,2)'],
        [2, 2, '(2,2)'],
    ];

    for (const [x, y, label] of samples) {
        const i = idx(x, y);
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
        console.log(`  ${label}: rgba(${r}, ${g}, ${b}, ${a}) ${hex} brightness=${((r + g + b) / 3).toFixed(0)}`);
    }
}

const files = ['drow_male.png', 'goblin_male.png', 'dragonborn_male.png'];
for (const f of files) {
    await samplePixels(path.join(SPRITE_DIR, f));
}
