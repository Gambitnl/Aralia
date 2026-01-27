// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 * 
 * Last Sync: 27/01/2026, 01:42:13
 * Dependents: None (Orphan)
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

// TODO(2026-01-15 Codex-CLI): Replace these JSX shims with real @react-three/fiber element types once typings are resolved.
import 'react';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      boxGeometry: any;
      directionalLight: any;
      fogExp2: any;
      group: any;
      hemisphereLight: any;
      instancedMesh: any;
      lineSegments: any;
      mesh: any;
      meshBasicMaterial: any;
      meshStandardMaterial: any;
      planeGeometry: any;
      sphereGeometry: any;
      biomeShaderMaterial: any;
      coneGeometry: any;
      dodecahedronGeometry: any;
      biomeWaterMaterial: any;
      fog: any;
      biomeFogMaterial: any;
      cylinderGeometry: any;
    }
  }
}
