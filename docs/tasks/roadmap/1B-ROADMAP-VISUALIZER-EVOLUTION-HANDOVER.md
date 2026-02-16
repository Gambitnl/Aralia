# Roadmap Tool: Task Handover & Vision

**Status**: Active / Handover
**Target Audience**: Senior Engineers / Agents (Pickle Rick, Jules)
**Goal**: Transform the "Roadmap Visualizer" into the "Aralia Command Center."

---

## 1. The Vision: "The Elastic Knowledge Tree"

The Roadmap is the primary visualization layer for project health and milestone tracking.

-   **Elastic (Spring Physics)**: It feels alive. Nodes have mass and spring constraints. Dragging a Project node **pulls its children** in a "spring-like" manner (non-rigid), allowing for fluid reorganization while maintaining hierarchy.
-   **Terminal-First**: The aesthetic is "Terminal" by default (Neon Green/Black, scanlines, monospace).
-   **Status-Only**: This tool is for **visualizing** projects, feature implementations, and milestone sub-branches. It is NOT intended for "task creation."
-   **Context-Aware**: It knows *what* code implements *which* task (via `// RALPH:` tags and file imports).

---

## 2. Functional Requirements (The "What")

### A. The Data Engine (Backend)
**Current**: `scripts/roadmap-server-logic.ts` (Read-only)
**Future**: `scripts/roadmap-engine.ts` (Read/Write)

1.  **Live Sync**:
    -   Watch `docs/@DOC-REGISTRY.md` and `docs/tasks/**/*.md` for file changes.
2.  **Status Write-Back**:
    -   Allows the UI to update the `status` and `progress` of existing tasks back to their markdown sources.
3.  **Dependency Resolution**:
    -   Parse the `Dependencies` column in `DOC-REGISTRY.md`.

### B. The Visualizer (Frontend)
**Current**: `src/components/debug/RoadmapVisualizer.tsx`

1.  **Persistence**:
    -   Save `(x, y)` coordinates of every node to `.agent/roadmap-local/layout.json` (gitignored internal workspace).
2.  **Thematic Skins**:
    -   **Terminal (Default)**:
        -   Font: Consolas / Monospace.
        -   Colors: Neon Green (#4ade80), Black (#000), Scanlines.
        -   VFX: Glitch effect on hover, rigid grid background.
    -   **Arcane (Toggle)**:
        -   Font: Cinzel / Serif.
        -   Colors: Gold (#fbbf24), Deep Blue (#1e3a8a).
3.  **Interaction Design**:
    -   **Spring-Based Drag**: Moving a parent node propagates motion to children via spring constraints.
    -   **Left-Click**: Select node (opens Side Panel).
    -   **Scroll**: Zoom (centered on cursor).

### C. Data Lifecycle & Artifact Obsolescence
The Roadmap project is designed to eliminate "Documentation Debt."
-   **Temporary Queues**: Files like `docs/@ALL-MD-FILES.md` are **temporary mining queues** used for the Ralph Deep Mining initiative.
-   **Execution Path**: Once the **Roadmap Data Engine** (`roadmap-server-logic.ts`) has successfully indexed a file and extracted its milestones/insights, the corresponding entry in the static lists is obsolete.
-   **Destruction Policy**: These static files are scaffolds. They MUST be archived or deleted once the dynamic engine owns the knowledge base. Do not let "AI Slop" (redundant static lists) clutter the repo.

---

## 2.1 Operational Rebase (Feb 16, 2026)

The following execution constraints are now approved for this initiative:

-   **Execution Mode**: Visualizer-first and read-focused (no status/progress write-back in this phase).
-   **Storage Location**: Roadmap runtime data is internal-only in `.agent/roadmap-local/` (gitignored).
-   **Network Behavior**: API calls must be same-origin/host-relative (no hardcoded IP dependencies).
-   **Graph Semantics**:
    -   Hierarchy is `Feature -> Sub-feature -> Components`.
    -   Dependency cross-links are visual-only.
    -   Parent-child nodes move together during drag interactions.
-   **Mining Cadence**: Process one document at a time, with full read + fact check + stale-content correction.
-   **Pilot Shape**: First pass is a 5-document sequential pilot.

---

## 5. MANDATORY AGENT PROTOCOL: "THE INQUISITION"

Any agent assigned to this task (Pickle Rick, Jules, etc.) is FORBIDDEN from blindly executing. You must approach this with a **critical and investigative mind**.

1.  **Deep Audit**: Read `docs/tasks/roadmap/1C-ROADMAP-IMPLEMENTATION-PLAN.md` and `docs/@ROADMAP-SYSTEM-GUIDE.md`. Compare them against the "Live" state in `scripts/roadmap-server-logic.ts`.
2.  **Verify Phasing**: Does the current phasing make sense? Are we building "Auto-Sync" before "Persistence"? If you find a logical flaw, call it out.
3.  **Interrogate the Mining Status**: Investigate the status of "Ralph Deep Mining" in `.agent/roadmap/mining_progress.md`. Determine exactly how the transition from "Static List" to "Dynamic Node" is being handled.
4.  **Inquiry Before Action**: After your audit, you MUST present the user with a list of rigorous, clarifying questions. Do not assume the plan is perfect. Your job is to ensure it is **properly written, phased adequately, and free of Jerry-work**.
5.  **Layman Communication**: You MUST communicate with the user in **layman terms**. Avoid unnecessary technical jargon when discussing high-level goals and project status. Ensure the user understands the "What" and the "Why" without needing to parse complex engineering slang.
6.  **Seek the "Why"**: Don't just ask *what* to do. Ask *why* it's being done this way. Ensure the vision of the "Elastic Knowledge Tree" is maintained in every line of code.

### C. The "God Mode" Side Panel
When a node is selected, the side panel must provide:
1.  **Metadata Editor**: Dropdowns for Status, Priority, Domain.
2.  **Codebase Footprint**:
    -   List of files linked to this task.
    -   **Click Action**: Opens file in VS Code (`code -r file.ts`).
3.  **Ralph Insights**:
    -   Scan linked files for `// RALPH:` comments.
    -   Display them as a list of "Key Implementation Details."

---

## 3. Technical Architecture (The "How")

### Stack
-   **Runtime**: Vite (Dev Server) + Node.js (Scripts)
-   **Frontend**: React + Framer Motion (Animation) + SVG (Lines)
-   **Storage**: Markdown Files (Source of Truth) + JSON (Cache/Layout)

### Data Flow
1.  **Init**: `roadmap-server-logic.ts` parses `DOC-REGISTRY.md` -> Generates `roadmap.json`.
2.  **Render**: `RoadmapVisualizer` fetches JSON -> Hydrates MotionValues.
3.  **Interact**: User drags node -> MotionValues update (Physics).
4.  **Save**: User clicks "Save" -> POST `/api/roadmap/layout` -> Writes `layout.json`.
5.  **Inspect**: User opens node detail, including linked docs and implementation insights.

---

## 4. UI/UX Mockup Description

**The HUD (Heads-Up Display)**
-   **Top Center**: "ARALIA CHRONICLES" (Cinzel, Gold Gradient).
-   **Top Right**:
    -   [Filter]: Dropdown (By Domain, By Status, By Assignee).
    -   [Theme]: Toggle (Arcane / Terminal).
    -   [Save]: Disk Icon (flashes when layout is dirty).
-   **Bottom Left**: Minimap (dots representation).
-   **Bottom Right**: Zoom Controls (+ / - / Reset).

**The Graph**
-   **Root Node**: Large, pulsating Gold Sun ("Aralia Chronicles").
-   **Pillar Nodes**: Primary branches for major game domains/features.
-   **Feature/Sub-feature Nodes**: Child branches connected by curved hierarchy lines.
-   **Dependency Lines**: Dashed, red, straight lines connecting distinct branches.

---

## 5. Immediate Next Steps (Ticket Breakdown)

1.  **[TICKET-001] Persistence Layer**:
    -   Create `.agent/roadmap-local/layout.json` (internal, gitignored).
    -   Update `roadmap-server-logic.ts` to merge layout data with registry data.
    -   Implement "Save" button in UI.
2.  **[TICKET-002] Bi-Directional API**:
    -   Deferred in current execution phase (visualizer-only).
    -   Re-evaluate after feature/sub-feature graph and mining workflow stabilize.
3.  **[TICKET-003] Terminal-First Visual Alignment**:
    -   Set Terminal as default presentation.
    -   Keep Arcane as optional toggle (non-default).
    -   Ensure hierarchy readability for Feature -> Sub-feature -> Component trees.
