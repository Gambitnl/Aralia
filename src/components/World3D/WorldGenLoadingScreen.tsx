/**
 * @file WorldGenLoadingScreen.tsx
 * @description The loading view shown while the 3D world assembles off the main
 * thread (staged 3D world entry). Replaces the old error-looking "World data is
 * not ready" placeholder with honest, advancing stage text over a progress bar.
 *
 * The stages map to real work in the world-gen pipeline:
 *   land    — resolving the region (getWorldforgeLocalForCell)
 *   town    — assembling terrain + town (makeGroundWorld); begins on the worker's
 *             'town' progress signal
 *   details — placing props (Stage B), after terrain + town are already visible
 *
 * The parent (World3DWrapper) decides which stage to show from the world-gen
 * client's callbacks, and unmounts this screen once the scene can render.
 *
 * See docs/superpowers/specs/2026-07-06-staged-offthread-3d-world-entry-design.md.
 */
import React from 'react';

export type WorldGenLoadingStage = 'land' | 'town' | 'details';

const STAGE_COPY: Record<WorldGenLoadingStage, { label: string; percent: number }> = {
  land: { label: 'Shaping the land…', percent: 33 },
  town: { label: 'Raising the town…', percent: 66 },
  details: { label: 'Scattering details…', percent: 90 },
};

interface Props {
  stage: WorldGenLoadingStage;
}

const WorldGenLoadingScreen: React.FC<Props> = ({ stage }) => {
  const { label, percent } = STAGE_COPY[stage];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '520px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        background: 'var(--bg-surface-alt, #1e2e3e)',
        color: 'var(--text-primary, #dfe7ef)',
        fontFamily: 'Outfit, sans-serif',
        borderRadius: '12px',
        border: '1px solid var(--border-color, #3a4a5a)',
      }}
    >
      <div style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '0.01em' }}>{label}</div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Building the world"
        style={{
          width: 'min(340px, 70%)',
          height: '6px',
          borderRadius: '999px',
          background: 'var(--border-color, #3a4a5a)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${percent}%`,
            height: '100%',
            borderRadius: '999px',
            background: 'var(--accent, #6fb3ff)',
            transition: 'width 240ms ease-out',
          }}
        />
      </div>
    </div>
  );
};

export default WorldGenLoadingScreen;
