import { describe, it, expect } from 'vitest';
import {
    DOODAD_GLYPHS,
    DOODAD_GLYPH_NAMES,
    drawDoodadGlyph,
    glyphNoise,
    GLYPH_BASE_SIZE,
    type Glyph2DContext,
} from '../doodadGlyphs';

interface RecordedCall {
    method: string;
    args: number[];
}

/** A fake 2D context. It records every call. It needs no canvas. */
function createFakeCtx() {
    const calls: RecordedCall[] = [];
    const styles: string[] = [];

    const record = (method: string) => (...args: unknown[]) => {
        calls.push({ method, args: args.filter((a): a is number => typeof a === 'number') });
    };

    let fill = '';
    let stroke = '';

    const ctx = {
        get fillStyle() { return fill; },
        set fillStyle(v: string) { fill = v; styles.push(v); },
        get strokeStyle() { return stroke; },
        set strokeStyle(v: string) { stroke = v; styles.push(v); },
        lineWidth: 1,
        fillRect: record('fillRect'),
        strokeRect: record('strokeRect'),
        beginPath: record('beginPath'),
        moveTo: record('moveTo'),
        lineTo: record('lineTo'),
        quadraticCurveTo: record('quadraticCurveTo'),
        arc: record('arc'),
        ellipse: record('ellipse'),
        fill: record('fill'),
        stroke: record('stroke'),
        // roundRect is left undefined on purpose. The manual path must run.
    } as unknown as Glyph2DContext;

    return { ctx, calls, styles };
}

describe('doodadGlyphs', () => {
    it('holds 22 glyphs', () => {
        expect(DOODAD_GLYPH_NAMES).toHaveLength(22);
        expect(new Set(DOODAD_GLYPH_NAMES).size).toBe(22);
    });

    it.each(DOODAD_GLYPH_NAMES)('%s draws on the context', (name) => {
        const { ctx, calls, styles } = createFakeCtx();
        DOODAD_GLYPHS[name](ctx, 0, 0, GLYPH_BASE_SIZE, 7);

        expect(calls.length).toBeGreaterThan(0);
        expect(styles.length).toBeGreaterThan(0);
    });

    it.each(DOODAD_GLYPH_NAMES)('%s stays inside a padded cell', (name) => {
        const { ctx, calls } = createFakeCtx();
        DOODAD_GLYPHS[name](ctx, 100, 100, GLYPH_BASE_SIZE, 3);

        // Every recorded coordinate must sit near the cell. A stray value
        // means the glyph lost its offset.
        const coords = calls.flatMap((c) => c.args);
        for (const value of coords) {
            expect(Number.isFinite(value)).toBe(true);
        }
        const positions = calls
            .filter((c) => c.method !== 'arc' && c.method !== 'ellipse')
            .flatMap((c) => c.args.slice(0, 2))
            .filter((v) => Math.abs(v) > 10);
        for (const value of positions) {
            expect(value).toBeGreaterThan(60);
            expect(value).toBeLessThan(140);
        }
    });

    it.each(DOODAD_GLYPH_NAMES)('%s is pure for one seed', (name) => {
        const a = createFakeCtx();
        const b = createFakeCtx();
        DOODAD_GLYPHS[name](a.ctx, 0, 0, GLYPH_BASE_SIZE, 42);
        DOODAD_GLYPHS[name](b.ctx, 0, 0, GLYPH_BASE_SIZE, 42);

        expect(b.calls).toEqual(a.calls);
        expect(b.styles).toEqual(a.styles);
    });

    it('changes the willow shape when the seed changes', () => {
        const a = createFakeCtx();
        const b = createFakeCtx();
        DOODAD_GLYPHS.TREE_WILLOW(a.ctx, 0, 0, GLYPH_BASE_SIZE, 1);
        DOODAD_GLYPHS.TREE_WILLOW(b.ctx, 0, 0, GLYPH_BASE_SIZE, 2);

        expect(b.calls).not.toEqual(a.calls);
    });

    it('changes the crop layout when the seed changes', () => {
        const a = createFakeCtx();
        const b = createFakeCtx();
        DOODAD_GLYPHS.CROP_WHEAT(a.ctx, 0, 0, GLYPH_BASE_SIZE, 1);
        DOODAD_GLYPHS.CROP_WHEAT(b.ctx, 0, 0, GLYPH_BASE_SIZE, 2);

        expect(b.calls).not.toEqual(a.calls);
    });

    it('scales every coordinate with the size', () => {
        const small = createFakeCtx();
        const large = createFakeCtx();
        DOODAD_GLYPHS.ROCK(small.ctx, 0, 0, 32, 0);
        DOODAD_GLYPHS.ROCK(large.ctx, 0, 0, 64, 0);

        const smallArgs = small.calls.flatMap((c) => c.args);
        const largeArgs = large.calls.flatMap((c) => c.args);
        expect(largeArgs).toHaveLength(smallArgs.length);
        smallArgs.forEach((value, i) => {
            expect(largeArgs[i]).toBeCloseTo(value * 2, 6);
        });
    });

    it('builds a manual rounded rectangle when roundRect is absent', () => {
        const { ctx, calls } = createFakeCtx();
        DOODAD_GLYPHS.TOMBSTONE(ctx, 0, 0);

        expect(calls.filter((c) => c.method === 'quadraticCurveTo')).toHaveLength(4);
    });

    it('uses the native roundRect when the context has one', () => {
        const { ctx, calls } = createFakeCtx();
        const withRound = ctx as Glyph2DContext & { roundRect: (...a: number[]) => void };
        withRound.roundRect = (...args: number[]) => {
            calls.push({ method: 'roundRect', args });
        };
        DOODAD_GLYPHS.TOMBSTONE(withRound, 0, 0);

        expect(calls.filter((c) => c.method === 'roundRect')).toHaveLength(1);
        expect(calls.filter((c) => c.method === 'quadraticCurveTo')).toHaveLength(0);
    });

    it('draws a glyph by name and reports an unknown name', () => {
        const { ctx, calls } = createFakeCtx();
        expect(drawDoodadGlyph(ctx, 'BARREL', 0, 0)).toBe(true);
        expect(calls.length).toBeGreaterThan(0);

        const empty = createFakeCtx();
        expect(drawDoodadGlyph(empty.ctx, 'NOT_A_GLYPH', 0, 0)).toBe(false);
        expect(empty.calls).toHaveLength(0);
    });

    it('returns a repeatable noise value between 0 and 1', () => {
        for (let i = 0; i < 20; i++) {
            const value = glyphNoise(i, i * 3);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
            expect(glyphNoise(i, i * 3)).toBe(value);
        }
        expect(glyphNoise(1, 0)).not.toBe(glyphNoise(2, 0));
    });
});
