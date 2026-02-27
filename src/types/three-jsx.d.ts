// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 27/02/2026, 09:30:31
 * Dependents: vite-env.d.ts
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
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
      biomeWeatherMaterial: any;
      points: any;
      biomeFaunaMaterial: any;
      gridHelper: any;
    }
  }
}
