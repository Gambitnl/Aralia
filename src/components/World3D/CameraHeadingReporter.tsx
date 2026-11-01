/** Samples the existing ground camera for the HUD compass. A quarter-second
 * cadence and rounded, changed-only reports keep camera motion off the game
 * state path. Reuse one vector; no position, controls or world data is written. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 21:41:50
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 1 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import {useEffect, useMemo, useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Vector3} from 'three';
import {bearingFromViewDirection} from './cameraHeading';

export function CameraHeadingReporter({onChange}: {onChange: (degrees: number | null) => void}) {
  const direction = useMemo(() => new Vector3(), []);
  const elapsed = useRef(0);
  const last = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    last.current = undefined;
    elapsed.current = 0;
    return () => onChange(null);
  }, [onChange]);
  useFrame(({camera}, delta) => {
    elapsed.current += Math.max(0, delta);
    if (last.current !== undefined && elapsed.current < 0.25) return;
    elapsed.current = 0;
    camera.getWorldDirection(direction);
    const next = bearingFromViewDirection(direction);
    if (next !== last.current) {
      last.current = next;
      onChange(next);
    }
  });
  return null;
}
