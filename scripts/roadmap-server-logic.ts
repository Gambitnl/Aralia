/**
 * Technical:
 * This wrapper keeps Vite config buildable even when local-only roadmap engine
 * files are intentionally absent from the repo (ignored and not on GitHub).
 *
 * Layman:
 * GitHub CI should not fail just because private/local roadmap tooling files are
 * missing. So this file provides safe fallback implementations for roadmap APIs.
 *
 * Why this exists:
 * - The project intentionally does not sync roadmap engine internals to GitHub.
 * - Vite config still references roadmap API handlers during config bundling.
 * - Static imports to missing local files break CI with "Could not resolve ..."
 * - These fallbacks keep the app buildable while local roadmap tooling remains optional.
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

// ============================================================================
// Shared Types (Minimal Contract)
// ============================================================================
// Technical: these are the minimal shapes used by Vite roadmap endpoints.
// Layman: enough structure so the roadmap API can return valid JSON safely.
// ============================================================================
export type RoadmapNode = {
  id: string;
  label: string;
  type: 'root' | 'project' | 'milestone';
  status: 'planned' | 'active' | 'done';
  // Optional test source path and latest execution metadata for health-signal UI.
  testFile?: string;
  lastTestRun?: {
    timestamp: string;
    status: 'pass' | 'fail' | 'unverified';
  };
  // Optional list of component files tied to this node for atomization checks.
  componentFiles?: string[];
  [key: string]: unknown;
};

export type RoadmapEdge = {
  from: string;
  to: string;
  type?: string;
};

export type RoadmapData = {
  version: string;
  root: string;
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
};

export type OpportunityScanTrigger = 'manual' | 'auto' | 'on-demand';

export type OpportunitySettings = {
  autoScanMinutes: number;
  staleDays: number;
  maxCrosslinkMatchesPerNode: number;
  maxSnapshotEntries: number;
  keepSnapshots: boolean;
};

export type OpportunityScanPayload = {
  version: string;
  scanId: string;
  generatedAt: string;
  trigger: OpportunityScanTrigger;
  settings: OpportunitySettings;
  summary: {
    totalNodes: number;
    flaggedDirectNodes: number;
    flaggedPropagatedNodes: number;
    flagTotals: Record<string, number>;
  };
  nodes: Array<Record<string, unknown>>;
};

// ============================================================================
// Fallback State
// ============================================================================
// Technical: in-memory fallback settings used when local roadmap engine is absent.
// Layman: roadmap API still works, but returns an empty/safe baseline in CI.
// ============================================================================
const DEFAULT_SETTINGS: OpportunitySettings = {
  autoScanMinutes: 15,
  staleDays: 21,
  maxCrosslinkMatchesPerNode: 5,
  maxSnapshotEntries: 200,
  keepSnapshots: true
};

let fallbackSettings: OpportunitySettings = { ...DEFAULT_SETTINGS };
let fallbackLatestScan: OpportunityScanPayload | null = null;

// ============================================================================
// Local Engine Bridge
// ============================================================================
// Technical: calls local-only roadmap engine through a tsx subprocess when those
// files are available on disk.
// Layman: local dev keeps full roadmap behavior; GitHub/CI (without roadmap files)
// automatically drops to safe fallback mode.
// ============================================================================
const ROADMAP_ENGINE_GENERATE_PATH = path.resolve(process.cwd(), 'scripts', 'roadmap-engine', 'generate.ts');
const ROADMAP_ENGINE_OPPORTUNITIES_PATH = path.resolve(process.cwd(), 'scripts', 'roadmap-engine', 'opportunities.ts');
const ROADMAP_LOCAL_BRIDGE_PATH = path.resolve(process.cwd(), 'scripts', 'roadmap-local-bridge.ts');

const hasLocalRoadmapEngine =
  fs.existsSync(ROADMAP_ENGINE_GENERATE_PATH) &&
  fs.existsSync(ROADMAP_ENGINE_OPPORTUNITIES_PATH) &&
  fs.existsSync(ROADMAP_LOCAL_BRIDGE_PATH);

type BridgeAction =
  | 'generate-roadmap'
  | 'load-latest-opportunities'
  | 'read-opportunity-settings'
  | 'write-opportunity-settings'
  | 'scan-opportunities';

const runBridge = <T>(action: BridgeAction, payload?: unknown): T | null => {
  if (!hasLocalRoadmapEngine) return null;
  const args = ['tsx', ROADMAP_LOCAL_BRIDGE_PATH, action];
  if (payload !== undefined) args.push(JSON.stringify(payload));

  const result = spawnSync('npx', args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    windowsHide: true
  });

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim();
    console.warn(`[roadmap-server-logic] Local bridge failed for "${action}". Falling back. ${err}`);
    return null;
  }

  const raw = (result.stdout || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    console.warn(`[roadmap-server-logic] Bridge returned non-JSON for "${action}". Falling back.`);
    return null;
  }
};

// ============================================================================
// Roadmap Data Fallback
// ============================================================================
// Technical: deterministic empty roadmap payload used when roadmap engine is local-only.
// Layman: keeps UI/API stable without shipping private roadmap tooling to GitHub.
// ============================================================================
export function generateRoadmapData(): RoadmapData {
  const local = runBridge<RoadmapData>('generate-roadmap');
  if (local) return local;

  return {
    version: '2.1.0-fallback',
    root: 'aralia_chronicles',
    nodes: [
      {
        id: 'aralia_chronicles',
        label: 'Aralia Game Roadmap (Local Tooling Not Synced)',
        type: 'root',
        status: 'active',
        description:
          'Roadmap engine files are local-only and intentionally excluded from this build.'
      }
    ],
    edges: []
  };
}

// ============================================================================
// Opportunities Fallback
// ============================================================================
// Technical: no-op opportunity scanner contract for builds without local roadmap engine.
// Layman: endpoints stay callable, but report empty opportunity results.
// ============================================================================
export function loadLatestOpportunityScan(): OpportunityScanPayload | null {
  const local = runBridge<OpportunityScanPayload | null>('load-latest-opportunities');
  if (local) return local;
  return fallbackLatestScan;
}

export function readOpportunitySettings(): OpportunitySettings {
  const local = runBridge<OpportunitySettings>('read-opportunity-settings');
  if (local) return local;
  return { ...fallbackSettings };
}

export function writeOpportunitySettings(input: unknown): OpportunitySettings {
  const local = runBridge<OpportunitySettings>('write-opportunity-settings', input);
  if (local) return local;

  const parsed = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const next: OpportunitySettings = {
    autoScanMinutes:
      typeof parsed.autoScanMinutes === 'number' && Number.isFinite(parsed.autoScanMinutes)
        ? Math.max(1, Math.floor(parsed.autoScanMinutes))
        : fallbackSettings.autoScanMinutes,
    staleDays:
      typeof parsed.staleDays === 'number' && Number.isFinite(parsed.staleDays)
        ? Math.max(1, Math.floor(parsed.staleDays))
        : fallbackSettings.staleDays,
    maxCrosslinkMatchesPerNode:
      typeof parsed.maxCrosslinkMatchesPerNode === 'number' &&
      Number.isFinite(parsed.maxCrosslinkMatchesPerNode)
        ? Math.max(1, Math.floor(parsed.maxCrosslinkMatchesPerNode))
        : fallbackSettings.maxCrosslinkMatchesPerNode,
    maxSnapshotEntries:
      typeof parsed.maxSnapshotEntries === 'number' && Number.isFinite(parsed.maxSnapshotEntries)
        ? Math.max(1, Math.floor(parsed.maxSnapshotEntries))
        : fallbackSettings.maxSnapshotEntries,
    keepSnapshots:
      typeof parsed.keepSnapshots === 'boolean'
        ? parsed.keepSnapshots
        : fallbackSettings.keepSnapshots
  };

  fallbackSettings = next;
  return { ...fallbackSettings };
}

export function scanRoadmapOpportunities(
  roadmap: RoadmapData,
  options?: { trigger?: OpportunityScanTrigger }
): OpportunityScanPayload {
  // Technical: do not pass full roadmap payload over CLI args (can exceed command-line limits).
  // Layman: the bridge builds roadmap data on its side; we only pass scan options.
  const local = runBridge<OpportunityScanPayload>('scan-opportunities', { options });
  if (local) return local;

  const nowIso = new Date().toISOString();
  const payload: OpportunityScanPayload = {
    version: '1.0.0-fallback',
    scanId: `scan-${nowIso.replace(/[:.]/g, '-')}`,
    generatedAt: nowIso,
    trigger: options?.trigger ?? 'on-demand',
    settings: { ...fallbackSettings },
    summary: {
      totalNodes: roadmap.nodes.length,
      flaggedDirectNodes: 0,
      flaggedPropagatedNodes: 0,
      flagTotals: {}
    },
    nodes: []
  };

  fallbackLatestScan = payload;
  return payload;
}
