# Jules & Gemini: Collaborative Workflow Guide

This document outlines the established workflow for using the Gemini CLI agent in tandem with Google's Jules (asynchronous coding agent) to efficiently manage software engineering tasks in the Aralia project.

## 1. Architecture Overview

*   **Gemini CLI:** The "Orchestrator." Analyzes requirements, defines precise prompt instructions, launches Jules sessions, and performs final conflict resolution on high-level documentation.
*   **Jules:** The "Worker." Executes coding and documentation tasks asynchronously in parallel sessions. Responsible for implementation and testing.
*   **GitHub:** The source of truth and collaboration platform.

## 2. The "Strict Instruction" Protocol

Jules requires precise, unambiguous instructions. "High-level concepts" lead to drift.

**Every `jules new` command issued by Gemini MUST contain the following structured payload:**

1.  **MISSION**: A single sentence defining the goal.
2.  **REQUIRED READING**: A strict list of file paths Jules MUST read before starting.
3.  **EXECUTION STEPS**: A numbered, step-by-step procedure.
    *   *Example:* "1. Create file X. 2. Add function Y. 3. Run test Z."
4.  **CONSTRAINTS**: What Jules is NOT allowed to do (e.g., "Do not modify `constants.ts`").
5.  **DELIVERABLE**: The exact expected output (e.g., "A PR containing the new component and passing tests").

## 3. The Workflow (GitHub Native)

We use a single, unified workflow for all tasks.

### Phase 1: Initiation (Gemini)
1.  **Analysis:** Gemini analyzes the high-level goal (e.g., "Documentation Cleanup").
2.  **Partitioning:** Gemini breaks the goal into parallelizable units to avoid file conflicts.
    *   *Example:* "Jules A handles `docs/guides/`, Jules B handles `docs/spells/`."
3.  **Launch:** Gemini constructs the **Strict Instruction** prompt and launches the session:
    ```bash
    jules new --repo user/repo "MISSION: ... REQUIRED READING: ... STEPS: ..."
    ```

### Phase 2: Execution & Review (Jules)
1.  **Implementation:** Jules reads the context and executes the steps.
2.  **Self-Correction:** Jules runs relevant tests/linters to verify its own work.
3.  **Publish:** Jules marks the task "Complete" and prompts the user to "Publish" a Pull Request.

### Phase 3: Integration (Gemini & User)
1.  **PR Creation:** The user publishes the PR via the Jules UI.
2.  **High-Level Conflict Resolution:**
    *   Jules agents running in parallel may conflict on shared "Registry" or "Index" files (e.g., `@DOC-REGISTRY.md`).
    *   **Gemini's Role:** Gemini reviews these specific conflicts during the PR merge process. We do NOT ask Jules to resolve complex merge conflicts on high-traffic files; Gemini handles the final stitch.
3.  **Final Merge:** The PR is merged into the main branch.

## 4. Documentation Specifics

When using Jules for documentation refactoring:

*   **Parallelism:** Assign Jules agents to disjoint sets of files (e.g., by folder).
*   **Feedback Loop:** For subjective tasks (e.g., "Consolidate these docs"), instruct Jules to:
    1.  Read the source files.
    2.  Draft the new content in a **temporary file** (e.g., `docs/temp_consolidation_draft.md`).
    3.  Wait for PR review before deleting the originals.
*   **The Registry Rule:** Instruct Jules **NOT** to update `@DOC-REGISTRY.md` or `@ACTIVE-DOCS.md` if multiple agents are running. Gemini will update these central files after merging the individual PRs to prevent constant merge conflicts.

---
*Note: This workflow maximizes Jules's parallel throughput while minimizing the "too many cooks" problem on central project files.*
