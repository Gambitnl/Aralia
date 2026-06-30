/**
 * @file src/components/World3D/TransitionController.tsx
 * Orchestrates the mount/unmount handoff between the 2D atlas and 3D scene.
 *
 * Entry sequence (atlas → 3D):
 * 1. Fade-out atlas (~300ms)
 * 2. Mount World3DScene with correct start position
 * 3. Camera dive animation (~1500ms)
 * 4. Player gains control, onComplete fires
 *
 * Exit sequence (3D → atlas):
 * 1. Camera lerp up (~800ms) — handled by scene unmount animation
 * 2. Fade-in atlas (~400ms)
 * 3. Scene unmounts (or pauses, depending on perf strategy)
 *
 * This component owns the transition timing and visibility logic only.
 * Entry world coordinates live on World3DWrapper (sceneContent), not here — W3DUI-24.
 * It does not reach into R3F internals.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ATLAS_FADE_IN_MS,
  ATLAS_FADE_OUT_MS,
  CAMERA_DIVE_MS,
  CAMERA_LERP_UP_MS,
} from './transitionTiming';

export interface TransitionControllerProps {
  /** Current view mode: 'atlas' shows the 2D map, '3d' shows the 3D world. */
  mode: 'atlas' | '3d';
  /** Called when the entry transition completes and player gains control. */
  onComplete: () => void;
  /** The 2D atlas content (MapPane + GameLayout). */
  atlasContent: React.ReactNode;
  /** The 3D scene content (World3DScene + InWorldHUD). */
  sceneContent: React.ReactNode;
}

const TransitionController: React.FC<TransitionControllerProps> = ({
  mode,
  onComplete,
  atlasContent,
  sceneContent,
}) => {
  // Track whether the 3D scene should be mounted at all.
  const [isSceneMounted, setIsSceneMounted] = useState(mode === '3d');
  // Track the current transition phase for animation timing.
  const [transitionPhase, setTransitionPhase] = useState<'idle' | 'entering' | 'exiting'>('idle');
  // Track visibility of each layer for fade animations.
  const [atlasVisible, setAtlasVisible] = useState(mode === 'atlas');
  const [sceneVisible, setSceneVisible] = useState(mode === '3d');

  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Ref avoids re-running this effect when mount state flips mid-transition (which would clear timers).
  const isSceneMountedRef = useRef(isSceneMounted);
  isSceneMountedRef.current = isSceneMounted;

  // Handle mode changes — kick off entry or exit sequences (depends on mode only).
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timers.push(id);
      return id;
    };

    if (mode === '3d' && !isSceneMountedRef.current) {
      setTransitionPhase('entering');
      setAtlasVisible(false);

      schedule(() => {
        setIsSceneMounted(true);
        setSceneVisible(true);

        schedule(() => {
          setTransitionPhase('idle');
          onCompleteRef.current();
        }, CAMERA_DIVE_MS);
      }, ATLAS_FADE_OUT_MS);
    } else if (mode === 'atlas' && isSceneMountedRef.current) {
      setTransitionPhase('exiting');
      setSceneVisible(false);

      schedule(() => {
        setAtlasVisible(true);

        schedule(() => {
          setIsSceneMounted(false);
          setTransitionPhase('idle');
        }, ATLAS_FADE_IN_MS);
      }, CAMERA_LERP_UP_MS);
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [mode]);

  // Calculate scene opacity based on transition phase.
  const getSceneOpacity = useCallback(() => {
    if (transitionPhase === 'entering') {
      return sceneVisible ? 1 : 0;
    }
    if (transitionPhase === 'exiting') {
      return sceneVisible ? 1 : 0;
    }
    return mode === '3d' ? 1 : 0;
  }, [transitionPhase, sceneVisible, mode]);

  return (
    // The in-world view (2D atlas + 3D scene) fills the whole window. App's root
    // is `min-h-screen` (min-height only, no definite height), so a `height: 100%`
    // here would collapse and every percentage-height descendant — down to the
    // World3DScene canvas — would fall back to its 520px floor, leaving the 3D
    // world stuck in the top half of the window. Anchor to the viewport (100dvh)
    // so the whole subtree fills the available pane and tracks window resizes.
    <div style={{ position: 'relative', width: '100%', height: '100dvh' }}>
      {/* Atlas Layer */}
      <AnimatePresence>
        {atlasVisible && (
          <motion.div
            key="atlas-layer"
            data-testid="transition-atlas-layer"
            initial={{ opacity: transitionPhase === 'entering' ? 1 : 0 }}
            animate={{ opacity: mode === 'atlas' ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ATLAS_FADE_OUT_MS / 1000 }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              pointerEvents: mode === 'atlas' ? 'auto' : 'none',
            }}
          >
            {atlasContent}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Scene Layer */}
      <AnimatePresence>
        {isSceneMounted && (
          <motion.div
            key="scene-layer"
            data-testid="transition-scene-layer"
            initial={{ opacity: transitionPhase === 'exiting' ? 1 : 0 }}
            animate={{ opacity: mode === '3d' ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: CAMERA_LERP_UP_MS / 1000 }}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 2,
              pointerEvents: mode === '3d' ? 'auto' : 'none',
              opacity: getSceneOpacity(),
            }}
          >
            {sceneContent}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TransitionController;
