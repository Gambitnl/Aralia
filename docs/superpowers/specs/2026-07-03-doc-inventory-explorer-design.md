# Doc Inventory & Task-Harvest — Design

- **Date:** 2026-07-03 (rev 2026-07-04)
- **Status:** Approved (design); implementation not started
- **Host:** Doc Library tool (`md_library.html` → `PreviewMdLibrary.tsx`, backend `scripts/vite-plugins/devHubApiManager.ts`); plan-map (`public/planmap/index.html`) for Feature C
- **Author:** Remy + Claude

## Problem

There are ~5,982 project `.md` files (filesystem count; the Doc Library's `/api/docs/list` indexes 5,404). Remy needs a clear picture of what exists in order to (a) harvest still-open tasks out of old plan docs into the roadmap, and (b) retire stale/redundant docs — **without ever retiring a doc that an app or dashboard actually consumes** (e.g. the grill-prompt content, spell/race reference docs loaded at runtime via templated paths like `${spellId}.md`).

The Doc Library today shows a flat, searchable list with category/status filters and an editor + safe-delete flow. It has no folder-tree, no signal for which docs code consumes, no duplicate detection, and no "dead/unused" confidence model.

This work is **three sibling features**. A is the foundation; B and C depend on it / sit beside it.

## Feature A — Doc Inventory Explorer

### Goals
1. A collapsible **folder-tree** of every `.md`, browsable in the Doc Library.
2. A per-doc **"dead/unused" confidence model** built from the four signal bundles below — never single-signal.
3. **Duplicate-content** grouping surfaced as a badge/filter.
4. Per-doc **role** from the Atlas classifier, **content-age**, and **open-task count** badges.
5. **Filters** stacking on existing search/category/status: consumed = used/unused/all; role = plan/all; duplicate = only-dupes/all; confidence = candidate/all.
6. A headline count driving the work, e.g. *"128 plan docs · 40 unused · 22 with open tasks."*

### The four signal bundles (all computed)

**1. Consumption — "is anything reading it?"**
- Static literal code references (exact relative-path, or unambiguous basename).
- Templated/glob code references → mark the **literal directory prefix** consumed (so `docs/…/${spellId}.md` flags the whole dir; live docs never read as unused).
- **Path appears in a data/config file** (`*.json`, `*.yaml`, manifests under the scan roots) — catches runtime-constructed paths.
- Referenced in a **build entry** (`vite.config.ts`, `.claude/launch.json`, an `.html` entry).

**2. Linkage — "is anything pointing at it?"**
- Inbound links from other `.md` (markdown `[..](path)` + wikilinks `[[..]]`). Zero inbound = orphan.
- Membership in a registry/index doc (`@DOC-REGISTRY.md`, `MEMORY.md`, `SUBPROJECTS.md`, README tables).

**3. Recency + content — "is it maintained / is there anything in it?"**
- **Git last-content-commit age** (via `git log -1 --format=%ct -- <path>`) — ignores the 2 a.m. snapshot; the honest staleness axis. Raw mtime kept as a weak secondary.
- Empty / near-empty stub (word-count threshold).
- Duplicate content (identical hash to another doc).
- Explicit "superseded by X" / "see X instead" pointer in the body.

**4. Lifecycle + open-tasks — "has it been marked / is its job done?"**
- Frontmatter `status: done/retired/archived`; the `~.md` retired-rename convention; membership in the backlog-retirement ledger.
- **Open-task count**: unchecked `- [ ]` items (and "Status: open/active" task rows) in the doc. Drives Feature B.

### Confidence model (how the signals combine)
A doc is a **retirement candidate** only when **not consumed (bundle 1)** AND (**orphaned (bundle 2)** OR **git-stale (bundle 3)**). Empty / duplicate / superseded are **instant** candidates. A lifecycle marker or ledger entry is **authoritative** (candidate regardless). The UI shows the *reasons*, never a bare verdict. Single-signal "unused" is displayed but tagged low-confidence.

### Role source — Atlas `docRole`, NO fallback
Role (`plan`/`reference`/`tracker`/…) comes from the Atlas knowledge-tree export (`/api/atlas/knowledge-tree`, field `docRole`; `plan` already = 128). If the Atlas export is missing, stale, or a doc is unclassified, the tool **fails loudly with a clear error** ("Atlas export unavailable / doc unclassified — run `npm run atlas -- reconcile`") and does **not** silently guess from the path. (Per Remy's no-fallback directive.)

### Unit A1 — Backend scanner (`/api/docs/usage`, cached)
New endpoint in `devHubApiManager.ts`. One pass:
- Enumerate the same docs as `/api/docs/list`; read each once → content hash (duplicates) + word-count (empty) + open-task count + superseded-pointer + inbound-link targets + frontmatter status.
- Scan code/data/build files (`*.{ts,tsx,js,jsx,html,json,yaml,yml}` under `src`, `misc`, `scripts`, `public`, `devtools`; exclude `node_modules`, tests) → literal + templated-dir + data/config references.
- Shell out to `git log` for last-content-commit per doc (batched).
- Join the Atlas `docRole` map (error if absent).
- Output per doc: `{ path, consumedBy[], consumedVia, contentHash, duplicateGroupId, role, ageDays, gitAgeDays, wordCount, openTaskCount, inboundLinks, lifecycle, supersededBy, candidate: {isCandidate, reasons[], confidence} }` plus `diagnostics{ ambiguousRefs, unresolvedRefs, atlasMissing }`.
- Cached in-memory; `?refresh=1` (Rescan button) recomputes.

### Unit A2 — Frontend (`PreviewMdLibrary.tsx`)
Additive to the existing list/editor/delete flow.
- Layout toggle: flat list ↔ **folder-tree** (collapsible dirs with counts; leaves = docs), built client-side from `path`.
- On mount, fetch `/api/docs/usage` alongside `/api/docs/list`; merge by `path`.
- Per-doc badges: role, content-age (prefer git-age), consumed-by-app chips (or muted "unused"), duplicate "dupe ×N", open-tasks "N open", candidate flag with reason tooltip.
- New filters (stack on search/category/status): consumed, role, duplicate, confidence.
- Headline bar with live counts. Rescan button. Diagnostics disclosure (ambiguous/unresolved/atlas-missing).

## Feature B — Task Harvest (follow-on spec, depends on A)

Not "migrate the doc." For each `role=plan` doc with `openTaskCount > 0`: **extract the still-open tasks**, **bucket** them by domain or task-type, add each as a **tile placed in the correct position of the roadmap's sequential implementation flow** (`public/planmap/topics.json`), and **deprecate the spent remainder** of the doc (mark/retire — never hard-delete, per Remy's data rule). A surfaces the candidates (`role=plan & openTaskCount>0`); B defines extraction, bucketing taxonomy, roadmap placement, and deprecation mechanics. Its own spec.

## Feature C — Smart doc-tool buttons on the plan-map

Plan-map header links (added 2026-07-03: 🗺️ Doc atlas, 📚 Doc library) become **poll-then-start** launchers, reusing the existing launcher pattern (`/api/devhub/start`, `/api/roadmap/start`, `*/status` in `devHubLauncherManager.ts` / `roadmapManagers.ts`, which `spawn` detached `npm run dev*`):
- On click: HEAD-poll the tool URL (relative to the plan-map origin). If reachable → open. If not → POST the matching start endpoint, poll until the server answers, then open. Keep the **relative** href as the middle-click/degraded fallback, plus a **tooltip port hint**.
- Caveat: the launcher API and `misc/` entries exist only on full dev servers (main/devhub), not the static planmap-only server. When the plan-map is viewed there, buttons fall back to the relative href (which 404s on that static server) — documented in the tooltip.

## Edge cases & safety
- **False-negative avoidance is the priority.** Dir-prefix consumption is inclusive; the "unused" bucket errs toward under-listing, never over-listing. Retirement acts on candidates, so being conservative protects live docs.
- Diagnostics surface where detection was uncertain (`ambiguousRefs`, `unresolvedRefs`, `atlasMissing`).
- Docs outside the scan roots (`.agent/**`) are still inventoried; they correctly tend to show `unused`.

## Testing
- **Backend unit tests** for the reference classifier (literal exact/basename-unique/basename-ambiguous, templated→dir-prefix, `*.md` unresolved, data/config JSON ref, build-entry ref), the confidence combiner (each reason path), open-task counting, duplicate grouping, superseded-pointer, and the **atlas-missing → loud error** path.
- **Frontend:** tree-build from a flat path list; stacked-filter counts (unused + plan + has-open-tasks).
- **Live eyeball** (Remy's visual-inspection rule): Doc Library tree renders; spell/race dirs show consumed (not unused); headline counts sane; a plan doc with open checkboxes shows its open-task count.

## Sequencing
A first (foundation) → B (task harvest, needs A's open-task + role data) and C (launcher buttons, independent, small) in parallel after.
