/**
 * This file defines the shared graph data types used by every visualizer module.
 *
 * The server analyzer, graph builder, API layer, sync tool, and static generator all
 * exchange the same node/edge objects, so centralizing these interfaces prevents
 * drift between modules when we evolve the visualizer features.
 */

// ============================================================================
// Code Block Types
// ============================================================================
// These types describe the "inside" of a file (functions, hooks, interfaces, etc.)
// so the UI can show meaningful per-file detail in the side panel and expanded view.
// ============================================================================

export interface CodeBlock {
  name: string;
  type: 'function' | 'class' | 'component' | 'hook' | 'constant' | 'type' | 'interface' | 'enum';
  startLine: number;
  endLine: number;
  description: string;
  exports: boolean;
}

// ============================================================================
// File Graph Types
// ============================================================================
// These types represent each file and the import edges between files so the D3
// graph can render dependency direction and connection strength.
// ============================================================================

export interface FileNode {
  id: string;
  name: string;
  fullPath: string;
  relativePath: string;
  description: string;
  imports: string[];
  importedBy: string[];
  codeBlocks: CodeBlock[];
  connectionCount: number;
  category: string;
  role: 'normal' | 'bridge' | 'orphan';
}

export interface FileEdge {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: FileNode[];
  edges: FileEdge[];
}
