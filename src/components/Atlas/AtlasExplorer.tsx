import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, GitBranch, RefreshCcw, Search, ShieldCheck } from 'lucide-react';

import type { AtlasRawExport } from './atlasTypes';
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

async function loadKnowledgeTree(): Promise<AtlasRawExport> {
  const response = await fetch('/api/atlas/knowledge-tree');
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || 'Atlas export could not be loaded.');
  }
  return payload as AtlasRawExport;
}

// ============================================================================
// Explorer Component
// ============================================================================
// This section renders the actual Knowledge Tree explorer with search, branch
// selection, summary counters, and document rows.
// ============================================================================

export function AtlasExplorer(): React.ReactElement {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
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
      <header className="atlas-header">
        <div>
          <p className="atlas-kicker">Aralia Atlas</p>
          <h1>Knowledge Tree Explorer</h1>
        </div>
        <div className="atlas-generated">Last reconciliation: {new Date(model.generatedAt).toLocaleString()}</div>
      </header>

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
