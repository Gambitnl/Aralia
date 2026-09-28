// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 20/05/2026, 23:12:41
 * Dependents: md-library-entry.tsx
 * Imports: None
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * Aralia Markdown Document Library Tool
 *
 * This file implements the main user interface for the Markdown Document Library.
 * It is a premium developer tool that allows Remy to browse, search, classify,
 * edit, and safely retire or delete markdown files across the entire Aralia codebase.
 * It interfaces with Vite dev server middleware endpoints (/api/docs/*) and
 * keeps the central document status board (@DOC-REVIEW-LEDGER.md) completely in sync.
 *
 * Designed with a sleek, glassmorphic dark mode, Outfit and JetBrains Mono typography,
 * high-fidelity micro-interactions, responsive side-by-side editing, and a custom
 * visual safety validation checklist for file deletion.
 *
 * Called by: src/md-library-entry.tsx
 * Depends on: F:/Repos/Aralia/docs/registry/@DOC-REVIEW-LEDGER.md (for ledger updates)
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { fetchDocUsage, indexByPath, type DocUsage, type DocUsageResponse } from './docLibrary/docUsageClient';
import { matchesUsageFilters, type UsageFilterState } from './docLibrary/docUsageFilter';
import { buildDocTree, type TreeNode } from './docLibrary/buildDocTree';
import { CATEGORIES, STATUSES } from './docLibrary/docLibraryTaxonomy';

// ============================================================================
// TypeScript Interfaces & Types
// ============================================================================
// Defining types for our document library files, metadata structures,
// search filters, and safe deletion states.
// ============================================================================

interface DocFileMetadata {
  title: string;
  category: string;
  status: string;
  lastReviewed: string;
  notes: string;
}

interface DocFile {
  path: string;
  name: string;
  size: number;
  mtime: string;
  metadata: DocFileMetadata;
}

interface SafetyChecks {
  systemDoesNotExist: boolean;
  staleOrIncorrect: boolean;
  notDuplicate: boolean;
  listedElsewhere: boolean;
}

// Configure marked to render safe target attributes for links
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A' && node.getAttribute('target') === '_blank') {
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

export const PreviewMdLibrary: React.FC = () => {
  // ============================================================================
  // React State Hook Declarations
  // ============================================================================
  // Managing UI filters, file list loaders, active editor state, alerts,
  // sync signals, and the visual deletion panel.
  // ============================================================================
  
  const [files, setFiles] = useState<DocFile[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<{ path: string; metadata: DocFileMetadata; body: string } | null>(null);
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Doc-usage scan (from /api/docs/usage): consumption, role, duplicates, candidacy.
  const [usageByPath, setUsageByPath] = useState<Record<string, DocUsage>>({});
  const [usageDiag, setUsageDiag] = useState<DocUsageResponse['diagnostics'] | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState<boolean>(true);
  const [layoutMode, setLayoutMode] = useState<'list' | 'tree'>('list');
  const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set());
  const [usageFilters, setUsageFilters] = useState<UsageFilterState>({
    consumed: 'all', role: 'all', duplicate: 'all', confidence: 'all',
  });

  const [isLoadingList, setIsLoadingList] = useState<boolean>(true);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  
  const [editorBody, setEditorBody] = useState<string>('');
  const [editorMetadata, setEditorMetadata] = useState<DocFileMetadata>({
    title: '',
    category: 'other',
    status: 'not started',
    lastReviewed: '',
    notes: ''
  });
  
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  const [showDeletePanel, setShowDeletePanel] = useState<boolean>(false);
  const [safetyChecks, setSafetyChecks] = useState<SafetyChecks>({
    systemDoesNotExist: false,
    staleOrIncorrect: false,
    notDuplicate: false,
    listedElsewhere: false
  });
  const [justificationText, setJustificationText] = useState<string>('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState<boolean>(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // Side Effects & Data Fetchers
  // ============================================================================
  // Loads all workspace files when the page is initialised, and fetches individual
  // files whenever a file in the list is selected.
  // ============================================================================

  // Load the full list of markdown files from the repository via custom dev endpoint.
  const loadFileList = async () => {
    setIsLoadingList(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/docs/list');
      const data = await response.json();
      if (data.error) {
        setErrorMessage(`Failed to retrieve file list: ${data.error}`);
      } else if (data.files) {
        setFiles(data.files);
      }
    } catch (e) {
      setErrorMessage(`Network error fetching file list: ${String(e)}`);
    } finally {
      setIsLoadingList(false);
    }
  };

  // Load the doc-usage scan (reusable so the Rescan button can force a refresh).
  const loadUsage = async (refresh = false) => {
    setIsLoadingUsage(true);
    try {
      const data = await fetchDocUsage(refresh);
      setUsageByPath(indexByPath(data.docs));
      setUsageDiag(data.diagnostics);
    } catch (e) {
      setUsageDiag({ ambiguousRefs: [], unresolvedRefs: [`usage load failed: ${String(e)}`], atlasMissing: false });
    } finally {
      setIsLoadingUsage(false);
    }
  };

  useEffect(() => {
    loadFileList();
    loadUsage();
  }, []);

  // Fetch the detailed content and frontmatter metadata of the active document.
  useEffect(() => {
    if (!selectedFilePath) {
      setSelectedFile(null);
      return;
    }
    
    const fetchFileContent = async () => {
      setIsLoadingFile(true);
      setErrorMessage('');
      setSuccessMessage('');
      setShowDeletePanel(false);
      setSafetyChecks({
        systemDoesNotExist: false,
        staleOrIncorrect: false,
        notDuplicate: false,
        listedElsewhere: false
      });
      setJustificationText('');
      
      try {
        const response = await fetch(`/api/docs/read?path=${encodeURIComponent(selectedFilePath)}`);
        const data = await response.json();
        if (data.error) {
          setErrorMessage(`Failed to read document: ${data.error}`);
        } else {
          setSelectedFile(data);
          setEditorBody(data.body);
          setEditorMetadata({
            title: data.metadata.title || '',
            category: data.metadata.category || 'other',
            status: data.metadata.status || 'not started',
            lastReviewed: data.metadata.lastReviewed || new Date().toISOString().split('T')[0],
            notes: data.metadata.notes || ''
          });
        }
      } catch (e) {
        setErrorMessage(`Network error reading document: ${String(e)}`);
      } finally {
        setIsLoadingFile(false);
      }
    };

    fetchFileContent();
  }, [selectedFilePath]);

  // ============================================================================
  // Document Operations (Save, Retire, Hard Delete)
  // ============================================================================
  // These functions send formatted metadata and content back to the system,
  // updating both local files and the shared Ledger log.
  // ============================================================================

  // Submit changes to the API, re-formatting standard YAML frontmatter blocks.
  const handleSaveDocument = async () => {
    if (!selectedFilePath) return;
    
    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const response = await fetch('/api/docs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedFilePath,
          metadata: editorMetadata,
          body: editorBody
        })
      });
      
      const data = await response.json();
      if (data.error) {
        setErrorMessage(`Failed to write file to disk: ${data.error}`);
      } else {
        setSuccessMessage('Document changes and ledger synced successfully.');
        // Update local file list cache state dynamically to avoid double reload.
        setFiles(prev => prev.map(f => {
          if (f.path === selectedFilePath) {
            return {
              ...f,
              metadata: { ...editorMetadata }
            };
          }
          return f;
        }));
      }
    } catch (e) {
      setErrorMessage(`Network error saving document: ${String(e)}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Perform soft retirement (renaming file to include a tilde suffix) or permanent unlinking.
  const handleDeleteOrRetire = async (action: 'retire' | 'delete') => {
    if (!selectedFilePath) return;
    
    // Force checklist completion for permanent unlinking.
    if (action === 'delete') {
      const allChecked = Object.values(safetyChecks).every(val => val);
      if (!allChecked) {
        setErrorMessage('All safety validation boxes must be checked before hard-deleting.');
        return;
      }
    }
    
    if (!justificationText.trim()) {
      setErrorMessage('A short justification is required for the audit log.');
      return;
    }
    
    setIsDeleting(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      const response = await fetch('/api/docs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: selectedFilePath,
          action,
          justification: justificationText
        })
      });
      
      const data = await response.json();
      if (data.error) {
        setErrorMessage(`Failed to perform removal: ${data.error}`);
      } else {
        setSuccessMessage(`Document successfully ${action === 'retire' ? 'retired' : 'permanently deleted'}.`);
        setShowDeletePanel(false);
        setShowDeleteConfirmation(false);
        setSelectedFilePath('');
        setSelectedFile(null);
        // Refresh full file list to clean up removed assets.
        loadFileList();
      }
    } catch (e) {
      setErrorMessage(`Network error deleting document: ${String(e)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // ============================================================================
  // Filtering & Search Utilities
  // ============================================================================
  // Filters documents recursively by title, content query, category class,
  // and status flags.
  // ============================================================================

  const filteredFiles = useMemo(() => {
    return files.filter(file => {
      // 0. Matches the usage filters (consumed / role / duplicate / confidence).
      //    Checked first so it applies even when a search query short-circuits.
      if (!matchesUsageFilters(usageByPath[file.path], usageFilters)) {
        return false;
      }

      // 1. Matches Category filter
      if (filterCategory !== 'all' && file.metadata.category !== filterCategory) {
        return false;
      }
      
      // 2. Matches Status filter
      if (filterStatus !== 'all' && file.metadata.status !== filterStatus) {
        return false;
      }
      
      // 3. Matches Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = file.metadata.title.toLowerCase().includes(query);
        const matchesPath = file.path.toLowerCase().includes(query);
        // Search inside notes if present
        const matchesNotes = (file.metadata.notes || '').toLowerCase().includes(query);
        return matchesTitle || matchesPath || matchesNotes;
      }
      
      return true;
    });
  }, [files, searchQuery, filterCategory, filterStatus, usageByPath, usageFilters]);

  // Folder-tree model, rebuilt from whatever passes the current filters.
  const docTree = useMemo(() => buildDocTree(filteredFiles.map(f => f.path)), [filteredFiles]);

  // Quick statistical summary for header widgets.
  const stats = useMemo(() => {
    const total = files.length;
    const reviewed = files.filter(f => ['reviewed', 'updated', 'processed'].includes(f.metadata.status)).length;
    const pending = total - reviewed;
    const archived = files.filter(f => f.metadata.status === 'archived' || f.name.includes('~')).length;
    
    return { total, reviewed, pending, archived };
  }, [files]);

  // ============================================================================
  // High-Fidelity Markdown Parser & Alerts Parser
  // ============================================================================
  // Parses markdown syntax into beautiful HTML, injecting stylized containers
  // with custom HSL borders and icons for [!NOTE], [!WARNING], and [!IMPORTANT].
  // ============================================================================

  const renderedHtml = useMemo(() => {
    if (!editorBody) return '';
    
    try {
      // Run the standard marked parser with GFM options.
      const rawHtml = marked.parse(editorBody, { gfm: true, breaks: true, async: false }) as string;
      
      // Inject glassmorphic panels for standard blockquote alerts (GitHub syntax supported)
      let processed = rawHtml;
      const alertTypes = ['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'];
      
      for (const type of alertTypes) {
        // Regex target matches blockquote structures carrying [!TYPE] flags
        const regex = new RegExp(`<blockquote>\\s*<p>\\s*\\[!${type}\\](?:<br\\s*/?>|\\s+)?([\\s\\S]*?)</p>\\s*</blockquote>`, 'gi');
        processed = processed.replace(regex, (_, content) => {
          let borderClass = 'border-violet-500 bg-violet-950/20 text-violet-200';
          let icon = 'info';
          
          if (type === 'TIP') {
            borderClass = 'border-emerald-500 bg-emerald-950/20 text-emerald-200';
            icon = 'lightbulb';
          } else if (type === 'IMPORTANT') {
            borderClass = 'border-purple-500 bg-purple-950/20 text-purple-200';
            icon = 'grade';
          } else if (type === 'WARNING') {
            borderClass = 'border-amber-500 bg-amber-950/20 text-amber-200';
            icon = 'warning';
          } else if (type === 'CAUTION') {
            borderClass = 'border-rose-500 bg-rose-950/20 text-rose-200';
            icon = 'report';
          }
          
          return `
            <div class="my-4 p-4 border-l-4 rounded-r-xl ${borderClass} backdrop-blur-md border border-white/5 flex gap-3 items-start">
              <span class="material-symbols-outlined text-xl opacity-90 select-none">${icon}</span>
              <div class="flex-1 text-sm">
                <strong class="block text-xs uppercase tracking-wider mb-1 font-semibold opacity-75">${type}</strong>
                <div class="leading-relaxed opacity-90">${content}</div>
              </div>
            </div>
          `;
        });
      }
      
      // Sanitise DOM to safeguard developers against scripting injection vulnerabilities
      return DOMPurify.sanitize(processed);
    } catch (e) {
      return `<div class="p-4 border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm">Parser failed: ${String(e)}</div>`;
    }
  }, [editorBody]);

  // ============================================================================
  // Formatting Shortcut Injectors
  // ============================================================================
  // Appends markdown decorators directly into the active textarea cursor position,
  // simplifying editing micro-workflows.
  // ============================================================================

  const injectShortcut = (type: 'bold' | 'code' | 'h2' | 'bullet' | 'note' | 'warning') => {
    const txt = textareaRef.current;
    if (!txt) return;
    
    const start = txt.selectionStart;
    const end = txt.selectionEnd;
    const text = txt.value;
    const selected = text.substring(start, end);
    
    let replacement = '';
    let selectionOffset = 0;
    
    switch (type) {
      case 'bold':
        replacement = `**${selected || 'bold text'}**`;
        selectionOffset = 2;
        break;
      case 'code':
        replacement = `\`\`\`typescript\n${selected || '// code snippet'}\n\`\`\``;
        selectionOffset = 14;
        break;
      case 'h2':
        replacement = `\n## ${selected || 'Subheading'}\n`;
        selectionOffset = 4;
        break;
      case 'bullet':
        replacement = `\n- ${selected || 'list item'}`;
        selectionOffset = 3;
        break;
      case 'note':
        replacement = `\n> [!NOTE]\n> ${selected || 'Helpful context or background explanation.'}\n`;
        selectionOffset = 12;
        break;
      case 'warning':
        replacement = `\n> [!WARNING]\n> ${selected || 'Crucial caution, warnings or potential pitfalls.'}\n`;
        selectionOffset = 15;
        break;
    }
    
    const newBody = text.substring(0, start) + replacement + text.substring(end);
    setEditorBody(newBody);
    
    // Set selection back within the injected blocks cleanly.
    setTimeout(() => {
      txt.focus();
      txt.setSelectionRange(start + selectionOffset, start + replacement.length - selectionOffset);
    }, 50);
  };

  // ============================================================================
  // Sub-component Renders
  // ============================================================================
  // Minor helper renders representing category badges and status tags.
  // ============================================================================

  const getCategoryBadge = (catId: string) => {
    const category = CATEGORIES.find(c => c.id === catId) || CATEGORIES[6];
    return (
      <span className={`px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-md border ${category.color}`}>
        {category.id}
      </span>
    );
  };

  const getStatusBadge = (statusId: string) => {
    const status = STATUSES.find(s => s.id === statusId) || STATUSES[0];
    return (
      <span className={`px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase rounded-md border ${status.color}`}>
        {status.id}
      </span>
    );
  };

  // ============================================================================
  // Primary Interface Layout
  // ============================================================================
  // Grid divisions housing the searchable sidebar and the interactive dual-pane
  // document workspace.
  // ============================================================================

  // Usage badges shown on each doc (list rows and tree leaves).
  const renderBadges = (docPath: string): React.ReactNode => {
    const u = usageByPath[docPath];
    if (!u) return null;
    const age = u.gitAgeDays ?? u.ageDays;
    const ageLabel = age > 365 ? `${Math.floor(age / 365)}y` : `${age}d`;
    return (
      <div className="flex flex-wrap gap-1 mt-1.5">
        {u.role && <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-300">{u.role}</span>}
        <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400">{ageLabel}</span>
        {u.consumedBy.length > 0
          ? u.consumedBy.slice(0, 2).map(a => <span key={a} className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-300">{a}</span>)
          : <span className="text-[8px] px-1.5 py-0.5 rounded bg-slate-700/40 text-slate-500">unused</span>}
        {u.duplicateGroupId != null && <span className="text-[8px] px-1.5 py-0.5 rounded bg-orange-600/20 text-orange-300">dupe</span>}
        {u.openTaskCount > 0 && <span className="text-[8px] px-1.5 py-0.5 rounded bg-sky-600/20 text-sky-300">{u.openTaskCount} open</span>}
        {u.candidate.isCandidate && <span title={u.candidate.reasons.join('; ')} className="text-[8px] px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-300">retire?</span>}
      </div>
    );
  };

  // Recursive folder-tree renderer (dirs collapsible; leaves select the doc).
  const renderTree = (node: TreeNode, depth = 0): React.ReactNode => node.children.map((child) => {
    if (child.isDir) {
      const collapsed = collapsedDirs.has(child.path);
      return (
        <div key={child.path}>
          <button
            type="button"
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
            className="w-full text-left py-1 text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
            onClick={() => setCollapsedDirs(s => { const n = new Set(s); n.has(child.path) ? n.delete(child.path) : n.add(child.path); return n; })}
          >
            <span className="text-slate-600">{collapsed ? '▶' : '▼'}</span>
            <span className="font-semibold">{child.name}</span>
            <span className="text-slate-600">({child.docCount})</span>
          </button>
          {!collapsed && renderTree(child, depth + 1)}
        </div>
      );
    }
    return (
      <button
        key={child.path}
        type="button"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        className={`w-full text-left py-1 text-[11px] rounded hover:bg-slate-800/40 ${selectedFilePath === child.path ? 'text-violet-300' : 'text-slate-300'}`}
        onClick={() => setSelectedFilePath(child.path)}
      >
        <div className="truncate">{child.name}</div>
        {renderBadges(child.path)}
      </button>
    );
  });

  return (
    <div className="h-screen w-screen flex flex-col bg-[#05070a] text-slate-100 overflow-hidden font-sans">
      
      {/* Toast Alert Banner */}
      {errorMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-xl border border-rose-500/20 bg-rose-950/80 backdrop-blur-xl text-rose-200 text-sm shadow-2xl flex items-center gap-3 animate-slide-in">
          <span className="material-symbols-outlined text-rose-400">error</span>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} className="ml-4 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
      {successMessage && (
        <div className="fixed top-4 right-4 z-50 p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/80 backdrop-blur-xl text-emerald-200 text-sm shadow-2xl flex items-center gap-3 animate-slide-in">
          <span className="material-symbols-outlined text-emerald-400">check_circle</span>
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage('')} className="ml-4 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}

      {/* Standalone Control Header */}
      <header className="h-16 shrink-0 border-b border-violet-950/40 bg-violet-950/5 backdrop-blur-md px-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-violet-400">library_books</span>
          </div>
          <div>
            <h1 className="text-md font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent Outfit">Aralia Doc Library</h1>
            <p className="text-[10px] text-slate-500 tracking-wider uppercase font-semibold">Repository Review Center</p>
          </div>
        </div>

        {/* Dashboard Statistics Widget */}
        <div className="hidden md:flex items-center gap-6 text-[11px] font-semibold text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse"></span>
            <span>Total Docs: <strong className="text-slate-200">{stats.total}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span>Reviewed: <strong className="text-slate-200">{stats.reviewed}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span>Pending: <strong className="text-slate-200">{stats.pending}</strong></span>
          </div>
          {stats.archived > 0 && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              <span>Archived: <strong className="text-slate-200">{stats.archived}</strong></span>
            </div>
          )}
        </div>
      </header>

      {/* Main Split Window */}
      <div className="flex-1 flex min-h-0 relative">
        
        {/* SIDEBAR: Document List & Filters */}
        <aside className="w-80 shrink-0 border-r border-violet-950/20 bg-slate-950/20 flex flex-col min-h-0">

          {/* Usage headline + rescan */}
          <div className="px-4 pt-3 pb-2 border-b border-violet-950/20 shrink-0">
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <span><strong className="text-slate-200">{files.length}</strong> docs</span>
              <span><strong className="text-slate-200">{Object.values(usageByPath).filter(u => u.role === 'plan').length}</strong> plan</span>
              <span><strong className="text-amber-300">{Object.values(usageByPath).filter(u => u.candidate.isCandidate).length}</strong> candidates</span>
              <span><strong className="text-slate-200">{new Set(Object.values(usageByPath).map(u => u.duplicateGroupId).filter(x => x != null)).size}</strong> dupe groups</span>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <button
                type="button"
                onClick={() => loadUsage(true)}
                disabled={isLoadingUsage}
                className="text-[10px] px-2 py-0.5 rounded bg-slate-800/60 text-slate-300 hover:bg-slate-700/60 disabled:opacity-50"
              >
                {isLoadingUsage ? 'Scanning…' : '↻ Rescan usage'}
              </button>
              {usageDiag && (usageDiag.atlasMissing || usageDiag.ambiguousRefs.length > 0 || usageDiag.unresolvedRefs.length > 0) && (
                <details className="text-[10px] text-slate-500">
                  <summary className="cursor-pointer text-amber-400/80">diagnostics{usageDiag.atlasMissing ? ' · Atlas missing (roles blank)' : ''}</summary>
                  <div className="mt-1 max-h-32 overflow-y-auto">
                    {usageDiag.atlasMissing && <p className="text-amber-400/70">Run <code>npm run atlas -- reconcile</code> to populate roles.</p>}
                    {usageDiag.ambiguousRefs.slice(0, 20).map((r, i) => <div key={`a${i}`}>ambiguous: {r}</div>)}
                    {usageDiag.unresolvedRefs.slice(0, 20).map((r, i) => <div key={`u${i}`}>unresolved: {r}</div>)}
                  </div>
                </details>
              )}
            </div>
          </div>

          {/* Search bar */}
          <div className="p-4 border-b border-violet-950/20 space-y-3 shrink-0">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-sm">search</span>
              <input
                type="text"
                placeholder="Search markdown library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/60 border border-violet-950/30 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-white transition-colors"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>

            {/* Quick dropdown filters */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] uppercase font-semibold text-slate-500 mb-1">Category</label>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-slate-900/60 border border-violet-950/30 rounded-md px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-violet-500/50"
                >
                  <option value="all">All Types</option>
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] uppercase font-semibold text-slate-500 mb-1">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-slate-900/60 border border-violet-950/30 rounded-md px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-violet-500/50"
                >
                  <option value="all">All States</option>
                  {STATUSES.map(s => (
                    <option key={s.id} value={s.id}>{s.id}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Usage filters (from the doc-usage scan) */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={usageFilters.consumed}
                onChange={(e) => setUsageFilters(s => ({ ...s, consumed: e.target.value as UsageFilterState['consumed'] }))}
                className="w-full bg-slate-900/60 border border-violet-950/30 rounded-md px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-violet-500/50"
              >
                <option value="all">Consumed: all</option>
                <option value="used">Used by an app</option>
                <option value="unused">Unused by apps</option>
              </select>
              <select
                value={usageFilters.role}
                onChange={(e) => setUsageFilters(s => ({ ...s, role: e.target.value }))}
                className="w-full bg-slate-900/60 border border-violet-950/30 rounded-md px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-violet-500/50"
              >
                <option value="all">Role: all</option>
                {[...new Set(Object.values(usageByPath).map(u => u.role).filter(Boolean) as string[])].sort().map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                value={usageFilters.duplicate}
                onChange={(e) => setUsageFilters(s => ({ ...s, duplicate: e.target.value as UsageFilterState['duplicate'] }))}
                className="w-full bg-slate-900/60 border border-violet-950/30 rounded-md px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-violet-500/50"
              >
                <option value="all">Duplicates: all</option>
                <option value="dupes">Only duplicates</option>
              </select>
              <select
                value={usageFilters.confidence}
                onChange={(e) => setUsageFilters(s => ({ ...s, confidence: e.target.value as UsageFilterState['confidence'] }))}
                className="w-full bg-slate-900/60 border border-violet-950/30 rounded-md px-2 py-1 text-[10px] text-slate-300 focus:outline-none focus:border-violet-500/50"
              >
                <option value="all">Confidence: all</option>
                <option value="candidate">Retirement candidates</option>
              </select>
            </div>
          </div>

          {/* List / Tree toggle */}
          <div className="flex gap-1 px-4 py-1.5 border-b border-violet-950/20 shrink-0">
            <button type="button" onClick={() => setLayoutMode('list')} className={`text-[10px] px-2 py-0.5 rounded ${layoutMode === 'list' ? 'bg-violet-600/30 text-violet-200' : 'text-slate-400 hover:text-slate-200'}`}>List</button>
            <button type="button" onClick={() => setLayoutMode('tree')} className={`text-[10px] px-2 py-0.5 rounded ${layoutMode === 'tree' ? 'bg-violet-600/30 text-violet-200' : 'text-slate-400 hover:text-slate-200'}`}>Tree</button>
          </div>

          {/* List panel */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
            {isLoadingList ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-xs">Loading repository...</span>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No matching documents found.
              </div>
            ) : layoutMode === 'tree' ? (
              <div>{renderTree(docTree)}</div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = file.path === selectedFilePath;
                const isRetired = file.name.includes('~');
                return (
                  <button
                    key={file.path}
                    onClick={() => setSelectedFilePath(file.path)}
                    className={`w-full text-left p-3 rounded-lg border transition-all duration-150 relative ${
                      isSelected
                        ? 'bg-violet-950/20 border-violet-500/50 shadow-md shadow-violet-950/10'
                        : 'bg-slate-900/20 border-white/5 hover:bg-slate-900/40 hover:border-violet-950/30'
                    }`}
                  >
                    {/* Glowing highlight indicator */}
                    {isSelected && (
                      <span className="absolute left-0 top-3 bottom-3 w-1 bg-violet-500 rounded-r-md"></span>
                    )}

                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <span className={`text-[12px] font-bold truncate transition-colors ${
                        isSelected ? 'text-violet-200' : 'text-slate-300'
                      } ${isRetired ? 'line-through text-slate-500' : ''}`}>
                        {file.metadata.title}
                      </span>
                      <span className="text-[9px] text-slate-500 shrink-0 font-medium font-mono">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-500 font-mono truncate mb-2.5">
                      {file.path}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {getCategoryBadge(file.metadata.category)}
                      {getStatusBadge(file.metadata.status)}
                    </div>
                    {renderBadges(file.path)}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* WORKSPACE: Dual-Pane Editor or Empty State */}
        <main className="flex-1 flex flex-col min-h-0 bg-[#070a0f]/40 relative">
          
          {!selectedFilePath ? (
            // EMPTY STATE PANEL
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center select-none bg-radial-glow">
              <div className="w-16 h-16 rounded-2xl bg-violet-600/5 border border-violet-500/10 flex items-center justify-center mb-6 shadow-2xl">
                <span className="material-symbols-outlined text-3xl text-violet-400">folder_open</span>
              </div>
              <h2 className="text-lg font-bold text-slate-300 mb-2 Outfit">Markdown Document Library</h2>
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed mb-6">
                Select a document from the sidebar to review, update, or safely retire stale information. Keep Aralia's intent signals sharp!
              </p>
              <div className="grid grid-cols-2 gap-3 max-w-md w-full">
                <div className="p-4 rounded-xl border border-white/5 bg-slate-900/10 text-left">
                  <span className="material-symbols-outlined text-violet-400 text-lg mb-2">assignment_turned_in</span>
                  <h3 className="text-xs font-bold text-slate-300 mb-1">Checklist Reviews</h3>
                  <p className="text-[10px] text-slate-500 leading-normal">Safely update details and class types, then document logs in the Ledger.</p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-slate-900/10 text-left">
                  <span className="material-symbols-outlined text-rose-400 text-lg mb-2">safety_check</span>
                  <h3 className="text-xs font-bold text-slate-300 mb-1">Safe Retirement</h3>
                  <p className="text-[10px] text-slate-500 leading-normal">Use the checklist to soft-retire using tildes to maintain historical context safely.</p>
                </div>
              </div>
            </div>
          ) : isLoadingFile ? (
            // FILE LOADING PANEL
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-3 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-400">Loading document contents...</span>
            </div>
          ) : (
            // ACTIVE EDITING WORKSPACE
            <div className="flex-1 flex flex-col min-h-0 relative">
              
              {/* TOP METADATA PANEL */}
              <div className="shrink-0 border-b border-violet-950/20 bg-slate-950/30 p-4">
                
                {/* Visual Title / Input Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={editorMetadata.title}
                      onChange={(e) => setEditorMetadata(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Document Title"
                      className="w-full bg-transparent border-b border-transparent hover:border-white/10 focus:border-violet-500 focus:outline-none text-md font-bold text-slate-100 Outfit transition-colors py-0.5"
                    />
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500 font-mono truncate max-w-lg">{selectedFilePath}</span>
                      <a
                        href={`vscode://file/${encodeURIComponent(selectedFilePath)}`}
                        title="Open directly in VS Code"
                        className="text-slate-500 hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined text-xs">open_in_new</span>
                      </a>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-center">
                    <button
                      onClick={() => setShowDeletePanel(prev => !prev)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-colors ${
                        showDeletePanel
                          ? 'bg-rose-950/40 border-rose-500/50 text-rose-200'
                          : 'bg-rose-950/10 border-rose-950/40 text-rose-400 hover:bg-rose-900/20 hover:border-rose-500/40'
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      <span>Safe Delete</span>
                    </button>
                    
                    <button
                      onClick={handleSaveDocument}
                      disabled={isSaving}
                      className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:opacity-50 text-xs font-bold flex items-center gap-2 transition-colors text-white shadow-lg shadow-violet-950/20"
                    >
                      {isSaving ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">save</span>
                          <span>Save & Sync Ledger</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Metadata Fields Selector Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/30 border border-white/5 rounded-xl p-3.5">
                  <div>
                    <label className="block text-[9px] uppercase font-semibold text-slate-500 mb-1">Doc Class</label>
                    <select
                      value={editorMetadata.category}
                      onChange={(e) => setEditorMetadata(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-slate-900 border border-violet-950/20 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
                    >
                      {CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-semibold text-slate-500 mb-1">Review Status</label>
                    <select
                      value={editorMetadata.status}
                      onChange={(e) => setEditorMetadata(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full bg-slate-900 border border-violet-950/20 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
                    >
                      {STATUSES.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-semibold text-slate-500 mb-1">Last Reviewed</label>
                    <input
                      type="date"
                      value={editorMetadata.lastReviewed}
                      onChange={(e) => setEditorMetadata(prev => ({ ...prev, lastReviewed: e.target.value }))}
                      className="w-full bg-slate-900 border border-violet-950/20 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-semibold text-slate-500 mb-1">Review Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. Verified system links, retired obsolete tasks."
                      value={editorMetadata.notes}
                      onChange={(e) => setEditorMetadata(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full bg-slate-900 border border-violet-950/20 rounded-md px-2.5 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-500/50"
                    />
                  </div>
                </div>
              </div>

              {/* SLIDE-DOWN: Safe Deletion & Retirement Console */}
              {showDeletePanel && (
                <div className="shrink-0 border-b border-rose-500/20 bg-rose-950/10 p-4 border border-rose-950/40 m-4 rounded-xl animate-slide-in">
                  <div className="flex items-center gap-3.5 mb-3">
                    <span className="material-symbols-outlined text-rose-400 text-xl">gavel</span>
                    <h3 className="text-xs font-bold text-rose-200 uppercase tracking-wider Outfit">Safe Deletion & Retirement Review</h3>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-normal mb-4">
                    Remy's primary rule: <strong className="text-slate-300">no data shall be deleted</strong> unless it meets the criteria of representing dead/removed systems, contains stale/incorrect details, or is fully listed elsewhere. Soft retirement (renaming to `~.md` and archiving) preserves historical contexts safely.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Compliance checklists */}
                    <div className="space-y-2.5 bg-slate-950/40 p-3 rounded-lg border border-white/5">
                      <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-1">Safety Checks Checklist</h4>
                      
                      <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={safetyChecks.systemDoesNotExist}
                          onChange={(e) => setSafetyChecks(prev => ({ ...prev, systemDoesNotExist: e.target.checked }))}
                          className="mt-0.5 border-rose-500/30 rounded focus:ring-0 focus:ring-offset-0 text-rose-600"
                        />
                        <span>Describes in-game systems or features that don't exist anymore.</span>
                      </label>
                      
                      <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={safetyChecks.staleOrIncorrect}
                          onChange={(e) => setSafetyChecks(prev => ({ ...prev, staleOrIncorrect: e.target.checked }))}
                          className="mt-0.5 border-rose-500/30 rounded focus:ring-0 focus:ring-offset-0 text-rose-600"
                        />
                        <span>Details are stale, outdated, or objectively incorrect.</span>
                      </label>
                      
                      <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={safetyChecks.notDuplicate}
                          onChange={(e) => setSafetyChecks(prev => ({ ...prev, notDuplicate: e.target.checked }))}
                          className="mt-0.5 border-rose-500/30 rounded focus:ring-0 focus:ring-offset-0 text-rose-600"
                        />
                        <span>Is not listed, active, or duplicated in any other active documents.</span>
                      </label>
                      
                      <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={safetyChecks.listedElsewhere}
                          onChange={(e) => setSafetyChecks(prev => ({ ...prev, listedElsewhere: e.target.checked }))}
                          className="mt-0.5 border-rose-500/30 rounded focus:ring-0 focus:ring-offset-0 text-rose-600"
                        />
                        <span>The removal has been indexed or cross-referenced in the ledger.</span>
                      </label>
                    </div>

                    {/* Justification textbox */}
                    <div className="flex flex-col bg-slate-950/40 p-3 rounded-lg border border-white/5">
                      <h4 className="text-[10px] uppercase font-bold text-slate-500 mb-1">Log Justification (Required)</h4>
                      <textarea
                        value={justificationText}
                        onChange={(e) => setJustificationText(e.target.value)}
                        placeholder="Write a clear reason why this file should be retired/deleted..."
                        className="flex-1 w-full bg-slate-900 border border-rose-950/30 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-rose-500/50 resize-none min-h-[80px]"
                      />
                    </div>
                  </div>

                  {/* Actions Console */}
                  <div className="flex justify-between items-center gap-3 border-t border-rose-950/20 pt-3">
                    <span className="text-[10px] text-slate-500 font-medium italic">
                      Tip: Retire is highly recommended as it follows Aralia convention!
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDeletePanel(false)}
                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={() => handleDeleteOrRetire('retire')}
                        disabled={isDeleting || !justificationText.trim()}
                        className="px-4 py-1.5 rounded-lg bg-orange-700 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold flex items-center gap-2 transition-colors text-white shadow-lg shadow-orange-950/20"
                      >
                        <span className="material-symbols-outlined text-sm">archive</span>
                        <span>Soft-Retire (Tilde Rename)</span>
                      </button>

                      <button
                        onClick={() => setShowDeleteConfirmation(true)}
                        disabled={isDeleting || !justificationText.trim() || !Object.values(safetyChecks).every(val => val)}
                        className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold flex items-center gap-2 transition-colors text-white shadow-lg shadow-rose-950/20"
                      >
                        <span className="material-symbols-outlined text-sm">dangerous</span>
                        <span>Hard Delete (Unlink)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Hard Delete Warning Modal */}
              {showDeleteConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="w-full max-w-md bg-slate-950 border border-rose-500/30 rounded-2xl p-6 shadow-2xl animate-scale-in">
                    <div className="flex items-center gap-3.5 mb-4 text-rose-400">
                      <span className="material-symbols-outlined text-3xl">warning</span>
                      <h3 className="text-md font-bold Outfit">Confirm Hard Deletion</h3>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mb-6">
                      You are about to permanently unlink <strong className="text-white font-mono text-[11px]">{selectedFilePath}</strong> from the filesystem. This action cannot be undone. Are you absolutely certain you want to proceed?
                    </p>
                    <div className="flex justify-end gap-3.5">
                      <button
                        onClick={() => setShowDeleteConfirmation(false)}
                        className="px-3.5 py-2 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleDeleteOrRetire('delete')}
                        className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-lg shadow-rose-950/20"
                      >
                        Yes, Permanently Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* DUAL-PANE WORKSPACE: LEFT EDITOR & RIGHT LIVE PREVIEW */}
              <div className="flex-1 flex min-h-0">
                
                {/* LEFT SIDE: Markdown Textarea Editor */}
                <div className="flex-1 flex flex-col border-r border-violet-950/10 min-w-0">
                  {/* Editor control shortcuts */}
                  <div className="shrink-0 h-10 border-b border-violet-950/10 bg-slate-950/20 px-3 flex items-center justify-between text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => injectShortcut('bold')}
                        title="Incorporate Bold"
                        className="p-1 rounded hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined text-md">format_bold</span>
                      </button>
                      <button
                        onClick={() => injectShortcut('h2')}
                        title="Insert Section H2"
                        className="p-1 rounded hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined text-md">title</span>
                      </button>
                      <button
                        onClick={() => injectShortcut('bullet')}
                        title="Add bullet points"
                        className="p-1 rounded hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined text-md">format_list_bulleted</span>
                      </button>
                      <span className="w-px h-3 bg-white/5 mx-1"></span>
                      <button
                        onClick={() => injectShortcut('code')}
                        title="Incorporate code blocks"
                        className="p-1 rounded hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined text-md">code</span>
                      </button>
                      <button
                        onClick={() => injectShortcut('note')}
                        title="Add Note alerts"
                        className="p-1 rounded hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined text-md">info</span>
                      </button>
                      <button
                        onClick={() => injectShortcut('warning')}
                        title="Add Warning alerts"
                        className="p-1 rounded hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <span className="material-symbols-outlined text-md">warning</span>
                      </button>
                    </div>

                    {/* Word counts info widget */}
                    <div className="text-[10px] text-slate-500 font-mono tracking-tight">
                      Words: {editorBody.trim() ? editorBody.trim().split(/\s+/).length : 0} | Chars: {editorBody.length}
                    </div>
                  </div>

                  {/* Textarea body */}
                  <div className="flex-1 min-h-0 relative">
                    <textarea
                      ref={textareaRef}
                      value={editorBody}
                      onChange={(e) => setEditorBody(e.target.value)}
                      placeholder="Write your markdown body here..."
                      className="w-full h-full bg-[#05070a] text-slate-300 font-mono text-[13px] leading-relaxed p-6 resize-none focus:outline-none focus:ring-0 custom-scrollbar select-text overflow-y-auto"
                      style={{ tabSize: 4 }}
                    />
                  </div>
                </div>

                {/* RIGHT SIDE: Styled Live Preview Panel */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#06090e]/80 relative overflow-hidden">
                  
                  {/* Header bar */}
                  <div className="shrink-0 h-10 border-b border-violet-950/10 bg-slate-950/20 px-4 flex items-center justify-between text-slate-500 select-none">
                    <span className="text-[10px] uppercase font-bold tracking-wider">Live Document Render</span>
                    <span className="material-symbols-outlined text-md">visibility</span>
                  </div>

                  {/* HTML render content container */}
                  <div
                    ref={previewRef}
                    className="flex-1 overflow-y-auto p-8 custom-scrollbar markdown-preview prose prose-invert max-w-none prose-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                </div>

              </div>

            </div>
          )}

        </main>

      </div>

      {/* Styled Embeddable CSS classes for our markdown renderer */}
      <style>{`
        .markdown-preview h1 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.6rem;
          font-weight: 700;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #f8fafc;
          border-bottom: 1px solid rgba(139, 92, 246, 0.15);
          padding-bottom: 0.5rem;
        }
        .markdown-preview h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.3rem;
          font-weight: 600;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          color: #f1f5f9;
        }
        .markdown-preview h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.1rem;
          font-weight: 600;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          color: #e2e8f0;
        }
        .markdown-preview p {
          margin-bottom: 1rem;
          color: #cbd5e1;
          line-height: 1.65;
          font-size: 0.85rem;
        }
        .markdown-preview code {
          font-family: 'JetBrains Mono', monospace;
          background: rgba(255, 255, 255, 0.04);
          padding: 0.15rem 0.35rem;
          border-radius: 4px;
          color: #c084fc;
          font-size: 0.8rem;
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
        .markdown-preview pre {
          background: #030712 !important;
          border: 1px solid rgba(139, 92, 246, 0.1);
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1.25rem;
          overflow-x: auto;
        }
        .markdown-preview pre code {
          background: transparent;
          border: none;
          padding: 0;
          color: #cbd5e1;
          font-size: 0.8rem;
        }
        .markdown-preview ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 1rem;
          font-size: 0.85rem;
          color: #cbd5e1;
        }
        .markdown-preview li {
          margin-bottom: 0.35rem;
        }
        .markdown-preview blockquote {
          border-left: 4px solid rgba(139, 92, 246, 0.4);
          background: rgba(139, 92, 246, 0.03);
          padding: 0.75rem 1.25rem;
          margin: 1.25rem 0;
          border-radius: 0 8px 8px 0;
        }
        .markdown-preview blockquote p {
          margin-bottom: 0;
          font-style: italic;
          color: #a78bfa;
        }
        .markdown-preview table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1.5rem;
          font-size: 0.8rem;
        }
        .markdown-preview th {
          background: rgba(139, 92, 246, 0.05);
          color: #a78bfa;
          font-weight: 600;
          text-align: left;
          padding: 0.6rem 0.8rem;
          border-bottom: 2px solid rgba(139, 92, 246, 0.15);
        }
        .markdown-preview td {
          padding: 0.6rem 0.8rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          color: #94a3b8;
        }
        .markdown-preview tr:hover td {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.01);
        }
      `}</style>
      
    </div>
  );
};
