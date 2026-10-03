/**
 * @file src/rendering2d/doodadGlyphs.ts
 * Hand-drawn 2D canvas glyphs for map doodads.
 *
 * Salvaged from the RealmSmith DoodadPainter (retired 2026-09-14).
 * Each glyph is a pure function. A glyph draws into a 2D context.
 * A glyph does not read global state. A glyph does not call Math.random.
 * The caller gives a seed. The same seed always draws the same shape.
 *
 * Intended consumer: the next-gen 2D combat map (Pixi prototype, ?pixiboard=1).
 */

/**
 * The part of CanvasRenderingContext2D that the glyphs use.
 * A test can supply a small fake object with these members.
 */
export interface Glyph2DContext {
    fillStyle: string | CanvasGradient | CanvasPattern;
    strokeStyle: string | CanvasGradient | CanvasPattern;
    lineWidth: number;
    fillRect(x: number, y: number, w: number, h: number): void;
    strokeRect(x: number, y: number, w: number, h: number): void;
    beginPath(): void;
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
    arc(x: number, y: number, r: number, start: number, end: number): void;
    ellipse(
        x: number,
        y: number,
        rx: number,
        ry: number,
        rotation: number,
        start: number,
        end: number
    ): void;
    fill(): void;
    stroke(): void;
    roundRect?(x: number, y: number, w: number, h: number, r: number | number[]): void;
}

/** The design size of one glyph in pixels. All offsets use this size. */
export const GLYPH_BASE_SIZE = 32;

/**
 * A glyph draw function.
 *
 * @param ctx   The 2D context.
 * @param x     The left edge of the glyph cell.
 * @param y     The top edge of the glyph cell.
 * @param size  The cell size in pixels. The default is 32.
 * @param seed  A number that selects the shape variation. The default is 0.
 */
export type DoodadGlyph = (
    ctx: Glyph2DContext,
    x: number,
    y: number,
    size?: number,
    seed?: number
) => void;

/**
 * Returns a repeatable pseudo-random number between 0 and 1.
 * The result depends only on the seed and the index.
 */
export function glyphNoise(seed: number, index: number): number {
    const raw = Math.sin(seed * 127.1 + index * 311.7 + 1.0) * 43758.5453;
    return raw - Math.floor(raw);
}

/** Builds a rounded-rectangle path. Falls back to a manual path. */
function roundedRect(
    ctx: Glyph2DContext,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
): void {
    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }
    if (r < 0) r = 0;
    const radius = Math.min(r, w / 2, h / 2);

    if (typeof ctx.roundRect === 'function') {
        try {
            ctx.roundRect(x, y, w, h, radius);
            return;
        } catch {
            // The native call failed. Use the manual path below.
        }
    }

    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + w - radius, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
    ctx.lineTo(x + w, y + h - radius);
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
    ctx.lineTo(x + radius, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
}

/** Returns the scale factor from the design size to the requested size. */
function unit(size: number): number {
    return size / GLYPH_BASE_SIZE;
}

// ---------------------------------------------------------------------------
// Tree glyphs
// ---------------------------------------------------------------------------

/** Draws a round broadleaf tree in the two given colors. */
export function drawBroadleafTree(
    ctx: Glyph2DContext,
    x: number,
    y: number,
    size = GLYPH_BASE_SIZE,
    dark = '#166534',
    light = '#15803d'
): void {
    const u = unit(size);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(x + 12 * u, y + 16 * u, 8 * u, 14 * u);

    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.arc(x + 8 * u, y + 12 * u, 10 * u, 0, Math.PI * 2);
    ctx.arc(x + 24 * u, y + 12 * u, 10 * u, 0, Math.PI * 2);
    ctx.arc(x + 16 * u, y + 4 * u, 12 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(x + 16 * u, y + 4 * u, 8 * u, 0, Math.PI * 2);
    ctx.fill();
}

/** Draws a green oak tree. */
export const drawOakTree: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) =>
    drawBroadleafTree(ctx, x, y, size, '#166534', '#15803d');

/** Draws a pink cherry tree. */
export const drawCherryTree: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) =>
    drawBroadleafTree(ctx, x, y, size, '#be185d', '#db2777');

/** Draws an orange autumn tree. */
export const drawAutumnTree: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) =>
    drawBroadleafTree(ctx, x, y, size, '#c2410c', '#ea580c');

/** Draws a conifer with two stacked triangles. */
export const drawPineTree: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    const dark = '#064e3b';
    const light = '#065f46';

    ctx.fillStyle = '#451a03';
    ctx.fillRect(x + 14 * u, y + 20 * u, 4 * u, 10 * u);

    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x + 2 * u, y + 24 * u);
    ctx.lineTo(x + 16 * u, y + 4 * u);
    ctx.lineTo(x + 30 * u, y + 24 * u);
    ctx.fill();

    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.moveTo(x + 6 * u, y + 16 * u);
    ctx.lineTo(x + 16 * u, y - 2 * u);
    ctx.lineTo(x + 26 * u, y + 16 * u);
    ctx.fill();
};

/** Draws a willow with hanging strands. The seed selects the strand curve. */
export const drawWillowTree: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE, seed = 0) => {
    const u = unit(size);
    ctx.fillStyle = '#57534e';
    ctx.fillRect(x + 12 * u, y + 14 * u, 8 * u, 16 * u);

    ctx.fillStyle = '#3f6212';
    ctx.beginPath();
    ctx.ellipse(x + 16 * u, y + 10 * u, 14 * u, 10 * u, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#4d7c0f';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    let strand = 0;
    for (let i = 4; i <= 28; i += 4) {
        const sway = (glyphNoise(seed, strand) * 4 - 2) * u;
        ctx.moveTo(x + i * u, y + 10 * u);
        ctx.quadraticCurveTo(x + i * u + sway, y + 20 * u, x + i * u, y + 28 * u);
        strand += 1;
    }
    ctx.stroke();
};

/** Draws a palm with a curved trunk and five fronds. */
export const drawPalmTree: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.strokeStyle = '#a16207';
    ctx.lineWidth = 4 * u;
    ctx.beginPath();
    ctx.moveTo(x + 16 * u, y + 28 * u);
    ctx.quadraticCurveTo(x + 20 * u, y + 16 * u, x + 10 * u, y + 6 * u);
    ctx.stroke();

    ctx.strokeStyle = '#15803d';
    ctx.lineWidth = 2 * u;
    const cx = x + 10 * u;
    const cy = y + 6 * u;
    for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(
            cx + Math.cos(angle) * 10 * u,
            cy + Math.sin(angle) * 10 * u - 5 * u,
            cx + Math.cos(angle) * 16 * u,
            cy + Math.sin(angle) * 16 * u
        );
        ctx.stroke();
    }
};

/** Draws a bare dead tree. */
export const drawDeadTree: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.strokeStyle = '#44403c';
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.moveTo(x + 16 * u, y + 28 * u);
    ctx.lineTo(x + 16 * u, y + 10 * u);
    ctx.lineTo(x + 10 * u, y + 2 * u);
    ctx.moveTo(x + 16 * u, y + 16 * u);
    ctx.lineTo(x + 24 * u, y + 8 * u);
    ctx.stroke();
};

/** Draws a large purple mushroom tree with a spotted cap. */
export const drawMushroomTree: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#e5e5e5';
    ctx.fillRect(x + 14 * u, y + 16 * u, 4 * u, 14 * u);

    ctx.fillStyle = '#a855f7';
    ctx.beginPath();
    ctx.arc(x + 16 * u, y + 12 * u, 12 * u, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = '#f3e8ff';
    ctx.beginPath();
    ctx.arc(x + 12 * u, y + 8 * u, 2 * u, 0, Math.PI * 2);
    ctx.arc(x + 20 * u, y + 10 * u, 3 * u, 0, Math.PI * 2);
    ctx.fill();
};

/** Draws a small ground mushroom with a red cap. */
export const drawMushroom: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(x + 15 * u, y + 20 * u, 3 * u, 8 * u);

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(x + 16 * u, y + 20 * u, 6 * u, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = '#fef2f2';
    ctx.beginPath();
    ctx.arc(x + 14 * u, y + 17 * u, 1.5 * u, 0, Math.PI * 2);
    ctx.arc(x + 19 * u, y + 18 * u, 1.5 * u, 0, Math.PI * 2);
    ctx.fill();
};

// ---------------------------------------------------------------------------
// Plant and rock glyphs
// ---------------------------------------------------------------------------

/** Draws a cactus with two arms. */
export const drawCactus: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    roundedRect(ctx, x + 14 * u, y + 10 * u, 4 * u, 20 * u, 2 * u);
    roundedRect(ctx, x + 8 * u, y + 14 * u, 4 * u, 8 * u, 2 * u);
    roundedRect(ctx, x + 20 * u, y + 12 * u, 4 * u, 8 * u, 2 * u);
    ctx.fill();
};

/** Draws a bush from three overlapping circles. */
export const drawBush: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#166534';
    ctx.beginPath();
    ctx.arc(x + 10 * u, y + 20 * u, 6 * u, 0, Math.PI * 2);
    ctx.arc(x + 22 * u, y + 20 * u, 6 * u, 0, Math.PI * 2);
    ctx.arc(x + 16 * u, y + 14 * u, 7 * u, 0, Math.PI * 2);
    ctx.fill();
};

/** Draws a gray boulder as a six-sided facet. */
export const drawRock: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.moveTo(x + 8 * u, y + 24 * u);
    ctx.lineTo(x + 12 * u, y + 16 * u);
    ctx.lineTo(x + 20 * u, y + 14 * u);
    ctx.lineTo(x + 26 * u, y + 20 * u);
    ctx.lineTo(x + 24 * u, y + 28 * u);
    ctx.lineTo(x + 6 * u, y + 28 * u);
    ctx.fill();
};

/** Draws a cut tree stump with a pale top face. */
export const drawStump: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#57534e';
    ctx.fillRect(x + 10 * u, y + 20 * u, 12 * u, 8 * u);
    ctx.fillStyle = '#a8a29e';
    ctx.beginPath();
    ctx.ellipse(x + 16 * u, y + 20 * u, 6 * u, 3 * u, 0, 0, Math.PI * 2);
    ctx.fill();
};

/** Draws a crystal shard with a highlight face. */
export const drawCrystal: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(x + 16 * u, y + 28 * u);
    ctx.lineTo(x + 8 * u, y + 16 * u);
    ctx.lineTo(x + 16 * u, y + 4 * u);
    ctx.lineTo(x + 24 * u, y + 16 * u);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(x + 16 * u, y + 28 * u);
    ctx.lineTo(x + 12 * u, y + 16 * u);
    ctx.lineTo(x + 16 * u, y + 4 * u);
    ctx.fill();
};

// ---------------------------------------------------------------------------
// Crop glyphs
// ---------------------------------------------------------------------------

/** Draws five crop stalks in the given color. The seed places the stalks. */
export function drawCropCluster(
    ctx: Glyph2DContext,
    x: number,
    y: number,
    size = GLYPH_BASE_SIZE,
    seed = 0,
    color = '#facc15'
): void {
    const u = unit(size);
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
        const rx = (glyphNoise(seed, i * 2) * 20 + 6) * u;
        const ry = (glyphNoise(seed, i * 2 + 1) * 20 + 6) * u;
        ctx.fillRect(x + rx, y + ry, 2 * u, 6 * u);
    }
}

/** Draws a cluster of gold wheat stalks. */
export const drawWheatCrop: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE, seed = 0) =>
    drawCropCluster(ctx, x, y, size, seed, '#facc15');

/** Draws a cluster of green corn stalks. */
export const drawCornCrop: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE, seed = 0) =>
    drawCropCluster(ctx, x, y, size, seed, '#16a34a');

/** Draws an orange pumpkin with a green stem. */
export const drawPumpkin: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#ea580c';
    ctx.beginPath();
    ctx.arc(x + 16 * u, y + 20 * u, 6 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#166534';
    ctx.fillRect(x + 15 * u, y + 12 * u, 2 * u, 4 * u);
};

// ---------------------------------------------------------------------------
// Built-object glyphs
// ---------------------------------------------------------------------------

/** Draws a stone well with a roof on two posts. */
export const drawWell: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#57534e';
    ctx.beginPath();
    ctx.arc(x + 16 * u, y + 20 * u, 8 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(x + 16 * u, y + 20 * u, 5 * u, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 10 * u, y + 4 * u, 2 * u, 16 * u);
    ctx.fillRect(x + 20 * u, y + 4 * u, 2 * u, 16 * u);

    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.moveTo(x + 6 * u, y + 8 * u);
    ctx.lineTo(x + 16 * u, y + 2 * u);
    ctx.lineTo(x + 26 * u, y + 8 * u);
    ctx.fill();
};

/** Draws a wooden crate with cross braces. */
export const drawCrate: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#d97706';
    ctx.fillRect(x + 8 * u, y + 12 * u, 16 * u, 16 * u);
    ctx.strokeStyle = '#92400e';
    ctx.strokeRect(x + 8 * u, y + 12 * u, 16 * u, 16 * u);
    ctx.beginPath();
    ctx.moveTo(x + 8 * u, y + 12 * u);
    ctx.lineTo(x + 24 * u, y + 28 * u);
    ctx.moveTo(x + 24 * u, y + 12 * u);
    ctx.lineTo(x + 8 * u, y + 28 * u);
    ctx.stroke();
};

/** Draws a barrel with two iron bands. */
export const drawBarrel: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.ellipse(x + 16 * u, y + 20 * u, 6 * u, 8 * u, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#451a03';
    ctx.fillRect(x + 10 * u, y + 16 * u, 12 * u, 2 * u);
    ctx.fillRect(x + 10 * u, y + 24 * u, 12 * u, 2 * u);
};

/** Draws a street lamp with a lit box head. */
export const drawStreetLamp: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(x + 14 * u, y + 10 * u, 4 * u, 22 * u);

    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(x + 12 * u, y + 4 * u, 8 * u, 8 * u);
    ctx.strokeStyle = '#1f2937';
    ctx.strokeRect(x + 12 * u, y + 4 * u, 8 * u, 8 * u);
};

/** Draws a rounded gray tombstone. */
export const drawTombstone: DoodadGlyph = (ctx, x, y, size = GLYPH_BASE_SIZE) => {
    const u = unit(size);
    ctx.fillStyle = '#9ca3af';
    ctx.beginPath();
    roundedRect(ctx, x + 12 * u, y + 12 * u, 8 * u, 16 * u, 4 * u);
    ctx.fill();
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** The name of every doodad glyph in the library. */
export type DoodadGlyphName =
    | 'TREE_OAK'
    | 'TREE_PINE'
    | 'TREE_PALM'
    | 'TREE_DEAD'
    | 'TREE_WILLOW'
    | 'TREE_CHERRY'
    | 'TREE_AUTUMN'
    | 'TREE_MUSHROOM'
    | 'MUSHROOM'
    | 'BUSH'
    | 'CACTUS'
    | 'ROCK'
    | 'STUMP'
    | 'CRYSTAL'
    | 'CROP_WHEAT'
    | 'CROP_CORN'
    | 'CROP_PUMPKIN'
    | 'WELL'
    | 'CRATE'
    | 'BARREL'
    | 'STREET_LAMP'
    | 'TOMBSTONE';

/** Every glyph, by name. The caller looks up one glyph and draws it. */
export const DOODAD_GLYPHS: Record<DoodadGlyphName, DoodadGlyph> = {
    TREE_OAK: drawOakTree,
    TREE_PINE: drawPineTree,
    TREE_PALM: drawPalmTree,
    TREE_DEAD: drawDeadTree,
    TREE_WILLOW: drawWillowTree,
    TREE_CHERRY: drawCherryTree,
    TREE_AUTUMN: drawAutumnTree,
    TREE_MUSHROOM: drawMushroomTree,
    MUSHROOM: drawMushroom,
    BUSH: drawBush,
    CACTUS: drawCactus,
    ROCK: drawRock,
    STUMP: drawStump,
    CRYSTAL: drawCrystal,
    CROP_WHEAT: drawWheatCrop,
    CROP_CORN: drawCornCrop,
    CROP_PUMPKIN: drawPumpkin,
    WELL: drawWell,
    CRATE: drawCrate,
    BARREL: drawBarrel,
    STREET_LAMP: drawStreetLamp,
    TOMBSTONE: drawTombstone,
};

/** The names of every glyph, in registry order. */
export const DOODAD_GLYPH_NAMES = Object.keys(DOODAD_GLYPHS) as DoodadGlyphName[];

/**
 * Draws one glyph by name.
 * Does nothing if the name is unknown.
 */
export function drawDoodadGlyph(
    ctx: Glyph2DContext,
    name: string,
    x: number,
    y: number,
    size = GLYPH_BASE_SIZE,
    seed = 0
): boolean {
    const glyph = DOODAD_GLYPHS[name as DoodadGlyphName];
    if (!glyph) return false;
    glyph(ctx, x, y, size, seed);
    return true;
}
