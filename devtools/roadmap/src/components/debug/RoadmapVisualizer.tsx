// Re-export shim — the full RoadmapVisualizer lives in the main repo's devtools/roadmap/src/components/debug/roadmap/
// This stub keeps the roadmap-entry.tsx import valid for the spell-branch worktree.
// When merging to master, this file should be removed and the original used instead.
export { RoadmapVisualizer } from './roadmap/RoadmapVisualizer';
