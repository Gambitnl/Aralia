/**
 * This file handles D3 rendering and interaction for the visualizer graph.
 *
 * The main module passes shared state into these functions so graph simulation,
 * highlighting, tooltip behavior, and expanded block rendering all stay grouped
 * in one rendering-focused module.
 */

(function bootstrapVisualizerRendering() {
  const namespace = (window.CodebaseVisualizer = window.CodebaseVisualizer || {});

  // ==========================================================================
  // Primary Graph Rendering
  // ==========================================================================
  // This creates the full dependency graph, including orphan-zone constraints,
  // node shapes, hover tooltips, click selection, and pan/zoom behavior.
  // ==========================================================================

  function createGraph(state, callbacks) {
    const svg = d3.select('#graph');
    const container = document.querySelector('.graph-container');
    if (!container) return;

    const width = Math.floor(container.clientWidth);
    const height = Math.floor(container.clientHeight);

    // Bail out when the pane has not been laid out yet. The ResizeObserver in
    // main.js will call back again as soon as the container reports a real size.
    if (width <= 0 || height <= 0) {
      return;
    }

    svg.attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    if (state.graphData.nodes.length === 0) {
      state.graphElements = null;
      return;
    }

    // Calculate a reserved zone where orphan nodes are constrained.
    const orphanCount = state.graphData.nodes.filter(function countOrphans(node) {
      return node.connectionCount === 0;
    }).length;
    const orphanZonePadding = 40;
    const orphanZoneWidth = Math.max(250, Math.min(400, orphanCount * 25));
    const orphanZoneHeight = Math.max(200, Math.min(350, orphanCount * 20));
    const orphanZone = {
      x: width - orphanZoneWidth - 30,
      y: height - orphanZoneHeight - 30,
      width: orphanZoneWidth,
      height: orphanZoneHeight,
      padding: orphanZonePadding,
    };

    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', function onZoom(event) {
        graphRoot.attr('transform', event.transform);
      });
    svg.call(zoom);

    const graphRoot = svg.append('g');
    const defs = svg.append('defs');
    appendArrowMarker(defs, 'arrow', '#666');
    appendArrowMarker(defs, 'arrow-in', '#4ade80');
    appendArrowMarker(defs, 'arrow-out', '#f97316');

    let maxConnections = 0;
    state.graphData.nodes.forEach(function updateMaxConnection(node) {
      if (node.connectionCount > maxConnections) maxConnections = node.connectionCount;
    });

    const sizeScale = d3.scaleSqrt().domain([0, maxConnections]).range([6, 40]);
    const nodesCopy = state.graphData.nodes.map(function cloneNode(node) {
      return Object.assign({}, node);
    });
    const edgesCopy = state.graphData.edges.map(function cloneEdge(edge) {
      return { source: edge.source, target: edge.target };
    });

    state.simulation = d3.forceSimulation(nodesCopy)
      .force('link', d3.forceLink(edgesCopy).id(function nodeId(node) {
        return node.id;
      }).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2 - orphanZoneWidth / 4, height / 2))
      .force('collision', d3.forceCollide().radius(function collisionRadius(node) {
        return sizeScale(node.connectionCount) + 5;
      }))
      .force('orphanZone', orphanCount > 0 ? createOrphanZoneForce(nodesCopy, orphanZone, sizeScale) : null);

    const links = graphRoot.append('g')
      .selectAll('line')
      .data(edgesCopy)
      .enter()
      .append('line')
      .attr('class', 'link')
      .attr('stroke', '#666')
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#arrow)');

    const nodes = graphRoot.append('g')
      .selectAll('.node')
      .data(nodesCopy)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', function nodeAriaLabel(node) {
        return buildNodeAriaLabel(node);
      })
      .call(
        d3.drag()
          .on('start', function dragStart(event, node) {
            if (!event.active && state.simulation) state.simulation.alphaTarget(0.3).restart();
            node.fx = node.x;
            node.fy = node.y;
          })
          .on('drag', function dragMove(event, node) {
            node.fx = event.x;
            node.fy = event.y;
          })
          .on('end', function dragEnd(event, node) {
            if (!event.active && state.simulation) state.simulation.alphaTarget(0);
            node.fx = null;
            node.fy = null;
          }),
      );

    // Draw role-specific shapes so bridge/orphan nodes are visible at a glance.
    nodes.each(function drawNodeShape(node) {
      const element = d3.select(this);
      const radius = sizeScale(node.connectionCount);
      const color = getNodeColor(state, node);

      if (node.role === 'orphan') {
        const points = [
          [0, -radius * 1.2],
          [-radius * 1.1, radius * 0.8],
          [radius * 1.1, radius * 0.8],
        ];
        element.append('path')
          .attr('d', d3.line()(points) + 'Z')
          .attr('fill', color)
          .attr('stroke', state.colorMode === 'quality' ? 'none' : '#f87171')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '3,2');
      } else if (node.role === 'bridge') {
        element.append('rect')
          .attr('x', -radius)
          .attr('y', -radius)
          .attr('width', radius * 2)
          .attr('height', radius * 2)
          .attr('fill', color)
          .attr('stroke', state.colorMode === 'quality' ? 'none' : '#4ade80')
          .attr('stroke-width', 1);
      } else {
        element.append('circle')
          .attr('r', radius)
          .attr('fill', color);
      }
    });

    nodes.append('text')
      .attr('class', 'node-label')
      .attr('dy', function labelYOffset(node) {
        return sizeScale(node.connectionCount) + 12;
      })
      .text(function labelText(node) {
        return node.connectionCount > 3 ? node.name : '';
      })
      .style('font-size', function labelFont(node) {
        return Math.max(8, sizeScale(node.connectionCount) / 2) + 'px';
      });

    nodes
      .on('click', function onNodeClick(event, node) {
        event.stopPropagation();
        focusNodeElement(this);
        showTooltipForElement(state, this, node);
        callbacks.selectNode(node);
      })
      .on('dblclick', function onNodeDoubleClick(event, node) {
        event.stopPropagation();
        callbacks.expandNode(node);
      })
      .on('mouseover', function onNodeHover(event, node) {
        showTooltip(state, event, node);
      })
      .on('focus', function onNodeFocus(event, node) {
        showTooltipForElement(state, this, node);
      })
      .on('keydown', function onNodeKeyDown(event, node) {
        if (event.key === 'Enter') {
          event.preventDefault();
          callbacks.selectNode(node);
          showTooltipForElement(state, this, node);
        }

        if (event.key === ' ' || event.key === 'Spacebar') {
          event.preventDefault();
          callbacks.expandNode(node);
        }
      })
      .on('mouseout', hideTooltip)
      .on('blur', hideTooltip);

    svg.on('click', function onCanvasClick() {
      hideTooltip();
      callbacks.selectNode(null);
    });

    state.simulation.on('tick', function onSimulationTick() {
      links
        .attr('x1', function getSourceX(edge) { return edge.source.x; })
        .attr('y1', function getSourceY(edge) { return edge.source.y; })
        .attr('x2', function getTargetX(edge) { return edge.target.x; })
        .attr('y2', function getTargetY(edge) { return edge.target.y; });

      nodes.attr('transform', function getNodeTransform(node) {
        return 'translate(' + node.x + ',' + node.y + ')';
      });
    });

    state.graphElements = { nodes, links, sizeScale, nodesCopy };
  }

  // ==========================================================================
  // Highlight + Selection Rendering
  // ==========================================================================
  // This updates CSS classes and edge arrows based on selected node, active
  // dependency mode, and optional category focus from the legend.
  // ==========================================================================

  function updateGraphHighlighting(state) {
    if (!state.graphElements) return;

    const nodes = state.graphElements.nodes;
    const links = state.graphElements.links;
    const selectedNode = state.selectedNode;
    const activeCategory = state.activeCategory;

    // Category focus is allowed to work independently from file selection.
    // That lets the legend answer "show me the systems area" even before the
    // user chooses a specific file inside that area.
    if (!selectedNode && activeCategory) {
      nodes
        .classed('selected', false)
        .classed('highlighted', function isCategoryMatch(node) { return node.category === activeCategory; })
        .classed('dimmed', function isOtherCategory(node) { return node.category !== activeCategory; });

      links
        .classed('highlighted-in', false)
        .classed('highlighted-out', false)
        .classed('dimmed', function isCrossCategory(edge) {
          return edge.source.category !== activeCategory || edge.target.category !== activeCategory;
        })
        .attr('marker-end', 'url(#arrow)');
      return;
    }

    if (!selectedNode) {
      nodes.classed('selected', false).classed('highlighted', false).classed('dimmed', false);
      links.classed('highlighted-in', false)
        .classed('highlighted-out', false)
        .classed('dimmed', false)
        .attr('marker-end', 'url(#arrow)');
      return;
    }

    const connectedNodes = {};
    connectedNodes[selectedNode.id] = true;
    const incomingEdges = {};
    const outgoingEdges = {};

    if (state.dependencyMode === 'all' || state.dependencyMode === 'in') {
      selectedNode.imports.forEach(function markIncoming(id) {
        connectedNodes[id] = true;
        incomingEdges[selectedNode.id + '->' + id] = true;
      });
    }

    if (state.dependencyMode === 'all' || state.dependencyMode === 'out') {
      selectedNode.importedBy.forEach(function markOutgoing(id) {
        connectedNodes[id] = true;
        outgoingEdges[id + '->' + selectedNode.id] = true;
      });
    }

    nodes
      .classed('selected', function isSelected(node) { return node.id === selectedNode.id; })
      .classed('highlighted', function isHighlighted(node) {
        if (node.id === selectedNode.id) return false;
        if (!connectedNodes[node.id]) return false;
        return !activeCategory || node.category === activeCategory;
      })
      .classed('dimmed', function isDimmed(node) {
        if (node.id === selectedNode.id) {
          return Boolean(activeCategory && node.category !== activeCategory);
        }

        if (activeCategory && node.category !== activeCategory) {
          return true;
        }

        return !connectedNodes[node.id];
      });

    links.each(function decorateLink(edge) {
      const link = d3.select(this);
      const edgeKeyForward = edge.source.id + '->' + edge.target.id;
      const edgeKeyReverse = edge.target.id + '->' + edge.source.id;

      const isIncoming = incomingEdges[edgeKeyForward] || incomingEdges[edgeKeyReverse];
      const isOutgoing = outgoingEdges[edgeKeyForward] || outgoingEdges[edgeKeyReverse];
      const isConnected = isIncoming || isOutgoing;
      const isInsideActiveCategory = !activeCategory
        || (edge.source.category === activeCategory && edge.target.category === activeCategory);

      link.classed('highlighted-in', isIncoming)
        .classed('highlighted-out', isOutgoing)
        .classed('dimmed', !isConnected || !isInsideActiveCategory);

      if (!isInsideActiveCategory) {
        link.attr('marker-end', 'url(#arrow)');
      } else if (isIncoming) {
        link.attr('marker-end', 'url(#arrow-in)');
      } else if (isOutgoing) {
        link.attr('marker-end', 'url(#arrow-out)');
      } else {
        link.attr('marker-end', 'url(#arrow)');
      }
    });
  }

  // ==========================================================================
  // Expanded View Rendering
  // ==========================================================================
  // Double-clicking a file still opens the focused graph, but the detail panel
  // also exposes an explicit button so the expanded view is not gesture-only.
  // ==========================================================================

  function expandNode(state, node) {
    if (!node || !node.codeBlocks || node.codeBlocks.length === 0) return;

    const overlay = document.getElementById('expandedOverlay');
    const title = document.getElementById('expandedFileName');
    const description = document.getElementById('expandedFileDesc');
    if (!overlay || !title || !description) return;

    title.textContent = node.name;
    description.textContent = node.description + ' - ' + node.codeBlocks.length + ' code blocks';
    overlay.classList.add('visible');
    createExpandedGraph(state, node);
  }

  function closeExpandedView(state) {
    const overlay = document.getElementById('expandedOverlay');
    if (overlay) overlay.classList.remove('visible');
    if (state.expandedSimulation) {
      state.expandedSimulation.stop();
      state.expandedSimulation = null;
    }
  }

  function createExpandedGraph(state, fileNode) {
    const svg = d3.select('#expanded-graph');
    const container = document.querySelector('.expanded-content');
    if (!container) return;

    const width = Math.floor(container.clientWidth);
    const height = Math.floor(container.clientHeight);

    if (width <= 0 || height <= 0) {
      return;
    }

    svg.attr('width', width).attr('height', height);
    svg.selectAll('*').remove();

    const zoom = d3.zoom()
      .scaleExtent([0.5, 3])
      .on('zoom', function onZoom(event) {
        graphRoot.attr('transform', event.transform);
      });
    svg.call(zoom);

    const graphRoot = svg.append('g');
    const blockColors = {
      component: '#7dd3fc',
      hook: '#a78bfa',
      function: '#4ade80',
      class: '#f97316',
      type: '#fbbf24',
      interface: '#f472b6',
      enum: '#fb923c',
      constant: '#94a3b8',
    };

    const centerNode = {
      id: 'center',
      name: fileNode.name,
      type: 'file',
      description: fileNode.description,
      isCenter: true,
    };

    const blockNodes = fileNode.codeBlocks.map(function mapBlock(block, index) {
      return {
        id: 'block-' + index,
        name: block.name,
        type: block.type,
        description: block.description,
        exports: block.exports,
        isCenter: false,
      };
    });

    const allNodes = [centerNode].concat(blockNodes);
    const edges = blockNodes.map(function mapEdge(node) {
      return { source: 'center', target: node.id };
    });

    function sizeScale(node) {
      if (node.isCenter) return 50;
      return node.exports ? 25 : 18;
    }

    state.expandedSimulation = d3.forceSimulation(allNodes)
      .force('link', d3.forceLink(edges).id(function nodeId(node) { return node.id; }).distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(function collisionRadius(node) { return sizeScale(node) + 10; }));

    const links = graphRoot.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', '#4a4a6a')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '5,5');

    const nodes = graphRoot.append('g')
      .selectAll('.expanded-node')
      .data(allNodes)
      .enter()
      .append('g')
      .attr('class', 'expanded-node')
      .style('cursor', 'default');

    nodes.append('circle')
      .attr('r', sizeScale)
      .attr('fill', function fillNode(node) {
        return node.isCenter ? state.categoryColors[fileNode.category] : blockColors[node.type];
      })
      .attr('stroke', function strokeNode(node) {
        return node.exports ? '#fff' : 'none';
      })
      .attr('stroke-width', 2);

    nodes.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', function nodeLabelOffset(node) {
        return sizeScale(node) + 15;
      })
      .attr('fill', '#fff')
      .style('font-size', '11px')
      .text(function nodeLabel(node) {
        return node.name;
      });

    nodes.filter(function nonCenter(node) {
      return !node.isCenter;
    }).append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', function typeLabelOffset(node) {
        return sizeScale(node) + 28;
      })
      .attr('fill', '#888')
      .style('font-size', '9px')
      .text(function typeLabel(node) {
        return node.type;
      });

    state.expandedSimulation.on('tick', function onExpandedTick() {
      links
        .attr('x1', function getSourceX(edge) { return edge.source.x; })
        .attr('y1', function getSourceY(edge) { return edge.source.y; })
        .attr('x2', function getTargetX(edge) { return edge.target.x; })
        .attr('y2', function getTargetY(edge) { return edge.target.y; });

      nodes.attr('transform', function getNodeTransform(node) {
        return 'translate(' + node.x + ',' + node.y + ')';
      });
    });
  }

  // ==========================================================================
  // Tooltip Rendering
  // ==========================================================================
  // Tooltips show either file descriptions or quality issue summaries.
  // ==========================================================================

  function showTooltip(state, event, node) {
    const tooltip = document.getElementById('tooltip');
    const title = document.getElementById('tooltipTitle');
    const description = document.getElementById('tooltipDesc');
    const imports = document.getElementById('tooltipIn');
    const dependents = document.getElementById('tooltipOut');
    if (!tooltip || !title || !description || !imports || !dependents) return;

    title.textContent = node.name;

    if (state.colorMode === 'quality' && state.qualityByFile[node.id]) {
      const qInfo = state.qualityByFile[node.id];
      const breakdown = {};
      qInfo.issues.forEach(function countIssue(issue) {
        breakdown[issue.pattern] = (breakdown[issue.pattern] || 0) + 1;
      });
      const parts = Object.keys(breakdown).map(function formatBreakdown(pattern) {
        return breakdown[pattern] + 'x ' + pattern;
      });
      description.textContent = qInfo.total + ' issue(s): ' + parts.join(', ');
    } else if (state.colorMode === 'quality') {
      description.textContent = 'No issues found';
    } else {
      description.textContent = node.description;
    }

    imports.textContent = String(node.imports.length);
    dependents.textContent = String(node.importedBy.length);
    tooltip.style.left = event.pageX + 15 + 'px';
    tooltip.style.top = event.pageY + 15 + 'px';
    tooltip.classList.add('visible');
    tooltip.setAttribute('aria-hidden', 'false');
  }

  function hideTooltip() {
    const tooltip = document.getElementById('tooltip');
    if (tooltip) {
      tooltip.classList.remove('visible');
      tooltip.setAttribute('aria-hidden', 'true');
    }
  }

  // ==========================================================================
  // Helper Functions
  // ==========================================================================
  // These internal helpers keep marker setup, node coloring, and orphan-zone
  // force rules readable inside createGraph.
  // ==========================================================================

  function appendArrowMarker(defs, id, color) {
    defs.append('marker')
      .attr('id', id)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', color);
  }

  function getNodeColor(state, node) {
    if (state.colorMode !== 'quality') {
      return state.categoryColors[node.category] || '#888';
    }

    const qInfo = state.qualityByFile[node.id];
    if (!qInfo) return '#333';
    if (qInfo.total === 0) return '#2d6a4f';
    if (qInfo.total <= 2) return '#fbbf24';
    if (qInfo.total <= 5) return '#f97316';
    return '#f87171';
  }

  function createOrphanZoneForce(nodesCopy, orphanZone, sizeScale) {
    const strength = 0.1;

    return function orphanZoneForce(alpha) {
      nodesCopy.forEach(function constrainNode(node) {
        const isOrphan = node.connectionCount === 0;
        const nodeRadius = sizeScale(node.connectionCount);

        if (isOrphan) {
          const minX = orphanZone.x + orphanZone.padding + nodeRadius;
          const maxX = orphanZone.x + orphanZone.width - orphanZone.padding - nodeRadius;
          const minY = orphanZone.y + orphanZone.padding + nodeRadius;
          const maxY = orphanZone.y + orphanZone.height - orphanZone.padding - nodeRadius;

          if (node.x < minX) node.vx += (minX - node.x) * strength * alpha;
          if (node.x > maxX) node.vx += (maxX - node.x) * strength * alpha;
          if (node.y < minY) node.vy += (minY - node.y) * strength * alpha;
          if (node.y > maxY) node.vy += (maxY - node.y) * strength * alpha;

          if (node.x === undefined || node.y === undefined) {
            node.x = orphanZone.x + orphanZone.width / 2 + (Math.random() - 0.5) * 100;
            node.y = orphanZone.y + orphanZone.height / 2 + (Math.random() - 0.5) * 100;
          }
          return;
        }

        const zoneLeft = orphanZone.x - nodeRadius;
        const zoneRight = orphanZone.x + orphanZone.width + nodeRadius;
        const zoneTop = orphanZone.y - nodeRadius;
        const zoneBottom = orphanZone.y + orphanZone.height + nodeRadius;

        if (node.x > zoneLeft && node.x < zoneRight && node.y > zoneTop && node.y < zoneBottom) {
          const distLeft = node.x - zoneLeft;
          const distRight = zoneRight - node.x;
          const distTop = node.y - zoneTop;
          const distBottom = zoneBottom - node.y;
          const minDist = Math.min(distLeft, distRight, distTop, distBottom);

          if (minDist === distLeft) node.vx -= strength * alpha * 50;
          else if (minDist === distRight) node.vx += strength * alpha * 50;
          else if (minDist === distTop) node.vy -= strength * alpha * 50;
          else node.vy += strength * alpha * 50;
        }
      });
    };
  }

  function showTooltipForElement(state, element, node) {
    const bounds = element.getBoundingClientRect();
    showTooltip(state, {
      pageX: bounds.left + bounds.width / 2 + window.scrollX,
      pageY: bounds.top + bounds.height / 2 + window.scrollY,
    }, node);
  }

  function buildNodeAriaLabel(node) {
    const roleDescription = node.role === 'bridge'
      ? 'Bridge node'
      : node.role === 'orphan'
        ? 'Orphan node'
        : 'File node';
    return roleDescription + ' for ' + node.name + '. '
      + node.imports.length + ' imports, '
      + node.importedBy.length + ' dependents, '
      + node.codeBlocks.length + ' code blocks.';
  }

  function focusNodeElement(element) {
    if (element && typeof element.focus === 'function') {
      element.focus();
    }
  }

  namespace.rendering = {
    createGraph,
    updateGraphHighlighting,
    expandNode,
    closeExpandedView,
  };
})();
