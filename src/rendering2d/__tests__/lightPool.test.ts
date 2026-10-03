import { describe, it, expect } from 'vitest';
import {
    drawLight,
    drawNightOverlay,
    lightFromPreset,
    LIGHT_PRESETS,
    NIGHT_TINT,
    type LightPool2DContext,
    type LightSource,
} from '../lightPool';

interface GradientRecord {
    args: number[];
    stops: Array<[number, string]>;
}

/** A fake 2D context. It records the gradients and the fills. */
function createFakeCtx() {
    const gradients: GradientRecord[] = [];
    const fillRects: number[][] = [];
    const arcs: number[][] = [];
    const fillStyles: unknown[] = [];
    const alphas: number[] = [];
    const composites: string[] = [];

    let fill: unknown = '';
    let alpha = 1;
    let composite = 'source-over';

    const ctx = {
        get fillStyle() { return fill as string; },
        set fillStyle(v: unknown) { fill = v; fillStyles.push(v); },
        get globalAlpha() { return alpha; },
        set globalAlpha(v: number) { alpha = v; alphas.push(v); },
        get globalCompositeOperation() { return composite; },
        set globalCompositeOperation(v: string) { composite = v; composites.push(v); },
        fillRect: (...a: number[]) => { fillRects.push(a); },
        beginPath: () => { /* no state to record */ },
        arc: (...a: number[]) => { arcs.push(a); },
        fill: () => { /* no state to record */ },
        createRadialGradient: (...a: number[]) => {
            const record: GradientRecord = { args: a, stops: [] };
            gradients.push(record);
            return {
                addColorStop: (offset: number, color: string) => {
                    record.stops.push([offset, color]);
                },
            } as unknown as CanvasGradient;
        },
    } as unknown as LightPool2DContext;

    return { ctx, gradients, fillRects, arcs, fillStyles, alphas, composites };
}

const LIGHT: LightSource = { x: 40, y: 60, radius: 96, color: '#fbbf24', intensity: 0.7 };

describe('lightPool', () => {
    it('draws one radial gradient per light', () => {
        const lights: LightSource[] = [
            { x: 10, y: 10, radius: 32, color: '#ff0000' },
            { x: 50, y: 20, radius: 48, color: '#00ff00' },
            { x: 90, y: 30, radius: 64, color: '#0000ff' },
        ];
        const { ctx, gradients, arcs } = createFakeCtx();
        drawNightOverlay(ctx, { width: 320, height: 240, lights });

        expect(gradients).toHaveLength(lights.length);
        expect(arcs).toHaveLength(lights.length);
        lights.forEach((light, i) => {
            expect(gradients[i].args).toEqual([light.x, light.y, 1, light.x, light.y, light.radius]);
            expect(arcs[i].slice(0, 3)).toEqual([light.x, light.y, light.radius]);
        });
    });

    it('fades each pool from its color to full transparency', () => {
        const { ctx, gradients } = createFakeCtx();
        drawLight(ctx, LIGHT);

        expect(gradients).toHaveLength(1);
        expect(gradients[0].stops).toEqual([
            [0, '#fbbf24'],
            [1, 'rgba(0,0,0,0)'],
        ]);
    });

    it('uses the light intensity, and 0.6 when the light has none', () => {
        const withValue = createFakeCtx();
        drawLight(withValue.ctx, LIGHT);
        expect(withValue.alphas).toEqual([0.7]);

        const withoutValue = createFakeCtx();
        drawLight(withoutValue.ctx, { x: 0, y: 0, radius: 10, color: '#fff' });
        expect(withoutValue.alphas).toEqual([0.6]);
    });

    it('covers the whole map with the night tint first', () => {
        const { ctx, fillRects, fillStyles } = createFakeCtx();
        drawNightOverlay(ctx, { width: 640, height: 480, lights: [] });

        expect(fillRects).toEqual([[0, 0, 640, 480]]);
        expect(fillStyles[0]).toBe(NIGHT_TINT);
    });

    it('accepts a custom tint', () => {
        const { ctx, fillStyles } = createFakeCtx();
        drawNightOverlay(ctx, { width: 10, height: 10, lights: [], tint: 'rgba(0,0,0,0.5)' });

        expect(fillStyles[0]).toBe('rgba(0,0,0,0.5)');
    });

    it('blends the pools in screen mode and then restores the context', () => {
        const { ctx, composites, alphas } = createFakeCtx();
        drawNightOverlay(ctx, { width: 100, height: 100, lights: [LIGHT] });

        expect(composites).toEqual(['screen', 'source-over']);
        expect(alphas[alphas.length - 1]).toBe(1.0);
        expect(ctx.globalAlpha).toBe(1.0);
        expect(ctx.globalCompositeOperation).toBe('source-over');
    });

    it('builds a light from a preset and scales the radius by the tile size', () => {
        const light = lightFromPreset('street_lamp', 64, 96, 32);
        expect(light).toEqual({
            x: 64,
            y: 96,
            radius: LIGHT_PRESETS.street_lamp.radiusInTiles * 32,
            color: '#fbbf24',
            intensity: 0.7,
        });
    });

    it('returns null for an unknown preset', () => {
        expect(lightFromPreset('not_a_light', 0, 0, 32)).toBeNull();
    });

    it('gives every preset a color, a radius, and an intensity', () => {
        const names = Object.keys(LIGHT_PRESETS);
        expect(names.length).toBeGreaterThan(0);
        for (const name of names) {
            const preset = LIGHT_PRESETS[name];
            expect(preset.color).toMatch(/^#[0-9a-f]{6}$/i);
            expect(preset.radiusInTiles).toBeGreaterThan(0);
            expect(preset.intensity).toBeGreaterThan(0);
            expect(preset.intensity).toBeLessThanOrEqual(1);
        }
    });
});
