export const TILE_SIZE = 32;

/**
 * Robust rounded-rectangle path builder with clamping and Safari fallback.
 */
export function roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    if (w < 0) { x += w; w = Math.abs(w); }
    if (h < 0) { y += h; h = Math.abs(h); }
    if (r < 0) r = 0;
    const radius = Math.min(r, w / 2, h / 2);

    if (typeof ctx.roundRect === 'function') {
        try {
            ctx.roundRect(x, y, w, h, radius);
            return;
        } catch {
            // Fall through to manual path when native roundRect fails (e.g., Safari 16 bug).
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
