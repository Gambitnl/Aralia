/**
 * This file contains browser-side API wrappers for visualizer endpoints.
 *
 * The main UI module calls these helpers so network concerns stay separate from
 * rendering and panel state logic.
 */

(function bootstrapVisualizerApi() {
  // Ensure all client files share one namespace regardless of load order.
  const namespace = (window.CodebaseVisualizer = window.CodebaseVisualizer || {});

  // ==========================================================================
  // Graph + Scan Fetchers
  // ==========================================================================
  // These wrappers normalize fetch behavior so callers can rely on JSON payloads
  // and consistent error messages.
  // ==========================================================================

  async function fetchGraphData(options) {
    const forceRefresh = Boolean(options && options.forceRefresh);
    const response = await fetch(forceRefresh ? '/api/graph?refresh=1' : '/api/graph');
    if (!response.ok) {
      throw new Error('Graph request failed with status ' + response.status);
    }
    return response.json();
  }

  async function fetchScanData() {
    // Scan is now POST-only so random links or prefetches cannot trigger an
    // expensive repo-wide scan by accident.
    const response = await fetch('/api/scan', { method: 'POST' });
    if (!response.ok) {
      throw new Error('Scan request failed with status ' + response.status);
    }
    return response.json();
  }

  namespace.api = {
    fetchGraphData,
    fetchScanData,
  };
})();
