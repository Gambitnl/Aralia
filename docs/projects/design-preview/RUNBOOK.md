# Design Preview Runbook

Status: active
Last updated: 2026-06-22

This runbook captures the minimum manual checks for the standalone Design
Preview surface. It is the durable proof path for the checklist gap that used
to live in G2.

## Manual Checklist

1. Open `misc/design.html` in a local dev server.
2. Change the active step with the `step` query or the header lane buttons and
   confirm the preview pane changes with it.
3. Switch at least one style variant and confirm the variant label and live
   marker update together.
4. Open, report, and stop the local visualizer controls against
   `localhost:3847`.
5. Capture one browser screenshot or render note for the lane being reviewed.

## Proof Target

Use this checklist when a future visual pass is required. If a check cannot be
completed, record the blocked surface and the next visual verification step in
the current project handoff.

## Scenario Parent Route

For Tactical Sandbox / Combat Scenarios work, start from
`docs/projects/design-preview-scenarios/RUNBOOK.md` and verify the runtime at
`misc/design.html?step=scenarios`. This broad runbook remains the checklist for
the overall Design Preview page.
