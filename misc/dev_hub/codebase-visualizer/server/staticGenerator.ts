/**
 * This file generates a standalone HTML export of the visualizer.
 *
 * It runs the same graph builder used by the live server, then inlines the
 * client CSS, JavaScript, and D3 runtime into one timestamped HTML file so the
 * graph can be shared without running the local server process or leaking the
 * workstation paths used during generation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { generateGraphData } from './graphBuilder';
import { GraphData } from './types';

// ============================================================================
// Static Export Configuration
// ============================================================================
// We read the shared client assets from the Dev Hub visualizer folder and write
// the finished standalone HTML into misc/ for quick access.
// ============================================================================

const PROJECT_ROOT = process.cwd();
const VISUALIZER_ROOT = path.join(PROJECT_ROOT, 'misc', 'dev_hub', 'codebase-visualizer');
const CLIENT_DIR = path.join(VISUALIZER_ROOT, 'client');
const VENDOR_DIR = path.join(CLIENT_DIR, 'vendor');
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, 'misc', 'codebase-visualizations');

const SCRIPT_FILES = ['panel.js', 'rendering.js', 'main.js'];

// ============================================================================
// HTML Assembly
// ============================================================================
// We transform the normal runtime HTML template by replacing linked assets with
// inline assets and injecting precomputed graph data for static mode.
// ============================================================================

function generateVisualizationHTML(data: GraphData, d3Source: string): string {
  const htmlTemplatePath = path.join(CLIENT_DIR, 'index.html');
  const cssPath = path.join(CLIENT_DIR, 'css', 'style.css');

  let html = fs.readFileSync(htmlTemplatePath, 'utf8');
  const css = fs.readFileSync(cssPath, 'utf8');
  const scripts = SCRIPT_FILES.map((fileName) => fs.readFileSync(path.join(CLIENT_DIR, 'js', fileName), 'utf8'));

  // Inline stylesheet so the exported file has no local path dependency.
  html = html.replace(
    /<!-- VISUALIZER_STYLE -->[\s\S]*?<!-- \/VISUALIZER_STYLE -->/,
    `<!-- VISUALIZER_STYLE -->\n  <style>\n${css}\n  </style>\n  <!-- /VISUALIZER_STYLE -->`,
  );

  // Inject static mode bootstrap and inline runtime scripts.
  const scriptBlock = [
    '<script>',
    d3Source,
    '</script>',
    '<script>',
    'window.__VISUALIZER_STATIC__ = true;',
    'window.__VISUALIZER_GRAPH_DATA__ = ' + JSON.stringify(createStaticGraphData(data)) + ';',
    '</script>',
    ...scripts.map((source) => `<script>\n${source}\n</script>`),
  ].join('\n  ');

  html = html.replace(
    /<!-- VISUALIZER_RUNTIME -->[\s\S]*?<!-- \/VISUALIZER_RUNTIME -->/,
    `<!-- VISUALIZER_RUNTIME -->\n  ${scriptBlock}\n  <!-- /VISUALIZER_RUNTIME -->`,
  );

  // Guard against any leftover live-mode script tags so the export stays truly
  // standalone even if the HTML template grows extra runtime includes later.
  html = html.replace(/\s*<script defer src="\/vendor\/d3\.v7\.min\.js"><\/script>/g, '');
  html = html.replace(/\s*<script defer src="\/js\/api\.js"><\/script>/g, '');
  html = html.replace(/\s*<script defer src="\/js\/panel\.js"><\/script>/g, '');
  html = html.replace(/\s*<script defer src="\/js\/rendering\.js"><\/script>/g, '');
  html = html.replace(/\s*<script defer src="\/js\/main\.js"><\/script>/g, '');

  return html;
}

function createStaticGraphData(data: GraphData): GraphData {
  return {
    nodes: data.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      fullPath: node.relativePath,
      relativePath: node.relativePath,
      description: node.description,
      imports: [],
      importedBy: [],
      codeBlocks: node.codeBlocks,
      connectionCount: 0,
      category: node.category,
      role: node.role,
    })),
    edges: data.edges,
  };
}

function resolveOutputPath(args: string[]): string {
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    return path.resolve(PROJECT_ROOT, args[outputIndex + 1]);
  }

  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  return path.join(DEFAULT_OUTPUT_DIR, 'codebase-visualization-' + timestamp + '.html');
}

async function loadD3Source(): Promise<string> {
  const localVendorPath = path.join(VENDOR_DIR, 'd3.v7.min.js');
  if (fs.existsSync(localVendorPath)) {
    return fs.readFileSync(localVendorPath, 'utf8');
  }

  const response = await fetch('https://d3js.org/d3.v7.min.js');
  if (!response.ok) {
    throw new Error('Failed to download D3 for standalone export: ' + response.status);
  }

  const source = await response.text();
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  fs.writeFileSync(localVendorPath, source, 'utf8');
  return source;
}

// ============================================================================
// Main Execution
// ============================================================================
// Build graph data, compose static HTML, write output, and print a short summary.
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  console.log('Starting codebase analysis...');
  const graphData = await generateGraphData();
  const d3Source = await loadD3Source();
  const html = generateVisualizationHTML(graphData, d3Source);
  const outputPath = resolveOutputPath(args);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, 'utf8');

  console.log('\nVisualization generated: ' + outputPath);
  console.log('Open this file in a web browser to explore your codebase!');

  console.log('\nSummary:');
  console.log('- Total files: ' + graphData.nodes.length);
  console.log('- Total connections: ' + graphData.edges.length);

  console.log('\nTop 10 most connected files:');
  graphData.nodes.slice(0, 10).forEach((node, index) => {
    console.log('  ' + (index + 1) + '. ' + node.name + ' (' + node.connectionCount + ' connections)');
  });
}

main().catch((error) => {
  console.error('Static visualizer generation failed:', error);
  process.exit(1);
});
