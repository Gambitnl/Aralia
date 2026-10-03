// Sharp 0.35 ships its declarations but omits them from its package exports.
// Reuse those bundled types until upstream repairs the export map; no API is
// redefined here and the runtime import continues to load the normal package.
type AraliaSharpFactory = typeof import('../../node_modules/sharp/lib/index');
declare module 'sharp' {
  const sharp: AraliaSharpFactory;
  export default sharp;
}
