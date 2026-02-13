# Specification: Roadmap Population & Historical Backfill

## Overview
This track focuses on transforming the Roadmap Visualizer into a high-fidelity "Chronicle" of Aralia's development. It involves backfilling the visualizer with the project's complete history—from foundational core systems to deprecated legacy experiments—using atomic task granularity and semantic dependency mapping.

## Functional Requirements

### 1. Data Backfill & Synthesis
- **Exhaustive Indexing**: Backfill all atomic tasks from `docs/@DOC-REGISTRY.md`, `docs/archive/`, and project-specific sub-folders.
- **Milestone Grouping**: Group related atomic items (like individual spells) into Project Milestones to maintain performance.
- **Drill-down Capability**: Clicking a Milestone Node opens a "Sub-Roadmap" (modal or component) showing individual atomic nodes.
- **Semantic Inference**: Automatically infer technical dependencies between nodes by analyzing documentation content.
- **Rich Task Metadata**:
    - **Source**: Deep links to specification/documentation Markdown files.
    - **Verification**: Original CLI commands and current status.
    - **Impact**: List of primary files modified/created.
    - **Context**: Architectural impact notes and completion timestamps.
- **Date Fallback**: Use `git log` history to determine true creation/completion dates if missing from Markdown files.

### 2. Live Dashboard Integration
- **Auto-Refresh**: The visualizer reads `conductor/tracks/*/metadata.json` in real-time to reflect currently active work.

### 3. Interactive Visualization Engine
- **Layout Engine Selector**:
    - **Timeline**: Chronological flow.
    - **Categorical**: Grouped by domain clusters.
    - **Spiral**: Chronological expansion from center.
- **Visual Taxonomy Selector**:
    - **Color-coding**: By domain (Combat, UI, Data, etc.).
    - **Iconography**: Domain-specific symbols inside nodes.
    - **Status Shading**: Differentiating "Legacy" vs. "Active" work.
- **Navigation Mode Selector**:
    - **Clustered Zoom**: Projects expand into atomic nodes on zoom.
    - **Historical Fog**: Toggle visibility of "Ancient History."
    - **Infinite Canvas**: High-performance map view.

## Non-Functional Requirements
- **Performance**: Support 500+ nodes using "chunked" or "modular" rendering logic.
- **Elasticity**: Maintain zero-lag SVG connections during all navigation modes.
- **Desktop Only**: Optimization for large screens; mobile responsiveness is explicitly out of scope.

## Acceptance Criteria
- [ ] Roadmap JSON contains 100+ historical nodes.
- [ ] UI Selectors for Layout, Taxonomy, and Navigation are functional.
- [ ] "Drill-down" view for Milestone sub-nodes is implemented.
- [ ] Real-time integration with Conductor tracks is verified.
