import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, FileText, GitBranch, ListChecks, RefreshCcw, Search, ShieldCheck } from 'lucide-react';

import type { AtlasBacklogRetirementExport, AtlasRawExport } from './atlasTypes';
import { buildAtlasViewModel } from './atlasViewModel';
import './atlasExplorer.css';

/**
 * Browser-visible explorer for the Aralia Atlas Knowledge Tree.
 *
 * This page turns the nightly Atlas export into a branch browser: left side for
 * Knowledge Tree branches, right side for attached documents and plan health.
 * It is a dev/tooling surface, not part of the player-facing game UI.
 *
 * Called by: src/atlas-entry.tsx
 * Depends on: the local Vite `/api/atlas/knowledge-tree` endpoint
 */

// ============================================================================
// Data Loading Helpers
// ============================================================================
// This section fetches the latest Atlas export from the local dev server. If the
// export is missing, the UI shows the exact command needed to generate it.
// ============================================================================

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: AtlasRawExport }
  | { status: 'error'; message: string };

type BacklogState =
  | { status: 'loading' }
  | { status: 'ready'; data: AtlasBacklogRetirementExport }
  | { status: 'error'; message: string };

async function loadKnowledgeTree(): Promise<AtlasRawExport> {
  const response = await fetch('/api/atlas/knowledge-tree');
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'Atlas export could not be loaded.');
  }
  return payload as AtlasRawExport;
}

async function loadBacklogRetirement(): Promise<AtlasBacklogRetirementExport> {
  const response = await fetch('/api/atlas/backlog-retirement');
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'Backlog retirement state could not be loaded.');
  }
  return payload as AtlasBacklogRetirementExport;
}

// ============================================================================
// Explorer Component
// ============================================================================
// This section renders the actual Knowledge Tree explorer with search, branch
// selection, summary counters, and document rows.
// ============================================================================

export function AtlasExplorer(): React.ReactElement {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [backlogState, setBacklogState] = useState<BacklogState>({ status: 'loading' });
  const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;

    loadKnowledgeTree()
      .then((data) => {
        if (!cancelled) setLoadState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!cancelled) setLoadState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadBacklogRetirement()
      .then((data) => {
        if (!cancelled) setBacklogState({ status: 'ready', data });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!cancelled) setBacklogState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const model = useMemo(() => {
    if (loadState.status !== 'ready') return null;
    return buildAtlasViewModel(loadState.data, selectedBranchId);
  }, [loadState, selectedBranchId]);

  const visibleBranches = useMemo(() => {
    if (!model) return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return model.branches;
    return model.branches.filter((branch) => branch.name.toLowerCase().includes(normalizedQuery));
  }, [model, query]);

  if (loadState.status === 'loading') {
    return (
      <main className="atlas-shell atlas-shell-centered">
        <RefreshCcw className="atlas-spin" aria-hidden="true" />
        <p>Loading Aralia Atlas</p>
      </main>
    );
  }

  if (loadState.status === 'error') {
    return (
      <main className="atlas-shell atlas-shell-centered">
        <AlertTriangle aria-hidden="true" />
        <h1>Aralia Atlas</h1>
        <p>{loadState.message}</p>
        <code>npm run atlas -- reconcile --target F:\Repos\Aralia</code>
      </main>
    );
  }

  if (!model) {
    return (
      <main className="atlas-shell atlas-shell-centered">
        <AlertTriangle aria-hidden="true" />
        <p>Atlas export is empty.</p>
      </main>
    );
  }

  const selectedBranch = model.selectedBranch;

  return (
    <main className="atlas-shell">
      <RecentAtlasWorkBanner state={backlogState} />

      <header className="atlas-header">
        <div>
          <p className="atlas-kicker">Aralia Atlas</p>
          <h1>Knowledge Tree Explorer</h1>
        </div>
        <div className="atlas-generated">Last reconciliation: {new Date(model.generatedAt).toLocaleString()}</div>
      </header>

      <BacklogRetirementPanel state={backlogState} />

      <section className="atlas-summary" aria-label="Atlas summary">
        <div><strong>{model.summary.branchCount}</strong><span>Branches</span></div>
        <div><strong>{model.summary.documentCount}</strong><span>Documents</span></div>
        <div><strong>{model.summary.planCount}</strong><span>Plans</span></div>
        <div><strong>{model.summary.activePlanCount}</strong><span>Active Plans</span></div>
        <div><strong>{model.summary.stalePlanCount}</strong><span>Stale</span></div>
      </section>

      <section className="atlas-grid">
        <aside className="atlas-branch-panel" aria-label="Knowledge branches">
          <label className="atlas-search">
            <Search size={16} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search branches"
            />
          </label>

          <div className="atlas-branch-list">
            {visibleBranches.map((branch) => (
              <button
                key={branch.id}
                className={branch.id === selectedBranch?.id ? 'atlas-branch atlas-branch-active' : 'atlas-branch'}
                onClick={() => setSelectedBranchId(branch.id)}
                type="button"
              >
                <span>{branch.name}</span>
                <small>{branch.documentCount} docs · {branch.activePlanCount} active plans</small>
              </button>
            ))}
          </div>
        </aside>

        <section className="atlas-detail-panel" aria-label="Selected branch detail">
          {selectedBranch ? (
            <>
              <div className="atlas-detail-header">
                <div>
                  <p className="atlas-kicker">Selected branch</p>
                  <h2>{selectedBranch.name}</h2>
                </div>
                <div className="atlas-detail-badges">
                  <span><FileText size={14} aria-hidden="true" />{selectedBranch.documentCount} docs</span>
                  <span><GitBranch size={14} aria-hidden="true" />{selectedBranch.secondaryCount} crosslinks</span>
                  <span><ShieldCheck size={14} aria-hidden="true" />{selectedBranch.unreviewedCount} unreviewed</span>
                </div>
              </div>

              <div className="atlas-doc-table">
                {selectedBranch.documents.map((document) => (
                  <article key={`${document.id}-${document.relationshipType}`} className="atlas-doc-row">
                    <div>
                      <h3>{document.title}</h3>
                      <p>{document.relativePath}</p>
                    </div>
                    <div className="atlas-doc-meta">
                      <span>{document.docRole}</span>
                      <span>{document.relationshipType}</span>
                      {document.planStatus ? <span>{document.planStatus}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <p>No branch selected.</p>
          )}
        </section>
      </section>
    </main>
  );
}

function formatActivityTimestamp(timestamp: string | null): string {
  if (!timestamp) return 'retired or missing';
  return new Date(timestamp).toLocaleString();
}

function RecentAtlasWorkBanner({ state }: { state: BacklogState }): React.ReactElement | null {
  const [pulseRecentActivity, setPulseRecentActivity] = useState(true);

  useEffect(() => {
    if (state.status !== 'ready') return undefined;

    // The pulse is intentionally page-local: it points the operator at the
    // newest ledger rows for one minute after the dashboard opens or refreshes.
    const timeoutId = window.setTimeout(() => setPulseRecentActivity(false), 60_000);
    return () => window.clearTimeout(timeoutId);
  }, [state]);

  if (state.status !== 'ready' || !state.data.available) return null;

  const recentActivity = state.data.recentActivity ?? [];
  if (recentActivity.length === 0) return null;

  return (
    <section className="atlas-last-work-banner" aria-label="Last Atlas work">
      <div className="atlas-recent-work-header">
        <div>
          <p className="atlas-kicker">Last Atlas work</p>
          <h2>Files Codex walked most recently</h2>
        </div>
        <span>Highlight fades after 60 seconds</span>
      </div>
      <div className="atlas-recent-work-list">
        {recentActivity.map((activity) => (
          <article
            key={activity.path}
            className={pulseRecentActivity ? 'atlas-recent-work-row atlas-recent-work-row-pulse' : 'atlas-recent-work-row'}
          >
            <div>
              <h3>{activity.path}</h3>
              <p>{activity.walkState}</p>
            </div>
            <div className="atlas-recent-work-meta">
              <span>{activity.exists ? 'kept file' : activity.kind}</span>
              <span>{formatActivityTimestamp(activity.modifiedUtc)}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BacklogRetirementPanel({ state }: { state: BacklogState }): React.ReactElement {

  if (state.status === 'loading') {
    return (
      <section className="atlas-backlog-panel atlas-backlog-muted" aria-label="Backlog retirement progress">
        <RefreshCcw className="atlas-spin" size={16} aria-hidden="true" />
        <span>Loading backlog marker progress</span>
      </section>
    );
  }

  if (state.status === 'error' || !state.data.available) {
    const message = state.status === 'error' ? state.message : state.data.message;
    return (
      <section className="atlas-backlog-panel atlas-backlog-warning" aria-label="Backlog retirement progress">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>{message}</span>
      </section>
    );
  }

  const markerSummary = state.data.markerSummary;
  const snapshotSummary = state.data.snapshot?.summary;
  const candidateCount = state.data.candidates?.candidateCount ?? 0;
  const candidates = state.data.candidates?.files ?? [];
  const walkedPercent = markerSummary && markerSummary.totalMarkdown > 0
    ? Math.round((markerSummary.markedMarkdown / markerSummary.totalMarkdown) * 100)
    : 0;

  return (
    <section className="atlas-backlog-panel" aria-label="Backlog retirement progress">
      <div className="atlas-backlog-overview">
        <div>
          <p className="atlas-kicker">Backlog retirement</p>
          <h2>Walked marker coverage</h2>
        </div>
        <div className="atlas-backlog-stat">
          <CheckCircle2 size={16} aria-hidden="true" />
          <strong>{walkedPercent}%</strong>
          <span>of docs marked walked</span>
        </div>
        <div className="atlas-backlog-stat">
          <ListChecks size={16} aria-hidden="true" />
          <strong>{candidateCount}</strong>
          <span>likely backlog candidates</span>
        </div>
      </div>

      <div className="atlas-backlog-meter" aria-label={`${walkedPercent}% walked marker coverage`}>
        <span style={{ width: `${walkedPercent}%` }} />
      </div>

      <div className="atlas-backlog-counts">
        <span>{markerSummary?.markedMarkdown ?? 0} marked</span>
        <span>{markerSummary?.missingMarkdown ?? 0} unmarked</span>
        <span>{snapshotSummary?.total ?? 0} ledger rows</span>
        <span>{snapshotSummary?.file ?? 0} kept files</span>
        <span>{snapshotSummary?.missing ?? 0} retired/deleted</span>
      </div>

      {candidates.length > 0 ? (
        <div className="atlas-backlog-candidates" aria-label="Top likely backlog candidates">
          {candidates.slice(0, 6).map((candidate) => (
            <article key={candidate.path} className="atlas-backlog-candidate">
              <span>{candidate.path}</span>
              <strong>{candidate.score}</strong>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
