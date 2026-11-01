// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 28/10/2026, 18:46:33
 * Dependents: components/World3D/SceneCast.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React from 'react';

interface Props {
  id: string;
  name: string;
  isPlayer?: boolean;
  onTalk?: () => void;
}

/** Use the same presence-checked talk action as the body. A name should not
 * require finding one small raycastable patch of an animated figure. */
export function SceneCastNameplate({ id, name, isPlayer, onTalk }: Props) {
  const interactive = !isPlayer && !!onTalk;
  const Label = interactive ? 'button' : 'div';
  return (
    <Label
      type={interactive ? 'button' : undefined}
      data-testid={`scene-cast-label-${id}`}
      data-player={isPlayer ? 'true' : 'false'}
      title={interactive ? `Talk to ${name}` : name}
      aria-label={interactive ? `Talk to ${name}` : name}
      className={interactive ? 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300 hover:bg-slate-700' : undefined}
      onPointerDown={interactive ? event => {
        if (event.button === 0) event.stopPropagation();
      } : undefined}
      onClick={interactive ? event => {
        if (event.button !== 0) return;
        event.stopPropagation();
        onTalk?.();
      } : undefined}
      onKeyDown={interactive ? event => {
        // Native Enter/Space activation is speech, not the world's movement input.
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
      } : undefined}
      onKeyUp={interactive ? event => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
      } : undefined}
      style={{
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: interactive ? 'pointer' : undefined,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        color: 'white',
        fontSize: '12px',
        lineHeight: '18px',
        maxWidth: 'min(180px, calc(100vw - 16px))',
        boxSizing: 'border-box',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontFamily: 'Outfit, sans-serif',
        padding: '2px 7px',
        borderRadius: '4px',
        background: isPlayer ? 'rgba(37, 99, 235, 0.82)' : 'rgba(9, 19, 28, 0.92)',
        border: '1px solid rgba(148, 163, 184, 0.5)',
      }}
    >
      {isPlayer ? `${name} (you)` : interactive ? `💬 ${name}` : name}
    </Label>
  );
}
