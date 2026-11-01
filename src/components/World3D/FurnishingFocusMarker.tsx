/** Outline the exact reached furnishing nominated by the nearby-object list.
 * The outline follows the building's existing transform and respects depth, so
 * it cannot reveal a piece through a wall. It has no pointer or collision role
 * and disappears when focus, the source part, or the live interior disappears. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 31/10/2026, 20:26:15
 * Dependents: components/World3D/World3DScene.tsx
 * Imports: 2 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, {useEffect, useMemo} from 'react';
import {BoxGeometry, EdgesGeometry} from 'three';
import type {SitePart} from '@/systems/worldforge/bridge/interiorParts';
import {sitePartLocalOffset} from '@/systems/worldforge/bridge/sitePartTransform';

type FocusPart = Pick<SitePart, 'x' | 'z' | 'w' | 'd' | 'h' | 'baseY' | 'furnishing'>;

/** A reused array index on another floor or building is a different object. */
export function focusedFurnishingPart(siteId: string, parts: readonly FocusPart[] | undefined,
  focusedId: string | null | undefined): FocusPart | undefined {
  return focusedId ? parts?.find(part => part.furnishing && part.w > 0 && part.d > 0 && part.h > 0
    && `${siteId}/${part.furnishing.level}/${part.furnishing.index}` === focusedId) : undefined;
}

export function FurnishingFocusMarker({siteId, parts, doorZSign, focusedId}: {
  siteId: string; parts?: readonly FocusPart[]; doorZSign: number; focusedId?: string | null;
}) {
  const part = focusedFurnishingPart(siteId, parts, focusedId);
  const geometry = useMemo(() => {
    if (!part) return null;
    const box = new BoxGeometry(part.w + .04, part.h + .04, part.d + .04);
    const outline = new EdgesGeometry(box);
    box.dispose();
    return outline;
  }, [part?.w, part?.h, part?.d, Boolean(part)]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!part || !geometry) return null;
  const at = sitePartLocalOffset(part, doorZSign);
  return <lineSegments geometry={geometry} position={[at.x, at.y, at.z]} raycast={() => undefined}>
    <lineBasicMaterial color="#fcd34d" toneMapped={false} depthTest depthWrite={false} />
  </lineSegments>;
}
