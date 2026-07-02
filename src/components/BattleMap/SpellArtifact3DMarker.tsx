// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 01/07/2026, 23:48:32
 * Dependents: components/BattleMap/BattleMap3D.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { SpellMapArtifactMarker } from './spellMapArtifacts';

const ARTIFACT_COLOR_BY_FAMILY: Record<SpellMapArtifactMarker['family'], string> = {
  helper: '#22d3ee',
  force: '#facc15',
  guardian: '#34d399',
  'animated-object': '#f97316',
  structure: '#a78bfa',
  space: '#60a5fa',
  emanation: '#fb7185'
};

interface SpellArtifact3DMarkerProps {
  marker: SpellMapArtifactMarker;
  groundY: number;
}

/**
 * Small 3D handle for non-creature spell artifacts. BattleMap3D owns placement;
 * this component only renders the readable marker, optional radius, and label.
 */
export const SpellArtifact3DMarker: React.FC<SpellArtifact3DMarkerProps> = ({ marker, groundY }) => {
  const color = ARTIFACT_COLOR_BY_FAMILY[marker.family];
  const radiusTiles = marker.radiusFeet ? Math.max(0.5, marker.radiusFeet / 5) : 0;
  const position: [number, number, number] = [
    marker.position.x + 0.5,
    groundY + 0.08,
    marker.position.y + 0.5
  ];

  return (
    <group position={position}>
      {radiusTiles > 0 && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[Math.max(0.05, radiusTiles - 0.04), radiusTiles, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.36} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.22, 0.28, 0.34, 6]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.58} metalness={0.04} />
      </mesh>
      <Html center distanceFactor={12} position={[0, 0.72, 0]} zIndexRange={[60, 20]}>
        {/* The label is DOM-backed because tiny mesh text is unreadable in the
            tactical camera. This keeps 3D parity with the 2D marker titles. */}
        <div
          data-testid={`spell-map-artifact-3d-${marker.family}`}
          title={marker.title}
          className="pointer-events-none rounded border border-white/70 bg-slate-950/88 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow-[0_0_10px_rgba(15,23,42,0.8)]"
        >
          {marker.label}
        </div>
      </Html>
    </group>
  );
};
