import os

file_path = r'C:\Users\gambi\Documents\Git\AraliaV4\Aralia\src\components\DesignPreview\steps\PreviewAgentDocs.tsx'

content = r'''// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 * 
 * Last Sync: 27/01/2026, 01:29:53
 * Dependents: agent-docs-entry.tsx
 * Imports: None
 * 
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx scripts/codebase-visualizer-server.ts --sync [this-file-path]
 * See scripts/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React, { useState, useEffect, useMemo, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'folder';
    children?: FileNode[];
}

interface AgentFolder {
    name: string;
    rootFile: string;
    linkedFiles: FileNode[];
}

// ============================================================================
// MARKDOWN LINK PARSER
// ============================================================================

/**
 * Parses markdown content to extract links and converts them to
 * relative paths within the agent-docs directory.
 */
function parseMarkdownLinks(content: string): { name: string; path: string }[] {
    const links: { name: string; path: string }[] = [];

    // Match markdown links with file:// protocol or relative paths
    // Format: [link text](file:///path/to/file.md) or [link text](rules/foo.md)
    const linkRegex = /\[([^\]]+)\]\((?:file:\/\/\/[^)]*\.agent\/|(?!\w+:\/\/))([^)]+\.md)\)/g;

    let match;
    while ((match = linkRegex.exec(content)) !== null) {
        const linkText = match[1];
        let relativePath = match[2];

        // Ensure relative path doesn't start with /
        if (relativePath.startsWith('/')) relativePath = relativePath.slice(1);

        links.push({
            name: linkText,
            path: `/agent-docs/${relativePath}`,
        });
    }

    return links;
}

/**
 * Organizes parsed links into a folder structure.
 */
function organizeLinksByFolder(links: { name: string; path: string }[], base: string): FileNode[] {
    const folders: Record<string, FileNode> = {};

    for (const link of links) {
        // Find segments after 'agent-docs'
        const parts = link.path.split('/').filter(Boolean);
        const docIndex = parts.indexOf('agent-docs');

        if (docIndex !== -1 && parts.length > docIndex + 1) {
            const folderName = parts[docIndex + 1];

            if (parts.length > docIndex + 2) { // It's a file in a subfolder
                if (!folders[folderName]) {
                    folders[folderName] = {
                        name: folderName,
                        path: `${base}/agent-docs/${folderName}`,
                        type: 'folder',
                        children: [],
                    };
                }

                folders[folderName].children?.push({
                    name: link.name,
                    path: link.path,
                    type: 'file',
                });
            }
        }
    }

    return Object.values(folders);
}

// ============================================================================
// COMPONENTS
// ============================================================================

interface FileTreeItemProps {
    node: FileNode;
    selectedPath: string | null;
    onSelect: (path: string) => void;
    depth?: number;
    hasTodo?: boolean;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
    node,
    selectedPath,
    onSelect,
    depth = 0,
    hasTodo = false
}) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const isSelected = selectedPath === node.path;
    const hasChildren = node.children && node.children.length > 0;

    const handleClick = () => {
        if (node.type === 'folder') {
            setIsExpanded(!isExpanded);
        } else {
            onSelect(node.path);
        }
    };

    // Use Material Symbols
    const icon = node.type === 'folder'
        ? (isExpanded ? 'folder_open' : 'folder')
        : (node.name.toLowerCase().endsWith('.md') ? 'description' : 'article');

    return (
        <div className="space-y-0.5">
            <button
                type="button"
                onClick={handleClick}
                className={`
                    w-full text-left px-2 py-1.5 rounded transition-all flex items-center gap-2 group
                    ${isSelected
                        ? 'bg-primary/10 text-primary border border-primary/20 font-medium'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}
                `}
                style={{ marginLeft: `${depth * 12}px` }}
            >
                <span className={`material-symbols-outlined text-[18px] ${isSelected ? 'text-primary' : 'text-slate-500 group-hover:text-slate-400'}`}>
                    {icon}
                </span>
                <span className="truncate text-sm flex-1">{node.name}</span>
                {hasTodo && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" title="Contains TODO items" />
                )}
            </button>

            {hasChildren && isExpanded && (
                <div className={`ml-4 space-y-0.5 ${depth === 0 ? '' : 'border-l border-border-dark'}`}>
                    {node.children?.map((child) => (
                        <FileTreeItem
                            key={child.path}
                            node={child}
                            selectedPath={selectedPath}
                            onSelect={onSelect}
                            depth={depth + 1}
                            hasTodo={hasTodo}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

interface MarkdownViewerProps {
    content: string;
    path: string;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ content, path }) => {
    // Simple markdown rendering - refined for the new UI
    const renderMarkdown = (md: string) => {
        const lines = md.split('\n');
        const elements: React.ReactNode[] = [];
        let inCodeBlock = false;
        let codeBlockContent: string[] = [];
        let inTable = false;
        let tableRows: string[][] = [];

        const processLine = (line: string, index: number) => {
            // Code block handling
            if (line.startsWith('```')) {
                if (inCodeBlock) {
                    const code = codeBlockContent.join('\n');
                    elements.push(
                        <div key={`code-container-${index}`} className="relative group my-6">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(code);
                                }}
                                className="absolute top-0 right-1 p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                title="Copy to clipboard"
                            >
                                <span className="material-symbols-outlined text-slate-500 hover:text-primary text-sm">content_copy</span>
                            </button>
                            <pre className="bg-card-dark p-4 rounded-lg border border-border-dark overflow-x-auto font-mono text-sm text-slate-300">
                                {code}
                            </pre>
                        </div>
                    );
                    codeBlockContent = [];
                }
                inCodeBlock = !inCodeBlock;
                return;
            }

            if (inCodeBlock) {
                codeBlockContent.push(line);
                return;
            }

            // Table handling
            if (line.startsWith('|')) {
                if (!inTable) {
                    inTable = true;
                    tableRows = [];
                }
                if (!line.match(/^\|[\s-:|]+\|$/)) {
                    const cells = line.split('|').filter(Boolean).map(c => c.trim());
                    tableRows.push(cells);
                }
                return;
            } else if (inTable) {
                elements.push(
                    <div key={`table-wrapper-${index}`} className="my-8 overflow-hidden border border-border-dark rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-white/5 text-slate-400 font-medium">
                                <tr className="border-b border-border-dark">
                                    {tableRows[0]?.map((cell, i) => (
                                        <th key={i} className="py-3 px-4">{cell}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-dark">
                                {tableRows.slice(1).map((row, ri) => (
                                    <tr key={ri} className="hover:bg-white/5 transition-colors">
                                        {row.map((cell, ci) => (
                                            <td key={ci} className="py-3 px-4 text-slate-300">{cell}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
                inTable = false;
                tableRows = [];
            }

            // Headers
            if (line.startsWith('### ')) {
                elements.push(<h3 key={index} className="text-lg font-semibold text-primary mt-8 mb-4">{line.slice(4)}</h3>);
                return;
            }
            if (line.startsWith('## ')) {
                elements.push(
                    <div key={index} className="mt-12 mb-6">
                        <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2 mb-2">
                            {line.slice(3)}
                        </h2>
                        <div className="h-px w-full bg-border-dark"></div>
                    </div>
                );
                return;
            }
            if (line.startsWith('# ')) {
                elements.push(<h1 key={index} className="text-2xl font-bold text-primary mb-8">{line.slice(2)}</h1>);
                return;
            }

            // Bold and inline code
            let processed = line
                .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-1 py-0.5 rounded text-primary font-mono text-[0.85rem]">$1</code>');

            // List items
            if (line.match(/^[-*] /)) {
                elements.push(
                    <div key={index} className="flex items-start gap-3 my-2">
                        <div className="mt-2 w-1.5 h-1.5 rounded-full bg-primary shrink-0"></div>
                        <p className="text-sm leading-relaxed text-slate-300" dangerouslySetInnerHTML={{ __html: processed.slice(2) }} />
                    </div>
                );
                return;
            }

            // Empty line
            if (line.trim() === '') {
                elements.push(<div key={index} className="h-4" />);
                return;
            }

            // Regular paragraph
            elements.push(
                <p key={index} className="text-sm leading-relaxed text-slate-400 mb-2" dangerouslySetInnerHTML={{ __html: processed }} />
            );
        };

        lines.forEach(processLine);

        // Handle any remaining table
        if (inTable && tableRows.length > 0) {
            elements.push(
                <div key="table-end" className="my-8 overflow-hidden border border-border-dark rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-white/5 text-slate-400 font-medium">
                            <tr className="border-b border-border-dark">
                                {tableRows[0]?.map((cell, i) => (
                                    <th key={i} className="py-3 px-4">{cell}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-dark">
                            {tableRows.slice(1).map((row, ri) => (
                                <tr key={ri} className="hover:bg-white/5 transition-colors">
                                    {row.map((cell, ci) => (
                                        <td key={ci} className="py-3 px-4 text-slate-300">{cell}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        return elements;
    };

    const isError = content === '' && path !== '';

    return (
        <div className="max-w-5xl w-full mx-auto p-8 lg:p-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {renderMarkdown(content)}

            {isError && (
                <div className="flex flex-col items-center gap-4 my-12 p-8 border border-red-500/20 bg-red-500/5 rounded-xl">
                    <span className="material-symbols-outlined text-red-400 text-4xl">error</span>
                    <p className="text-red-400 font-mono text-sm">Failed to load document content.</p>
                </div>
            )}

            <footer className="mt-12 pt-8 border-t border-border-dark">
                <p className="text-[11px] text-slate-500 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px]">info</span>
                    Source: {path}
                </p>
            </footer>
        </div>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PreviewAgentDocs: React.FC = () => {
    // Vite base path (e.g., /Aralia/)
    const BASE = import.meta.env.BASE_URL.replace(/\/$/, '') || '';
    const GEMINI_PATH = `${BASE}/agent-docs/GEMINI.md`;

    const [selectedPath, setSelectedPath] = useState<string | null>(GEMINI_PATH);
    const [content, setContent] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [parsedLinks, setParsedLinks] = useState<FileNode[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [todoFiles, setTodoFiles] = useState<Set<string>>(new Set());

    const onRetry = useCallback(() => {
        if (selectedPath) {
            const current = selectedPath;
            setSelectedPath(null);
            setTimeout(() => setSelectedPath(current), 10);
        }
    }, [selectedPath]);

    // Breadcrumbs
    const breadcrumbs = useMemo(() => {
        if (!selectedPath) return [];
        const parts = selectedPath.split('/').filter(p => p !== '' && p !== 'Aralia').filter(Boolean);
        const docIndex = parts.indexOf('agent-docs');
        if (docIndex === -1) return [parts[parts.length - 1]];
        return parts.slice(docIndex + 1);
    }, [selectedPath]);

    // Fetch and parse GEMINI.md on mount to build the tree
    useEffect(() => {
        const fetchRootDoc = async () => {
            try {
                const response = await fetch(GEMINI_PATH);
                if (!response.ok) throw new Error(`Failed to fetch GEMINI.md from ${GEMINI_PATH}`);
                const text = await response.text();

                const links = parseMarkdownLinks(text);
                const prefixedLinks = links.map(l => ({
                    ...l,
                    path: `${BASE}${l.path}`
                }));

                const organized = organizeLinksByFolder(prefixedLinks, BASE);
                setParsedLinks(organized);

                if (selectedPath === GEMINI_PATH) {
                    setContent(text);
                }

                // Check for TODOs in all linked files (async)
                const checkTodos = async () => {
                    const todos = new Set<string>();
                    for (const link of prefixedLinks) {
                        try {
                            const res = await fetch(link.path);
                            if (res.ok) {
                                const txt = await res.text();
                                if (txt.includes('TODO')) {
                                    todos.add(link.path);
                                }
                            }
                        } catch (e) {
                            console.warn('Failed to check TODOs for', link.path);
                        }
                    }
                    setTodoFiles(todos);
                };
                checkTodos();

            } catch (err) {
                console.error('Failed to fetch root document:', err);
                setError(err instanceof Error ? err.message : 'Unknown error');
            }
        };

        fetchRootDoc();
    }, [BASE, GEMINI_PATH]);

    // Fetch selected file content
    useEffect(() => {
        if (!selectedPath) return;

        const fetchContent = async () => {
            setLoading(true);
            setError(null);

            try {
                const response = await fetch(selectedPath);
                if (!response.ok) throw new Error(`Failed to fetch ${selectedPath}`);
                const text = await response.text();
                setContent(text);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
                setContent('');
            } finally {
                setLoading(false);
            }
        };

        fetchContent();
    }, [selectedPath]);

    // Build the file tree with search filter
    const fileTree = useMemo<FileNode[]>(() => {
        if (!searchQuery) return parsedLinks;

        const filterNodes = (nodes: FileNode[]): FileNode[] => {
            return nodes.reduce((acc: FileNode[], node) => {
                if (node.type === 'folder' && node.children) {
                    const filteredChildren = filterNodes(node.children);
                    if (filteredChildren.length > 0) {
                        acc.push({ ...node, children: filteredChildren });
                    }
                } else if (node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                    acc.push(node);
                }
                return acc;
            }, []);
        };

        return filterNodes(parsedLinks);
    }, [parsedLinks, searchQuery]);

    return (
        <div className="h-full flex bg-background-dark text-slate-300 font-display overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 flex-shrink-0 bg-sidebar-dark border-r border-border-dark flex flex-col">
                <div className="h-14 flex items-center px-4 border-b border-border-dark flex-shrink-0">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Agent Documentation</span>
                </div>

                <div className="p-3 border-b border-border-dark">
                    <div className="relative">
                        <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[18px] text-slate-500">search</span>
                        <input
                            type="text"
                            placeholder="Search docs..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-background-dark border border-border-dark rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-1">
                    {/* Hardcoded AntiGravity Root */}
                    <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium text-slate-300">
                        <span className="material-symbols-outlined text-[18px]">folder_open</span>
                        AntiGravity IDE
                    </div>

                    {/* GEMINI.md always at top */}
                    <button
                        onClick={() => setSelectedPath(GEMINI_PATH)}
                        className={`
                            w-full text-left flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-all
                            ${selectedPath === GEMINI_PATH
                                ? 'bg-primary/10 text-primary border border-primary/20 font-medium'
                                : 'text-slate-400 hover:bg-white/5'}
                        `}
                    >
                        <span className="material-symbols-outlined text-[18px]">description</span>
                        GEMINI.md
                    </button>

                    {/* Dynamic folders */}
                    {fileTree.map((node) => (
                        <FileTreeItem
                            key={node.path}
                            node={node}
                            selectedPath={selectedPath}
                            onSelect={setSelectedPath}
                            hasTodo={todoFiles.has(node.path)}
                        />
                    ))}
                </nav>

                {/* Footer of Sidebar */}
                <div className="p-4 border-t border-border-dark bg-black/20">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-black font-bold text-xs shadow-lg shadow-primary/20">AG</div>
                        <div className="flex flex-col">
                            <span className="text-xs font-medium text-white">Active Agent</span>
                            <span className="text-[10px] text-slate-500 font-mono">v4.3.0-aralia</span>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* Content Header */}
                <header className="h-14 bg-background-dark/80 backdrop-blur-md border-b border-border-dark flex items-center px-8 flex-shrink-0">
                    <nav className="flex items-center gap-2 text-[10px] sm:text-xs font-mono text-slate-500 uppercase tracking-tighter">
                        <span>Aralia</span>
                        {breadcrumbs.map((crumb, idx) => (
                            <React.Fragment key={idx}>
                                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                                <span className={idx === breadcrumbs.length - 1 ? 'text-slate-200' : ''}>{crumb}</span>
                            </React.Fragment>
                        ))}
                    </nav>
                    <div className="ml-auto flex items-center gap-4">
                        <button className="text-slate-500 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[20px]">search</span>
                        </button>
                        <button className="text-slate-500 hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-[20px]">settings</span>
                        </button>
                    </div>
                </header>

                {/* Content Scroller */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-mono text-slate-500 animate-pulse">SYNCHRONIZING DOCS...</span>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-full text-red-400 font-mono text-xs p-8">
                            <div className="flex flex-col items-center gap-6">
                                <span className="bg-red-500/10 px-4 py-2 border border-red-500/20 rounded">
                                    ERROR: {error}
                                </span>
                                <button
                                    onClick={onRetry}
                                    className="flex items-center gap-2 px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-border-dark"
                                >
                                    <span className="material-symbols-outlined text-[18px]">refresh</span>
                                    <span>Retry Connection</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <MarkdownViewer content={content} path={selectedPath || ''} />
                    )}
                </div>

                {/* FAB (Floating Action Button) - Visual only as per design */}
                <button className="fixed bottom-6 right-6 w-12 h-12 bg-primary text-background-dark rounded-full shadow-lg shadow-primary/20 flex items-center justify-center hover:scale-110 transition-transform active:scale-95 group">
                    <span className="material-symbols-outlined group-hover:rotate-12 transition-transform">question_mark</span>
                </button>
            </main>
        </div>
    );
};
'''

with open(file_path, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(content)
