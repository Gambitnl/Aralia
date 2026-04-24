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
import { buildMediaSet, hasMediaFile } from './roadmap/node-media-presence/media-scanner';

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
  // Optional flag marking this node as the live Spells navigator entry point.
  spellTree?: boolean;
  hasMedia?: boolean;   // true when .media/<id>.* exists on disk
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

export type RoadmapHistoryTraceabilityRequest = {
  repoRoot: string;
  selectedNodeId?: string | null;
  selectedNodeLabel?: string | null;
  selectedPaths?: string[];
  componentFiles?: string[];
  docPaths?: string[];
  limit?: number;
};

export type RoadmapHistoryTraceabilityCommit = {
  hash: string;
  shortHash: string;
  authorName: string;
  authoredAt: string;
  subject: string;
  body: string;
  affectedPaths: string[];
};

export type RoadmapHistoryTraceabilityPathSummary = {
  path: string;
  commitCount: number;
  lastTouchedAt: string | null;
};

export type RoadmapHistoryTraceabilityPayload = {
  status: 'ok' | 'empty' | 'unavailable';
  generatedAt: string;
  request: {
    selectedNodeId: string | null;
    selectedNodeLabel: string | null;
    limit: number;
  };
  resolvedPaths: string[];
  commits: RoadmapHistoryTraceabilityCommit[];
  pathSummaries: RoadmapHistoryTraceabilityPathSummary[];
  summary: {
    commitCount: number;
    uniquePathCount: number;
  };
  note?: string;
};

export type LoadRoadmapHistoryTraceabilityInput = Omit<RoadmapHistoryTraceabilityRequest, 'repoRoot'>;

export type TestPresenceResult = {
  testFileDeclared: boolean;
  testFileExists: boolean;
  resolvedPath?: string;
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
// CI-Safe Roadmap Helper Fallbacks
// ============================================================================
// Technical: keep the server logic buildable when ignored roadmap helper files
// are not present in GitHub Actions. These helpers intentionally duplicate the
// small local-only modules instead of importing them statically.
//
// Layman: GitHub gets the simple built-in version it needs to build, while local
// roadmap tooling can keep its richer ignored files without blocking CI.
// ============================================================================
const DEFAULT_HISTORY_LIMIT = 12;
const MAX_HISTORY_LIMIT = 50;
const MAX_SELECTED_PATHS = 24;

function checkTestPresence(node: RoadmapNode, repoRoot: string): TestPresenceResult {
  // Nodes with no declared test file are immediately marked as undeclared/missing.
  if (!node.testFile) {
    return { testFileDeclared: false, testFileExists: false };
  }

  // Resolve the declared path from the repository root and probe the filesystem.
  const resolvedPath = path.resolve(repoRoot, node.testFile);
  return {
    testFileDeclared: true,
    testFileExists: fs.existsSync(resolvedPath),
    resolvedPath
  };
}

function normalizeRoadmapHistoryPath(rawPath: string, repoRoot: string): string | null {
  // Ignore blank values so callers can pass partial node metadata safely.
  if (!rawPath.trim()) return null;

  const normalizedRepoRoot = repoRoot.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedInput = rawPath.replace(/\\/g, '/').trim();

  // Convert absolute in-repo paths back to repo-relative git pathspecs.
  if (normalizedInput.startsWith(normalizedRepoRoot + '/')) {
    return normalizedInput.slice(normalizedRepoRoot.length + 1);
  }

  // Reject absolute paths outside the repo; the server should only ask git about
  // files that belong to this checkout.
  if (/^[A-Za-z]:\//.test(normalizedInput) || normalizedInput.startsWith('//')) {
    return null;
  }

  // Drop leading "./" noise so payloads remain stable for UI consumers.
  return normalizedInput.replace(/^\.\/+/, '');
}

function resolveRoadmapHistoryPaths(request: RoadmapHistoryTraceabilityRequest): string[] {
  const candidates = [
    ...(request.selectedPaths ?? []),
    ...(request.componentFiles ?? []),
    ...(request.docPaths ?? [])
  ];

  const deduped = new Set<string>();

  // Fold every incoming path into one small git-friendly set.
  for (const candidate of candidates) {
    const normalized = normalizeRoadmapHistoryPath(candidate, request.repoRoot);
    if (!normalized) continue;
    deduped.add(normalized);
    if (deduped.size >= MAX_SELECTED_PATHS) break;
  }

  return Array.from(deduped);
}

function normalizeRoadmapHistoryLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_HISTORY_LIMIT;
  return Math.max(1, Math.min(MAX_HISTORY_LIMIT, Math.floor(limit as number)));
}

function parseRoadmapHistoryGitOutput(rawOutput: string): RoadmapHistoryTraceabilityCommit[] {
  if (!rawOutput.trim()) return [];

  return rawOutput
    .split('\u001e')
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [headerLine = '', ...pathLines] = record.split(/\r?\n/);
      const [hash = '', shortHash = '', authorName = '', authoredAt = '', subject = '', body = ''] =
        headerLine.split('\u001f');

      return {
        hash,
        shortHash,
        authorName,
        authoredAt,
        subject,
        body: body.trim(),
        affectedPaths: pathLines.map((line) => line.trim()).filter(Boolean)
      };
    })
    .filter((commit) => Boolean(commit.hash) && Boolean(commit.authoredAt));
}

function buildRoadmapHistoryTraceabilityPayload(input: {
  request: RoadmapHistoryTraceabilityRequest;
  generatedAt?: string;
  commits: RoadmapHistoryTraceabilityCommit[];
  resolvedPaths?: string[];
  status?: RoadmapHistoryTraceabilityPayload['status'];
  note?: string;
}): RoadmapHistoryTraceabilityPayload {
  const resolvedPaths = input.resolvedPaths ?? resolveRoadmapHistoryPaths(input.request);
  const resolvedPathSet = new Set(resolvedPaths);
  const pathSummaryMap = new Map<string, RoadmapHistoryTraceabilityPathSummary>();

  // Count recent touches only for the selected roadmap files.
  for (const commit of input.commits) {
    for (const affectedPath of commit.affectedPaths) {
      if (!resolvedPathSet.has(affectedPath)) continue;
      const current = pathSummaryMap.get(affectedPath);
      if (current) {
        current.commitCount += 1;
        if (!current.lastTouchedAt || commit.authoredAt > current.lastTouchedAt) {
          current.lastTouchedAt = commit.authoredAt;
        }
        continue;
      }

      pathSummaryMap.set(affectedPath, {
        path: affectedPath,
        commitCount: 1,
        lastTouchedAt: commit.authoredAt || null
      });
    }
  }

  const status =
    input.status ??
    (resolvedPaths.length === 0 ? 'empty' : input.commits.length === 0 ? 'empty' : 'ok');

  return {
    status,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    request: {
      selectedNodeId: input.request.selectedNodeId ?? null,
      selectedNodeLabel: input.request.selectedNodeLabel ?? null,
      limit: normalizeRoadmapHistoryLimit(input.request.limit)
    },
    resolvedPaths,
    commits: input.commits,
    pathSummaries: Array.from(pathSummaryMap.values()).sort((left, right) => {
      if (left.commitCount !== right.commitCount) return right.commitCount - left.commitCount;
      return left.path.localeCompare(right.path);
    }),
    summary: {
      commitCount: input.commits.length,
      uniquePathCount: pathSummaryMap.size
    },
    note: input.note
  };
}

// ============================================================================
// Local Engine Bridge
// ============================================================================
// Technical: calls local-only roadmap engine through a tsx subprocess when those
// files are available on disk.
// Layman: local dev keeps full roadmap behavior; GitHub/CI (without roadmap files)
// automatically drops to safe fallback mode.
// ============================================================================
const ROADMAP_ENGINE_GENERATE_PATH = path.resolve(process.cwd(), 'devtools', 'roadmap', 'scripts', 'roadmap-engine', 'generate.ts');
const ROADMAP_ENGINE_OPPORTUNITIES_PATH = path.resolve(process.cwd(), 'devtools', 'roadmap', 'scripts', 'roadmap-engine', 'opportunities.ts');
const ROADMAP_LOCAL_BRIDGE_PATH = path.resolve(process.cwd(), 'devtools', 'roadmap', 'scripts', 'roadmap-local-bridge.ts');

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
// Roadmap Data Cache
// ============================================================================
// Technical: in-process cache so repeated requests (e.g. React StrictMode double-
// invoke, or the opportunities endpoint also calling generateRoadmapData) re-use
// the result of the first expensive `npx tsx` bridge spawn instead of paying the
// ~1.3–2s startup cost on every request.
// Layman: the roadmap data is computed once and kept in memory; refreshes only happen
// when the cache is manually cleared (e.g. on file-watch events).
// ============================================================================
let _roadmapDataCache: RoadmapData | null = null;

export function clearRoadmapDataCache(): void {
  _roadmapDataCache = null;
}

// ============================================================================
// Roadmap Data Fallback
// ============================================================================
// Technical: deterministic empty roadmap payload used when roadmap engine is local-only.
// Layman: keeps UI/API stable without shipping private roadmap tooling to GitHub.
// ============================================================================
export function generateRoadmapData(): RoadmapData {
  if (_roadmapDataCache) return _roadmapDataCache;
  const local = runBridge<RoadmapData>('generate-roadmap');

  // Technical: choose local engine output when available, otherwise deterministic fallback.
  // Layman: use real roadmap data in local dev; otherwise use one safe placeholder node.
  const data: RoadmapData = local ?? {
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

  // Technical: annotate each node with whether test metadata is declared and whether
  // the declared test path exists at the current repository root.
  // Layman: every roadmap card gets "did we declare a test?" and "does that file exist?"
  // flags so downstream health UI can show accurate warnings.
  const repoRoot = process.cwd();
  data.nodes = data.nodes.map((node: RoadmapNode) => {
    const presence = checkTestPresence(node, repoRoot);
    return {
      ...node,
      testFileExists: presence.testFileExists,
      testFileDeclared: presence.testFileDeclared
    };
  });

  // Technical: scan .media/ once per data request and stamp hasMedia on matching nodes.
  // Layman: each node gets a flag that tells the UI whether a preview image exists for it.
  const mediaDir = path.resolve(process.cwd(), 'devtools', 'roadmap', '.media');
  const mediaSet = buildMediaSet(mediaDir);
  data.nodes = data.nodes.map((node: RoadmapNode) => ({
    ...node,
    hasMedia: hasMediaFile(node.id, mediaSet) || undefined
  }));

  // Technical: inject the live Spells navigator node if not already present.
  // Layman: this is the "Spells" circle on the roadmap — clicking it opens the live spell tree.
  if (!data.nodes.some((n: RoadmapNode) => n.id === 'pillar_spells')) {
    data.nodes.push({
      id: 'pillar_spells',
      label: 'Spells',
      type: 'project',
      status: 'active',
      initialX: 1380,
      initialY: 400,
      description: 'Live spell navigator — drill through axes to explore all 469 spell profiles.',
      spellTree: true,
      testFileExists: false,
      testFileDeclared: false,
    } as RoadmapNode);
  }

  _roadmapDataCache = data;
  return data;
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

// ============================================================================
// Roadmap History Traceability
// ============================================================================
// Technical: local-first helper that queries recent git history for roadmap-
// related paths selected by the visualizer.
// Layman: given a node's docs/component files, this returns the recent commits
// that touched those files so the UI can show "what changed around this node?".
// ============================================================================
export function loadRoadmapHistoryTraceability(
  input: LoadRoadmapHistoryTraceabilityInput
): RoadmapHistoryTraceabilityPayload {
  const request: RoadmapHistoryTraceabilityRequest = {
    repoRoot: process.cwd(),
    ...input
  };

  // Resolve and dedupe the selected file anchors before invoking git so the
  // command stays small and Windows-friendly.
  const resolvedPaths = resolveRoadmapHistoryPaths(request);
  if (resolvedPaths.length === 0) {
    return buildRoadmapHistoryTraceabilityPayload({
      request,
      resolvedPaths,
      commits: [],
      status: 'empty',
      note: 'No roadmap-related file paths were provided for history tracing.'
    });
  }

  const limit = normalizeRoadmapHistoryLimit(request.limit);
  const gitArgs = [
    'log',
    `-${limit}`,
    '--date=iso-strict',
    '--format=%x1e%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1f%b',
    '--name-only',
    '--',
    ...resolvedPaths
  ];

  // Use the local repository only. This feature is intentionally "what does my
  // current roadmap workspace know?" rather than a remote-hosted history API.
  const result = spawnSync('git', gitArgs, {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: process.platform === 'win32',
    windowsHide: true
  });

  if (result.status !== 0) {
    const errorText = (result.stderr || result.stdout || '').trim();
    return buildRoadmapHistoryTraceabilityPayload({
      request,
      resolvedPaths,
      commits: [],
      status: 'unavailable',
      note: errorText || 'git log failed for the selected roadmap paths.'
    });
  }

  const commits = parseRoadmapHistoryGitOutput(result.stdout || '');
  return buildRoadmapHistoryTraceabilityPayload({
    request: { ...request, limit },
    resolvedPaths,
    commits,
    status: commits.length > 0 ? 'ok' : 'empty',
    note:
      commits.length > 0
        ? undefined
        : 'No recent git history was found for the selected roadmap-related paths.'
  });
}
