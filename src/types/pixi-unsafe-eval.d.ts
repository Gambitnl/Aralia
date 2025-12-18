// Type declaration for pixi.js/unsafe-eval module
// This module re-exports pixi.js with a workaround for CSP environments
// that block `new Function()` / `eval()`.
declare module 'pixi.js/unsafe-eval' {
    export * from 'pixi.js';
}
