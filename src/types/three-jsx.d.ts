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
    }
  }
}
