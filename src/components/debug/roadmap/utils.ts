// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 21/02/2026, 18:13:27
 * Dependents: RoadmapVisualizer.tsx, graph.ts, tree.ts
 * Imports: 2 files
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import { BRANCH_MAX_HEIGHT, BRANCH_MIN_HEIGHT, GRID_SIZE } from './constants';
import type { RelatedDoc, RenderNode, RoadmapNode, TreeNode } from './types';

/**
 * Technical:
 * Utility helpers used by roadmap tree building and render graph generation.
 *
 * Layman:
 * This file holds the shared "small tools" for naming cleanup, sizing cards,
 * doc-link normalization, connector curve math, and depth/count formatting.
 */

// ============================================================================
// Label / ID Normalization
// ============================================================================
// Technical: strips repeated feature prefixes and produces stable slugs.
// Layman: cleans up long labels and creates URL-safe ids for branch nodes.
// ============================================================================
export const stripFeaturePrefix = (label: string, projectLabel?: string) => {
  const trimmed = label.trim();
  if (projectLabel) {
    const normalizedLabel = trimmed.toLowerCase();
    const normalizedProject = projectLabel.trim().toLowerCase();
    const projectPrefix = `${normalizedProject} >`;
    if (normalizedLabel.startsWith(projectPrefix)) {
      return trimmed.slice(projectPrefix.length).trim();
    }
  }
  const firstArrow = trimmed.indexOf('>');
  const firstColon = trimmed.indexOf(':');
  if (firstColon >= 0 && (firstArrow === -1 || firstColon < firstArrow)) {
    return trimmed.slice(firstColon + 1).trim();
  }
  return trimmed;
};

export const slugify = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);

// Technical: grid snap helpers used by drag + computed layout.
// Layman: keeps cards aligned to the visual grid.
export const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;
const snapSizeUpToGrid = (value: number) => Math.ceil(value / GRID_SIZE) * GRID_SIZE;

// ============================================================================
// Branch Card Height Estimation
// ============================================================================
// Technical: estimates wrapped line count, then clamps to min/max branch heights.
// Layman: card height grows with text length but stays within safe limits.
// ============================================================================
const estimateWrappedLineCount = (text: string, maxCharsPerLine = 36) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let lines = 1;
  let current = 0;
  for (const word of words) {
    const wordLen = word.length;
    if (current === 0) {
      current = wordLen;
      continue;
    }
    if (current + 1 + wordLen <= maxCharsPerLine) {
      current += 1 + wordLen;
    } else {
      lines += 1;
      current = wordLen;
    }
  }
  return lines;
};

export const estimateBranchHeight = (label: string) => {
  const lines = Math.min(8, Math.max(1, estimateWrappedLineCount(label, 34)));
  const estimated = 44 + lines * 15;
  const clamped = Math.min(BRANCH_MAX_HEIGHT, Math.max(BRANCH_MIN_HEIGHT, estimated));
  return snapSizeUpToGrid(clamped);
};

// ============================================================================
// Status Merge
// ============================================================================
// Technical: reduces child statuses into a single aggregate status value.
// Layman: decides whether a parent should read done/active/planned.
// ============================================================================
export const mergeStatus = (statuses: Array<'done' | 'active' | 'planned'>): 'done' | 'active' | 'planned' => {
  if (statuses.length === 0) return 'planned';
  if (statuses.some((s) => s === 'active')) return 'active';
  if (statuses.some((s) => s === 'planned')) return 'planned';
  return 'done';
};

// ============================================================================
// Related Doc Parsing / Normalization
// ============================================================================
// Technical: extracts doc paths from legacy description text and canonical arrays.
// Layman: turns mixed doc references into one clean clickable list.
// ============================================================================
const parseRelatedDocs = (description?: string) => {
  if (!description) return [] as string[];
  const marker = 'Related doc(s):';
  const idx = description.indexOf(marker);
  if (idx < 0) return [] as string[];
  return description
    .slice(idx + marker.length)
    .split('|')
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && !/^\+\d+\s+more$/i.test(item));
};

const normalizePath = (value: string) => value.replace(/\\/g, '/').trim();
const baseName = (value: string) => {
  const normalized = normalizePath(value);
  const parts = normalized.split('/');
  return (parts[parts.length - 1] || normalized).toLowerCase();
};
const toAppDocHref = (docPath: string) => `/Aralia/${encodeURI(normalizePath(docPath))}`;

export const collectRelatedDocs = (milestones: RoadmapNode[]): RelatedDoc[] => {
  // Technical: de-duplicates by normalized source path while preserving canonical target.
  // Layman: avoid showing the same doc twice in the detail panel.
  const docs: RelatedDoc[] = [];
  const seenSources = new Set<string>();

  for (const milestone of milestones) {
    const sourceDocs = (milestone.sourceDocs && milestone.sourceDocs.length > 0)
      ? milestone.sourceDocs
      : parseRelatedDocs(milestone.description);
    const canonicalDocs = (milestone.canonicalDocs ?? []).map(normalizePath);

    const findCanonicalForSource = (sourcePath: string) => {
      if (canonicalDocs.length === 1) return canonicalDocs[0];
      const sourceBase = baseName(sourcePath);
      return canonicalDocs.find((candidate) => baseName(candidate) === sourceBase);
    };

    for (const rawSource of sourceDocs) {
      const sourcePath = normalizePath(rawSource);
      if (!sourcePath) continue;
      const sourceKey = sourcePath.toLowerCase();
      if (seenSources.has(sourceKey)) continue;

      const canonicalPath = findCanonicalForSource(sourcePath);
      docs.push({
        sourcePath,
        canonicalPath,
        href: toAppDocHref(canonicalPath || sourcePath)
      });
      seenSources.add(sourceKey);
    }

    if (sourceDocs.length === 0) {
      for (const canonicalPath of canonicalDocs) {
        const sourceKey = canonicalPath.toLowerCase();
        if (seenSources.has(sourceKey)) continue;
        docs.push({
          sourcePath: canonicalPath,
          canonicalPath,
          href: toAppDocHref(canonicalPath)
        });
        seenSources.add(sourceKey);
      }
    }
  }

  return docs;
};

// ============================================================================
// Path / Geometry Helpers
// ============================================================================
// Technical: bezier curve helpers and center-point calculation for connectors.
// Layman: math used to draw smooth lines between roadmap cards.
// ============================================================================
export const buildCurvePath = (startX: number, startY: number, endX: number, endY: number, side: 1 | -1) => {
  // Technical: clamp bezier handle distance to actual span so short links do not
  // over-bend or fold back when nodes are close together.
  // Layman: if two cards are near each other, keep the curve gentle instead of
  // forcing the same huge bend used for long-distance links.
  const dx = Math.abs(endX - startX);
  const handle = Math.min(120, Math.max(24, dx * 0.45));
  const c1x = startX + side * handle;
  const c2x = endX - side * handle;

  // Technical: avoid perfectly flat cubic paths because some browsers can treat
  // their filtered bbox as zero-height, which intermittently hides glow-stroked
  // connectors even though strokeWidth is non-zero.
  // Layman: we add a tiny up/down bend to almost-horizontal links so they keep
  // showing up instead of disappearing at certain layouts.
  const isNearlyFlat = Math.abs(endY - startY) < 0.5;
  const bendY = isNearlyFlat ? 4 : 0;
  const c1y = startY - bendY;
  const c2y = endY + bendY;
  return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
};

export const buildTrunkPath = (startX: number, startY: number, endX: number, endY: number) => {
  const cy = (startY + endY) / 2;
  return `M ${startX} ${startY} C ${startX} ${cy}, ${endX} ${cy}, ${endX} ${endY}`;
};

export const centerOf = (node: RenderNode) => ({
  x: node.x + node.width / 2,
  y: node.y + node.height / 2
});

// Technical: stable sort helper for roadmap nodes.
// Layman: keeps alphabetical ordering consistent.
export const compareNodes = (a: RoadmapNode, b: RoadmapNode) => a.label.localeCompare(b.label);

// ============================================================================
// Depth Count Helpers
// ============================================================================
// Technical: computes child counts by depth for badges like L2/L3/L4.
// Layman: counts how many deeper cards exist under a branch/project.
// ============================================================================
export const collectDescendantDepthCounts = (node: TreeNode) => {
  const counts = new Map<number, number>();
  const walk = (current: TreeNode) => {
    for (const child of current.children) {
      counts.set(child.depth, (counts.get(child.depth) ?? 0) + 1);
      walk(child);
    }
  };
  walk(node);
  return counts;
};

export const collectProjectDepthCounts = (roots: TreeNode[]) => {
  const counts = new Map<number, number>();
  for (const root of roots) {
    counts.set(root.depth, (counts.get(root.depth) ?? 0) + 1);
    const childCounts = collectDescendantDepthCounts(root);
    for (const [depth, count] of childCounts) {
      counts.set(depth, (counts.get(depth) ?? 0) + count);
    }
  }
  return counts;
};

// Technical: map depth-count structures to sorted display arrays.
// Layman: converts raw counts into readable level labels for the UI.
export const toLevelCountArray = (counts: Map<number, number>) =>
  Array.from(counts.entries())
    .filter(([, count]) => count > 0)
    .sort((a, b) => a[0] - b[0])
    .map(([level, count]) => ({ level, count }));

export const formatLevelCounts = (counts: Array<{ level: number; count: number }>, maxLevels = 4) => {
  if (!counts || counts.length === 0) return '';
  const visible = counts.slice(0, maxLevels).map((item) => `L${item.level}:${item.count}`);
  const remaining = counts.length - visible.length;
  return remaining > 0 ? `${visible.join(' ')} +${remaining}` : visible.join(' ');
};
