/**
 * This file owns sidebar rendering for the visualizer UI.
 *
 * It builds the legend, file list, and detail panel so graph rendering code can
 * focus only on node simulation and link highlighting.
 */

(function bootstrapVisualizerPanel() {
  const namespace = (window.CodebaseVisualizer = window.CodebaseVisualizer || {});

  // ==========================================================================
  // Legend Rendering
  // ==========================================================================
  // The legend switches between category colors and quality-health colors based
  // on active view mode. In category mode it also doubles as the "focus this
  // slice of the codebase" control so non-coders can isolate one area without
  // learning graph query syntax.
  // ==========================================================================

  function buildLegend(state, callbacks) {
    const legend = document.getElementById('legend');
    if (!legend) return;

    if (state.colorMode === 'quality') {
      legend.innerHTML = '<div class="legend-title">Code Quality</div>';
      const qualityLevels = [
        { color: '#2d6a4f', label: 'Clean (0 issues)' },
        { color: '#fbbf24', label: '1-2 issues' },
        { color: '#f97316', label: '3-5 issues' },
        { color: '#f87171', label: '6+ issues' },
        { color: '#333', label: 'Not scanned' },
      ];

      qualityLevels.forEach(function appendQualityLegendEntry(level) {
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = '<div class="legend-color" style="background: '
          + level.color
          + '"></div><span>'
          + level.label
          + '</span>';
        legend.appendChild(item);
      });
      return;
    }

    legend.innerHTML = '<div class="legend-title">Categories</div>';
    legend.appendChild(createLegendCategoryButton({
      category: null,
      label: 'All Categories',
      color: '#e0e0e0',
      isActive: !state.activeCategory,
      fileCount: state.graphData.nodes.length,
      callbacks,
    }));

    const seen = {};
    const categories = [];

    state.graphData.nodes.forEach(function collectCategories(node) {
      if (!seen[node.category]) {
        seen[node.category] = true;
        categories.push(node.category);
      }
    });

    categories.sort(function sortCategories(left, right) {
      return left.localeCompare(right);
    });

    categories.forEach(function appendCategoryLegendEntry(category) {
      const color = state.categoryColors[category] || '#888';
      const fileCount = state.graphData.nodes.filter(function countNodes(node) {
        return node.category === category;
      }).length;
      legend.appendChild(createLegendCategoryButton({
        category,
        label: formatCategoryLabel(category),
        color,
        isActive: state.activeCategory === category,
        fileCount,
        callbacks,
      }));
    });
  }

  // ==========================================================================
  // File List Rendering
  // ==========================================================================
  // The list is filterable and mirrors graph selection state. Category focus
  // now narrows this list too, so the sidebar and graph stay in agreement.
  // ==========================================================================

  function buildFileList(state, callbacks) {
    const container = document.getElementById('fileList');
    if (!container) return;

    container.innerHTML = '';
    const searchLower = state.searchFilter.toLowerCase();

    const filteredNodes = state.graphData.nodes.filter(function filterNodes(node) {
      if (state.activeCategory && node.category !== state.activeCategory) {
        return false;
      }

      if (!searchLower) return true;
      return node.name.toLowerCase().indexOf(searchLower) !== -1
        || node.relativePath.toLowerCase().indexOf(searchLower) !== -1;
    });

    if (filteredNodes.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'file-list-empty';
      emptyState.textContent = state.activeCategory
        ? 'No files in ' + formatCategoryLabel(state.activeCategory) + ' match the current search.'
        : 'No files match the current search.';
      container.appendChild(emptyState);
      return;
    }

    filteredNodes.forEach(function renderFileRow(node) {
      container.appendChild(createListRow(node, state, callbacks));
    });

    buildHubList(state, callbacks);
    buildOrphanList(state, callbacks);
  }

  function buildHubList(state, callbacks) {
    const container = document.getElementById('hubList');
    if (!container) return;
    container.innerHTML = '';
    
    const sorted = state.graphData.nodes.slice().sort(function sortByConnections(a, b) {
       return b.connectionCount - a.connectionCount;
    }).slice(0, 30);
    
    if (sorted.length === 0) {
      container.innerHTML = '<div class="file-list-empty">No hub files found.</div>';
      return;
    }
    
    sorted.forEach(function(node) {
       container.appendChild(createListRow(node, state, callbacks));
    });
  }

  function buildOrphanList(state, callbacks) {
    const container = document.getElementById('orphanList');
    if (!container) return;
    container.innerHTML = '';
    
    const orphans = state.graphData.nodes.filter(function isOrphan(node) {
       return node.imports.length === 0 && node.importedBy.length === 0;
    });
    
    if (orphans.length === 0) {
      container.innerHTML = '<div class="file-list-empty">No orphaned files.</div>';
      return;
    }
    
    orphans.forEach(function(node) {
       container.appendChild(createListRow(node, state, callbacks));
    });
  }

  function createListRow(node, state, callbacks) {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.dataset.id = node.id;
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-label', node.name + '. ' + node.imports.length + ' imports, ' + node.importedBy.length + ' dependents, ' + node.codeBlocks.length + ' code blocks.');

      if (state.selectedNode && state.selectedNode.id === node.id) {
        item.classList.add('selected');
      }

      item.innerHTML = '<div class="file-name">' + escapeHtml(node.name) + '</div>'
        + '<div class="file-path">' + escapeHtml(node.relativePath) + '</div>'
        + '<div class="file-stats">'
        + '<span class="stat stat-in">&#x2190; ' + node.imports.length + ' imports</span>'
        + '<span class="stat stat-out">' + node.importedBy.length + ' dependents &#x2192;</span>'
        + '<span class="stat stat-blocks">' + node.codeBlocks.length + ' blocks</span>'
        + '</div>';

      item.addEventListener('click', function onClick() {
        callbacks.selectNode(node);
      });
      item.addEventListener('dblclick', function onDoubleClick() {
        callbacks.expandNode(node);
      });
      item.addEventListener('keydown', function onKeyDown(event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          callbacks.selectNode(node);
        }
        if (event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          callbacks.expandNode(node);
        }
      });
      return item;
  }

  function scrollToFileInList(nodeId) {
    const selector = '.file-item[data-id="' + cssEscape(nodeId) + '"]';
    const item = document.querySelector(selector);
    if (!item) return;
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ==========================================================================
  // Detail Panel Rendering
  // ==========================================================================
  // The detail panel swaps between category metadata and quality findings based
  // on active mode.
  // ==========================================================================

  function updateDetailPanel(state, callbacks) {
    const node = state.selectedNode;
    const panel = document.getElementById('detailPanel');
    if (panel) {
      const existingActionRow = panel.querySelector('.code-block-actions');
      if (existingActionRow) existingActionRow.remove();
    }

    if (state.colorMode === 'quality' && node) {
      renderQualityDetailPanel(state, node);
      return;
    }
    renderCategoryDetailPanel(state, node, callbacks);
  }

  function renderCategoryDetailPanel(state, node, callbacks) {
    const panel = document.getElementById('detailPanel');
    const title = document.getElementById('detailTitle');
    const description = document.getElementById('detailDesc');
    const codeBlocksList = document.getElementById('codeBlocksList');
    const dependentsList = document.getElementById('dependentsList');
    const pathText = document.getElementById('detailPathText');
    const copyButton = document.getElementById('copyBtn');
    if (!panel || !title || !description || !codeBlocksList || !dependentsList || !pathText || !copyButton) return;

    if (!node) {
      panel.classList.remove('visible');
      return;
    }

    panel.classList.add('visible');
    title.textContent = node.name;
    description.textContent = node.description;
    pathText.textContent = node.relativePath;
    copyButton.style.display = 'inline-block';

    // Give the user an explicit action for the expanded view so the panel is not
    // relying on double-click alone.
    const actionRow = document.createElement('div');
    actionRow.className = 'code-block-actions';

    const expandButton = document.createElement('button');
    expandButton.className = 'expand-btn';
    expandButton.textContent = node.codeBlocks.length > 0 ? 'Open Expanded View' : 'Expanded View Unavailable';
    expandButton.disabled = node.codeBlocks.length === 0;
    expandButton.addEventListener('click', function onExpandClick() {
      if (callbacks && typeof callbacks.expandNode === 'function') {
        callbacks.expandNode(node);
      }
    });

    actionRow.appendChild(expandButton);
    codeBlocksList.parentNode.insertBefore(actionRow, codeBlocksList);

    codeBlocksList.innerHTML = '';
    node.codeBlocks.forEach(function renderCodeBlock(block) {
      const item = document.createElement('li');
      item.className = 'code-block-item type-' + block.type;
      const exportBadge = block.exports
        ? '<span class="block-type" style="background:#4ade8022; color:#4ade80; border:1px solid #4ade8044; margin-left:5px;">EXPORTED</span>'
        : '';

      item.innerHTML = '<div class="block-header">'
        + '<span class="block-name">' + escapeHtml(block.name) + exportBadge + '</span>'
        + '<span class="block-type">' + escapeHtml(block.type) + '</span>'
        + '</div>'
        + '<div class="block-desc">' + escapeHtml(block.description) + '</div>';
      codeBlocksList.appendChild(item);
    });

    if (node.codeBlocks.length === 0) {
      codeBlocksList.innerHTML = '<li style="color: #666; font-size: 0.85em;">No code blocks extracted</li>';
    }

    dependentsList.innerHTML = '';
    node.importedBy.forEach(function renderDependent(depId) {
      const depNode = state.graphData.nodes.find(function findNode(candidate) {
        return candidate.id === depId;
      });

      const item = document.createElement('li');
      item.className = 'code-block-item';
      item.style.cursor = 'pointer';
      item.innerHTML = '<div class="block-header"><span class="block-name">'
        + escapeHtml(depNode ? depNode.name : depId)
        + '</span></div><div class="block-desc" style="font-size:0.7em">'
        + escapeHtml(depId)
        + '</div>';

      item.onclick = function onDependentClick() {
        if (depNode) {
          callbacks.selectNode(depNode);
          scrollToFileInList(depNode.id);
        }
      };
      dependentsList.appendChild(item);
    });

    if (node.importedBy.length === 0) {
      dependentsList.innerHTML = '<li style="color: #666; font-size: 0.85em;">No dependents found (Orphan)</li>';
    }
  }

  function renderQualityDetailPanel(state, node) {
    const panel = document.getElementById('detailPanel');
    const title = document.getElementById('detailTitle');
    const description = document.getElementById('detailDesc');
    const codeBlocksList = document.getElementById('codeBlocksList');
    const dependentsList = document.getElementById('dependentsList');
    const pathText = document.getElementById('detailPathText');
    const copyButton = document.getElementById('copyBtn');
    if (!panel || !title || !description || !codeBlocksList || !dependentsList || !pathText || !copyButton) return;

    panel.classList.add('visible');
    title.textContent = node.name;
    pathText.textContent = node.relativePath;
    copyButton.style.display = 'inline-block';

    const qInfo = state.qualityByFile[node.id];
    if (!qInfo || qInfo.total === 0) {
      description.innerHTML = '<span style="color: #4ade80;">&#10003; Clean — no issues detected</span>';
      codeBlocksList.innerHTML = '';
      dependentsList.innerHTML = '';
      return;
    }

    const countClass = qInfo.total <= 2 ? 'q-warn' : 'q-bad';
    description.innerHTML = '<div class="quality-summary"><span class="q-count '
      + countClass
      + '">'
      + qInfo.total
      + '</span> issue(s) found</div>';

    const grouped = {};
    qInfo.issues.forEach(function groupIssue(issue) {
      if (!grouped[issue.pattern]) grouped[issue.pattern] = [];
      grouped[issue.pattern].push(issue);
    });

    codeBlocksList.innerHTML = '';
    Object.keys(grouped).forEach(function renderGroup(pattern) {
      const section = document.createElement('div');
      section.className = 'section-title';
      section.style.marginTop = '8px';
      section.textContent = pattern + ' (' + grouped[pattern].length + ')';
      codeBlocksList.appendChild(section);

      grouped[pattern].forEach(function renderIssue(issue) {
        const item = document.createElement('li');
        item.className = 'quality-issue-item type-' + pattern;
        item.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center;">'
          + '<span class="quality-issue-line">Line ' + issue.line + '</span>'
          + '<span class="quality-issue-type">' + pattern + '</span>'
          + '</div>'
          + '<div class="quality-issue-text" title="' + escapeHtml(issue.text || '') + '">'
          + escapeHtml(issue.text || '')
          + '</div>';
        codeBlocksList.appendChild(item);
      });
    });

    dependentsList.innerHTML = '';
  }

  // ==========================================================================
  // HTML Escaping Helpers
  // ==========================================================================
  // These helpers prevent UI string injection when file paths or scan snippets
  // contain quote-like characters.
  // ==========================================================================

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) {
      return window.CSS.escape(value);
    }
    return String(value).replace(/"/g, '\\"');
  }

  function formatCategoryLabel(category) {
    return String(category)
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, function uppercaseLetter(letter) {
        return letter.toUpperCase();
      });
  }

  function createLegendCategoryButton(options) {
    const item = document.createElement('button');
    const fileCountLabel = options.fileCount === 1 ? '1 file' : options.fileCount + ' files';

    item.type = 'button';
    item.className = 'legend-item legend-filter-button';
    if (options.isActive) {
      item.classList.add('active');
    }

    item.setAttribute('aria-pressed', options.isActive ? 'true' : 'false');
    item.setAttribute('title', 'Focus ' + options.label + ' (' + fileCountLabel + ')');
    item.innerHTML = '<div class="legend-color" style="background: '
      + options.color
      + '"></div><span class="legend-label">'
      + escapeHtml(options.label)
      + '</span><span class="legend-count">'
      + escapeHtml(fileCountLabel)
      + '</span>';

    item.addEventListener('click', function onClick() {
      if (!options.callbacks || typeof options.callbacks.setActiveCategory !== 'function') return;
      options.callbacks.setActiveCategory(options.isActive ? null : options.category);
    });

    return item;
  }

  namespace.panel = {
    buildLegend,
    buildFileList,
    scrollToFileInList,
    updateDetailPanel,
  };
})();
