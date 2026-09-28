/**
 * This file coordinates the full visualizer client runtime.
 *
 * It owns shared UI state, wires user interactions, coordinates API calls,
 * and dispatches work to the panel and rendering modules.
 */

(function bootstrapVisualizerMain() {
  const namespace = (window.CodebaseVisualizer = window.CodebaseVisualizer || {});
  const api = namespace.api;
  const panel = namespace.panel;
  const rendering = namespace.rendering;

  // Guard against partial loads so failures are explicit during development.
  if (!api || !panel || !rendering) {
    throw new Error('Visualizer client modules failed to load in expected order.');
  }

  // ==========================================================================
  // Shared Runtime State
  // ==========================================================================
  // This object is passed through panel/rendering functions to keep all modules
  // in sync without duplicating local state.
  // ==========================================================================

  const state = {
    categoryColors: {
      components: '#7dd3fc',
      hooks: '#a78bfa',
      utils: '#4ade80',
      services: '#f97316',
      state: '#fbbf24',
      types: '#f472b6',
      systems: '#22d3ee',
      commands: '#c084fc',
      assets: '#94a3b8',
      data: '#fb923c',
      context: '#34d399',
      contexts: '#34d399',
      constants: '#facc15',
      scripts: '#60a5fa',
      test: '#fb7185',
      workers: '#38bdf8',
      root: '#e0e0e0',
    },
    graphData: { nodes: [], edges: [] },
    selectedNode: null,
    activeCategory: null,
    dependencyMode: 'all',
    searchFilter: '',
    colorMode: 'category',
    qualityData: null,
    qualityByFile: {},
    simulation: null,
    expandedSimulation: null,
    graphElements: null,
    graphResizeObserver: null,
    expandedResizeObserver: null,
    isStaticMode: Boolean(window.__VISUALIZER_STATIC__),
  };

  // These timers keep live UI updates responsive without rebuilding the graph
  // or file list on every single keystroke or resize tick.
  const timers = {
    search: null,
    resize: null,
  };

  // ==========================================================================
  // Bootstrap + Mode Selection
  // ==========================================================================
  // Live mode fetches from `/api/graph`, while static mode consumes embedded data.
  // ==========================================================================

  function init() {
    setupEventListeners();
    setupResizeObservers();
    setStatusMessage('');

    if (state.isStaticMode) {
      configureStaticModeUi();
      state.graphData = normalizeGraphData(window.__VISUALIZER_GRAPH_DATA__ || { nodes: [], edges: [] });
      rebuildUiAfterDataLoad();
      return;
    }

    refreshData(false);
  }

  function configureStaticModeUi() {
    const refreshButton = document.getElementById('refreshBtn');
    const qualityButton = document.getElementById('colorModeQuality');

    // Static exports cannot call local APIs, so we disable live-only controls.
    if (refreshButton) {
      refreshButton.textContent = 'Static Export';
      refreshButton.disabled = true;
      refreshButton.title = 'Refresh is only available when running the local visualizer server.';
    }

    if (qualityButton) {
      qualityButton.disabled = true;
      qualityButton.title = 'Code quality mode requires /api/scan from the local visualizer server.';
    }
  }

  // ==========================================================================
  // Data Loading
  // ==========================================================================
  // Graph refresh and quality scanning update state and trigger UI redraw.
  // ==========================================================================

  async function refreshData(forceRefresh) {
    const refreshButton = document.getElementById('refreshBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');

    setLoadingState(refreshButton, loadingOverlay, true);
    setStatusMessage('Loading graph data...', 'info');

    // Keep current selection if the same file still exists after refresh.
    const selectedId = state.selectedNode ? state.selectedNode.id : null;

    try {
      const data = await api.fetchGraphData({ forceRefresh: Boolean(forceRefresh) });
      state.graphData = normalizeGraphData(data);
      state.selectedNode = selectedId
        ? state.graphData.nodes.find(function findSelected(node) { return node.id === selectedId; }) || null
        : null;

      rebuildUiAfterDataLoad();
      setStatusMessage('Graph data refreshed.', 'success');
    } catch (error) {
      console.error('Failed to load graph data:', error);
      setStatusMessage('Failed to load graph data. Is the server running?', 'error');
    } finally {
      setLoadingState(refreshButton, loadingOverlay, false);
    }
  }

  async function loadQualityData() {
    const qualityButton = document.getElementById('colorModeQuality');
    if (!qualityButton) return;

    qualityButton.classList.add('loading');
    qualityButton.textContent = 'Scanning...';
    setStatusMessage('Scanning code quality...', 'info');

    try {
      const data = await api.fetchScanData();
      if (data.error) {
        setStatusMessage('Scan failed: ' + (data.message || data.error), 'error');
        return;
      }

      state.qualityData = data;
      buildQualityIndex();
      setColorMode('quality');
      setStatusMessage('Code quality data loaded.', 'success');
    } catch (error) {
      setStatusMessage('Could not reach scan API: ' + error, 'error');
    } finally {
      qualityButton.classList.remove('loading');
      qualityButton.textContent = 'Code Quality';
    }
  }

  function buildQualityIndex() {
    state.qualityByFile = {};
    if (!state.qualityData || !state.qualityData.groups) return;

    // Start with clean entries so unreported files still resolve in quality mode.
    state.graphData.nodes.forEach(function initializeNode(node) {
      state.qualityByFile[node.id] = { total: 0, issues: [] };
    });

    const groups = state.qualityData.groups;
    Object.keys(groups).forEach(function mapPattern(patternKey) {
      const items = groups[patternKey].items || [];
      items.forEach(function mapIssue(item) {
        const nodeId = item.file.replace(/\\/g, '/').replace(/^src\//, '');
        if (!state.qualityByFile[nodeId]) {
          state.qualityByFile[nodeId] = { total: 0, issues: [] };
        }

        state.qualityByFile[nodeId].total += 1;
        state.qualityByFile[nodeId].issues.push({
          pattern: patternKey,
          line: item.line,
          text: item.text,
        });
      });
    });
  }

  // ==========================================================================
  // Selection + Mode Changes
  // ==========================================================================
  // These handlers keep panel, graph highlighting, list row states, and legend
  // category focus aligned.
  // ==========================================================================

  function selectNode(node) {
    state.selectedNode = node;
    syncSelectedRowClass();
    panel.updateDetailPanel(state, { selectNode, expandNode });
    rendering.updateGraphHighlighting(state);
  }

  function setActiveCategory(category) {
    const nextCategory = category || null;

    // If the user narrows to a category that does not contain the current
    // selection, clear the selection so the detail panel does not describe a
    // file that has been visually filtered away.
    if (state.selectedNode && nextCategory && state.selectedNode.category !== nextCategory) {
      state.selectedNode = null;
    }

    state.activeCategory = nextCategory;
    panel.buildLegend(state, { setActiveCategory });
    panel.buildFileList(state, { selectNode, expandNode });
    panel.updateDetailPanel(state, { selectNode, expandNode });
    rendering.updateGraphHighlighting(state);

    if (!state.activeCategory) {
      setStatusMessage('Showing all categories.', 'info');
      return;
    }

    setStatusMessage('Focusing category: ' + state.activeCategory + '.', 'info');
  }

  function setColorMode(mode) {
    if (mode === 'quality' && !state.qualityData) {
      loadQualityData();
      return;
    }

    state.colorMode = mode;
    const categoryButton = document.getElementById('colorModeCategory');
    const qualityButton = document.getElementById('colorModeQuality');
    if (categoryButton) categoryButton.classList.toggle('active', mode === 'category');
    if (qualityButton) qualityButton.classList.toggle('active', mode === 'quality');

    panel.buildLegend(state, { setActiveCategory });
    rendering.createGraph(state, { selectNode, expandNode });
    panel.updateDetailPanel(state, { selectNode, expandNode });
    rendering.updateGraphHighlighting(state);
  }

  function expandNode(node) {
    rendering.expandNode(state, node);
  }

  // ==========================================================================
  // UI Wiring
  // ==========================================================================
  // All event bindings are centralized here so the HTML stays declarative and
  // static exports can reuse the same markup. Container-driven resize handling
  // lives below so the graph follows the real pane size instead of guessing.
  // ==========================================================================

  function setupEventListeners() {
    const refreshButton = document.getElementById('refreshBtn');
    const categoryButton = document.getElementById('colorModeCategory');
    const qualityButton = document.getElementById('colorModeQuality');
    const copyButton = document.getElementById('copyBtn');
    const closeExpandedButton = document.getElementById('closeExpanded');
    const searchInput = document.querySelector('.search-input');

    if (refreshButton) {
      refreshButton.addEventListener('click', function onRefresh() {
        refreshData(true);
      });
    }

    if (categoryButton) {
      categoryButton.addEventListener('click', function onCategoryMode() {
        setColorMode('category');
      });
    }

    if (qualityButton) {
      qualityButton.addEventListener('click', function onQualityMode() {
        setColorMode('quality');
      });
    }

    document.querySelectorAll('.toggle-btn').forEach(function bindDependencyMode(button) {
      button.addEventListener('click', function onDependencyModeClick() {
        document.querySelectorAll('.toggle-btn').forEach(function clearActive(candidate) {
          candidate.classList.remove('active');
        });
        button.classList.add('active');
        state.dependencyMode = button.dataset.mode || 'all';
        rendering.updateGraphHighlighting(state);
      });
    });

    if (searchInput) {
      searchInput.addEventListener('input', function onSearch(event) {
        state.searchFilter = event.target.value || '';
        if (timers.search) {
          clearTimeout(timers.search);
        }
        timers.search = setTimeout(function rebuildFilteredList() {
          panel.buildFileList(state, { selectNode, expandNode });
        }, 120);
      });
    }

    document.querySelectorAll('.insight-tab').forEach(function bindTabClick(tab) {
      tab.addEventListener('click', function onTabClick() {
        document.querySelectorAll('.insight-tab').forEach(function clearTab(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        
        document.getElementById('fileList').classList.add('hidden');
        document.getElementById('hubList').classList.add('hidden');
        document.getElementById('orphanList').classList.add('hidden');
        
        if (tab.id === 'tabAllFiles') document.getElementById('fileList').classList.remove('hidden');
        if (tab.id === 'tabTopHubs') document.getElementById('hubList').classList.remove('hidden');
        if (tab.id === 'tabOrphans') document.getElementById('orphanList').classList.remove('hidden');
      });
    });

    if (copyButton) {
      copyButton.addEventListener('click', copySelectedPath);
    }

    if (closeExpandedButton) {
      closeExpandedButton.addEventListener('click', function onCloseExpanded() {
        rendering.closeExpandedView(state);
      });
    }

    document.addEventListener('keydown', function onKeyDown(event) {
      if (event.key === 'Escape') {
        rendering.closeExpandedView(state);
      }
    });

    // Keep a plain window fallback for environments that do not support
    // ResizeObserver. The observer below is the primary source of truth.
    window.addEventListener('resize', requestGraphResize);
  }

  function setupResizeObservers() {
    if (typeof ResizeObserver !== 'function') {
      return;
    }

    const graphContainer = document.querySelector('.graph-container');
    const expandedContent = document.querySelector('.expanded-content');

    if (graphContainer) {
      state.graphResizeObserver = new ResizeObserver(function onGraphContainerResize() {
        requestGraphResize();
      });
      state.graphResizeObserver.observe(graphContainer);
    }

    if (expandedContent) {
      state.expandedResizeObserver = new ResizeObserver(function onExpandedContainerResize() {
        requestExpandedResize();
      });
      state.expandedResizeObserver.observe(expandedContent);
    }
  }

  function requestGraphResize() {
    if (timers.resize) {
      clearTimeout(timers.resize);
    }

    timers.resize = setTimeout(function rebuildGraph() {
      rendering.createGraph(state, { selectNode, expandNode });
      rendering.updateGraphHighlighting(state);
    }, 80);
  }

  function requestExpandedResize() {
    if (!state.selectedNode) return;
    if (!document.getElementById('expandedOverlay')?.classList.contains('visible')) return;
    if (!state.selectedNode.codeBlocks || state.selectedNode.codeBlocks.length === 0) return;

    if (timers.resize) {
      clearTimeout(timers.resize);
    }

    timers.resize = setTimeout(function rebuildExpandedGraph() {
      rendering.expandNode(state, state.selectedNode);
    }, 80);
  }

  async function copySelectedPath() {
    if (!state.selectedNode) return;
    const copyButton = document.getElementById('copyBtn');
    if (!copyButton || !navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(state.selectedNode.fullPath);
      const originalText = copyButton.textContent;
      copyButton.textContent = 'Copied!';
      setTimeout(function restoreCopyLabel() {
        copyButton.textContent = originalText;
      }, 2000);
    } catch (error) {
      console.error('Copy path failed:', error);
    }
  }

  // ==========================================================================
  // Small UI Helpers
  // ==========================================================================
  // These helpers keep repeated UI updates concise and consistent.
  // ==========================================================================

  function rebuildUiAfterDataLoad() {
    updateStats();
    panel.buildLegend(state, { setActiveCategory });
    panel.buildFileList(state, { selectNode, expandNode });
    rendering.createGraph(state, { selectNode, expandNode });
    panel.updateDetailPanel(state, { selectNode, expandNode });
    rendering.updateGraphHighlighting(state);
    syncSelectedRowClass();
  }

  function normalizeGraphData(graphData) {
    const normalized = graphData || { nodes: [], edges: [] };
    const nodes = (normalized.nodes || []).map(function cloneNode(node) {
      return Object.assign({
        imports: [],
        importedBy: [],
        codeBlocks: [],
        connectionCount: 0,
        role: 'normal',
      }, node);
    });
    const edges = normalized.edges || [];
    const nodeById = {};

    nodes.forEach(function indexNode(node) {
      node.imports = Array.isArray(node.imports) ? node.imports.slice() : [];
      node.importedBy = Array.isArray(node.importedBy) ? node.importedBy.slice() : [];
      nodeById[node.id] = node;
    });

    // Static exports can ship a compact graph payload and rebuild this derived
    // relationship metadata in the browser instead of embedding duplicate arrays.
    if (edges.length > 0 && nodes.every(function hasEmptyEdges(node) {
      return node.imports.length === 0 && node.importedBy.length === 0;
    })) {
      edges.forEach(function mapEdge(edge) {
        const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
        const sourceNode = nodeById[sourceId];
        const targetNode = nodeById[targetId];
        if (!sourceNode || !targetNode) return;
        sourceNode.imports.push(targetId);
        targetNode.importedBy.push(sourceId);
      });
    }

    nodes.forEach(function updateConnectionCount(node) {
      node.connectionCount = node.imports.length + node.importedBy.length;
    });

    return { nodes: nodes, edges: edges };
  }

  function updateStats() {
    const nodes = state.graphData.nodes || [];
    const edges = state.graphData.edges || [];
    
    let orphans = 0;
    let bridges = 0;
    
    nodes.forEach(function countRoles(n) {
      if (n.role === 'orphan' || (n.imports.length === 0 && n.importedBy.length === 0)) orphans++;
      if (n.role === 'bridge') bridges++;
    });

    const elFiles = document.getElementById('metricTotalFiles');
    const elEdges = document.getElementById('metricTotalEdges');
    const elOrphans = document.getElementById('metricOrphans');
    const elBridges = document.getElementById('metricBridges');

    if (elFiles) elFiles.textContent = String(nodes.length);
    if (elEdges) elEdges.textContent = String(edges.length);
    if (elOrphans) elOrphans.textContent = String(orphans);
    if (elBridges) elBridges.textContent = String(bridges);
  }

  function syncSelectedRowClass() {
    document.querySelectorAll('.file-item').forEach(function updateClass(item) {
      if (state.selectedNode && item.dataset.id === state.selectedNode.id) {
        item.classList.add('selected');
      } else {
        item.classList.remove('selected');
      }
    });
  }

  function setLoadingState(refreshButton, loadingOverlay, isLoading) {
    if (refreshButton) {
      refreshButton.classList.toggle('loading', isLoading);
      refreshButton.textContent = isLoading ? 'Loading...' : 'Refresh Data';
    }
    if (loadingOverlay) {
      loadingOverlay.classList.toggle('hidden', !isLoading);
    }
  }

  // Keep user-facing failures and short progress notes inside the app instead
  // of interrupting the workflow with blocking browser alerts.
  function setStatusMessage(message, kind) {
    const surface = document.getElementById('statusSurface');
    if (!surface) return;

    surface.classList.remove('visible', 'is-info', 'is-success', 'is-error');
    if (!message) {
      surface.textContent = '';
      return;
    }

    surface.textContent = message;
    surface.classList.add('visible', 'is-' + (kind || 'info'));
  }

  namespace.state = state;
  init();
})();
