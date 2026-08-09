# Testkit: smoke

Sweep the key surfaces: navigate, wait for ready, count console errors,
screenshot. Edit this table to add or retire surfaces.

| # | Surface | URL / route | Ready signal |
|---|---------|-------------|--------------|
| 1 | atlas | `?phase=worldforge` | atlas SVG rendered (states/burgs visible) |
| 2 | spawnpreview | `?phase=spawnpreview` | preview map visible |
| 3 | world3d | `?phase=world3d` | 3D canvas rendered (rAF readback if screenshot hangs) |
| 4 | agentsim | `?phase=agentsim` | commuters moving |
| 5 | pixiboard | `?dummy=1&dev_combat=1&pixiboard=1` — open in a FRESH page/context; `dev_combat` entry is one-shot per session state | Pixi canvas visible |
| 6 | dungeon | `/misc/design.html?step=dungeon` (PreviewDungeon — gitignored, on disk only) | sheet rendered |
| 7 | combat | `?dummy=1&dev_combat=1` — fresh page/context, same one-shot caveat | combat HUD visible |

## Per surface

1. Before the first browser navigation, choose a source file relevant to this
   smoke run and execute the SKILL.md WF-G30 probe against the resolved server
   port. Stop on `LIVENESS_FAILURE` or `FRESHNESS_FAILURE`; do not create a PNG.
   When using `tools/vistest/shoot.ts`, pass that path through its required
   `--fresh-module` flag so the command enforces the same preflight itself.
2. `navigate_page` to the URL; `wait_for` the ready signal (10 s budget —
   longer for world3d first load).
3. `list_console_messages`; count messages at error level. Record the count
   and the first error verbatim if any.
4. Dismiss any blocking modal or overlay (e.g. the Ollama Dependency dialog) before capturing, and record which modals you dismissed.
5. `take_screenshot` (fallback per SKILL.md ground rule 3). Save to
   `.agent/testkit/shots/<surface>.png`.
6. Mark pass/fail: fail = freshness gate failed, OR ready signal never appeared, OR any console error,
   OR no screenshot captured.

## Output

1. A pass/fail table (surface, errors, first error, screenshot path).
2. Send ALL screenshots to the user — they eyeball every visual surface;
   numbers alone never pass a surface.
3. Write consoleErrors per surface into the run JSON at
   `.agent/testkit/last-smoke.json`, run
   `node tools/testkit/baseline.mjs .agent/testkit/last-smoke.json`, and
   include the diff output in the report.
4. If a surface fails, offer to switch to `workflows/troubleshoot.md` on it.
