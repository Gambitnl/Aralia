# Jules & Gemini: Collaborative Workflow Guide

This document outlines the established workflow for using the Gemini CLI agent in tandem with Google's Jules (asynchronous coding agent) to efficiently manage software engineering tasks in the Aralia project.

## 1. Architecture Overview

*   **Gemini CLI:** The "Orchestrator." Analyzes requirements, breaks down tasks, initiates Jules sessions, and reviews code.
*   **Jules:** The "Worker." executing coding tasks asynchronously in parallel sessions.
*   **The Bridge:** A local script (`scripts/watch_jules.cjs`) that monitors Jules task statuses and alerts the user/agent when attention is needed.
*   **GitHub:** The source of truth and collaboration platform.

## 2. Task Initiation

When identifying a complex task (e.g., from a `TODO` file), the Gemini Agent should:

1.  **Break it down:** Identify independent units of work that can run in parallel.
2.  **Launch Sessions:** Use `jules new --repo <owner/repo> "<Detailed Instruction>"` for each unit.
3.  **Avoid Conflicts:** Do not launch multiple tasks that touch the same files simultaneously unless they are strictly additive.

## 3. Monitoring Progress ("The Bridge")

Since the Gemini CLI is request-response based, it cannot background-poll. We use a separate monitor:

1.  **Launch Monitor:** Run `node scripts/watch_jules.cjs` in a separate terminal window.
    *   *Note:* This script exits (`process.exit(0)`) upon detecting *any* status change (e.g., `In Progress` -> `Complete` or `Input Required`).
2.  **Agent Action:** When the monitor exits, the user informs the Agent, who then checks `jules remote list --session`.

## 4. Review & Feedback Workflows

We support two distinct workflows depending on the task stage.

### Workflow A: The "GitHub Native" Loop (Preferred for Features)
*Best for: New features, complex logic, and tasks requiring persistent history.*

1.  **Task Completion:** Jules marks the task as `Complete`.
2.  **Publish:** The User (via Jules Web UI) clicks "Publish" to open a Pull Request.
3.  **Review:** The Agent checks out the PR branch locally (`gh pr checkout <id>`) to run tests/linters.
4.  **Feedback:** The Agent/User comments **directly on the GitHub PR**.
    *   *Mechanism:* Jules monitors the PR. It sees comments and pushes new commits to address feedback.
    *   *Configuration:* Ensure Jules is in "Normal" mode (reads all comments) or "Reactive" mode (reads only mentions of `@google-jules`).
5.  **Merge:** Once satisfied, merge via GitHub.

### Workflow B: The "Quick Iteration" Loop (Preferred for Fixes)
*Best for: Small bug fixes, or when task limits are tight.*

1.  **Task Completion:** Jules marks the task as `Complete`.
2.  **Local Review:** Agent runs `jules remote pull --session <ID>` (without `--apply`) to inspect the diff.
3.  **Feedback:** User provides feedback directly in the **Jules Web UI** chat.
    *   *Why:* The CLI cannot "reply" to a completed session. Using `jules new` for feedback consumes an extra daily task quota.
4.  **Iterate:** Jules updates the session.
5.  **Apply:** Agent runs `jules remote pull --session <ID> --apply` to merge changes locally.
6.  **Commit:** Agent commits and pushes to `master`.

## 5. Handling Local State

*   **Stashing:** If reviewing multiple concurrent tasks locally, **always stash** (`git stash push -m "WIP: <Task Name>"`) before switching contexts or pulling a different session.
*   **Clean Slate:** Ensure the working directory is clean before applying a Jules patch to avoid "file already exists" conflicts.

## 6. Troubleshooting

*   **"Already exists in working directory":** Occurs when applying a patch that creates a file which is already present (e.g., from a previous failed patch attempt). *Solution:* Delete the local file and re-apply.
*   **Missing Props/Breaking Changes:** Jules may update a definition (e.g., adding a prop to a Hook) but miss updating consumers if they weren't part of the context. *Solution:* Catch this in Review (Workflow A or B) and explicitly instruct Jules to "Search for all usages of X and update them."

---
*Reference:* `scripts/watch_jules.cjs`
