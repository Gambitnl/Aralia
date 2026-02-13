# @ROADMAP-SYSTEM-GUIDE.md

**Purpose**: Documentation for the Aralia "Elastic" Roadmap Visualizer and Knowledge Tree.

---

## 🧭 Overview

The **Aralia Chronicles Roadmap** is a high-fidelity, interactive visualization tool designed to track the project's history, current development pillars, and future milestones. Unlike static text roadmaps, it provides an "elastic" node-and-edge graph that represents dependencies and progress visually.

### Key Features
- **Elastic Interaction**: Drag nodes; the connecting SVG lines stretch and curve in real-time.
- **Status Tracking**: Visual indicators for `done`, `active`, and `planned` states.
- **Deep Linking**: Nodes can link directly to specific documentation files (e.g., `docs/tasks/...`).
- **Progress Bars**: Integrated completion percentages within node tooltips.
- **Agent Integration**: Designed to be read and updated by AI agents to maintain project context.

---

## 🏗️ Architecture

The system consists of three main components:

### 1. The Data Source (`.agent/roadmap/roadmap.json`)
The "Source of Truth" for the roadmap. It defines the tree structure using a simple JSON schema.
- **Nodes**: Represent milestones, projects, or tasks.
  - `type`: `root`, `project`, `milestone`, or `task`.
  - `status`: `done`, `active`, or `planned`.
  - `progress`: Number (0-100).
  - `link`: Relative path to documentation.
- **Edges**: Define connections (from/to) between node IDs.

### 2. The Visualizer (`src/components/debug/RoadmapPOC.tsx`)
A React component built with:
- **Framer Motion**: Handles high-performance dragging and node physics.
- **Motion Values**: Synchronizes HTML node positions with SVG line endpoints at 60fps with zero lag.
- **Reactive SVG**: A background layer that draws Bezier curves (`M C`) between active motion values.

### 3. Integration Points
- **Dev Hub**: Linked via `misc/dev_hub.html`.
- **App Phase**: Accessed via `GamePhase.ROADMAP_POC` (URL param `?phase=roadmap_poc`).

---

## 🛠️ How to Update

### For Humans
To add a new node or change a status:
1. Open `.agent/roadmap/roadmap.json`.
2. Add a new object to the `nodes` array.
3. Define its `initialX` and `initialY` (suggested grid: 150px spacing).
4. Add an edge in the `edges` array to connect it to its parent.

### For Agents
Agents should use the `replace` tool to update node `status`, `progress`, or `link` values as work is completed. When a new project track is initialized (via Conductor), a corresponding node should be added to the roadmap.

---

## 🔮 Future Roadmap for the Roadmap
- [ ] **Position Persistence**: Save manual node arrangements to `localStorage` or a config file.
- [ ] **Auto-Sync**: Automatically update progress percentages based on `docs/@DOC-REGISTRY.md` or test results.
- [ ] **Multi-Select**: Drag groups of nodes simultaneously.
- [ ] **Thematic Skins**: Switch between "Arcane" (gold/blue) and "Terminal" (green/black) visual styles.

---

## 🔗 Related Documents
- [`docs/@DOC-REGISTRY.md`](./@DOC-REGISTRY.md) - The source for task numbering and status.
- [`docs/@ACTIVE-DOCS.md`](./@ACTIVE-DOCS.md) - Current active initiatives.
- [`misc/dev_hub.html`](../misc/dev_hub.html) - Entry point for the visualizer.
