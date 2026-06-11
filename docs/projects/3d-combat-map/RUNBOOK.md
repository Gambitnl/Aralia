# 3D Combat Map Runbook

Status: active
Last updated: 2026-06-10

Use this file for repeatable project checks and safe handoff operations.

## Prerequisites

- Project directory: `docs/projects/3d-combat-map`
- Node + npm available for project scripts.
- Local working tree must include this project folder and any active fixture files
  referenced by tracker tasks.

## Scope Guardrails

- Keep combat-map work in the `docs/projects/3d-combat-map` living docs and avoid
  changing scope outside the combat 3D map surface.
- Do not remove required docs to satisfy audit; add or preserve required docs when
  source evidence justifies them.

## Standard Checks

1. Review the following docs together before any pass:
   - `NORTH_STAR.md`
   - `TRACKER.md`
   - `GAPS.md`
   - `COLD_START_AGENT_PROMPT.md`
   - `DECISIONS.md`
   - `AUDIT_OR_PROOF.md`
2. If docs are edited, verify required-doc accounting against `NORTH_STAR.md`.
3. Run the doc audit and whitespace sanity check.

```powershell
npm run projects:audit
git diff --check
```

## Browser Proof Constraints

- Treat SwiftShader/browser-renderer details as part of any 3D visual proof. Record
  whether the capture used hardware GL, SwiftShader, SwANGLE, or another explicit
  software path when the harness exposes that information.
- Do not depend on Chromium silently falling back to SwiftShader. If a CI or
  headless check needs software rendering, pin the CI image or launch flags in the
  harness and note them in `AUDIT_OR_PROOF.md`.
- Prefer shader-local material/geometry changes over new full-screen postprocess
  passes unless the proof includes a console sweep and the runtime profile is
  documented.
- Do not use visual fallback substitutes for proof. A placeholder scene, alternate
  2D render, simplified renderer, hidden error boundary, or degraded visual mode
  means the visual proof failed unless the task explicitly is to verify the
  diagnostic error/loading message itself.

## Expected Outputs

| Check | Location | Expected state |
|---|---|---|
| `missingDeclaredDocs` for 3D Combat Map | `npm run projects:audit` output | No `missingDeclaredDocs` entries for `docs/projects/3d-combat-map`. |
| Newline/whitespace hygiene | `git diff --check` output | No whitespace-only or end-of-line issues in touched doc files. |

## Failure Handling

| Symptom | Likely cause | Recovery |
|---|---|---|
| `projects:audit` reports `missingDeclaredDocs` for this folder | Declared doc missing | Add the missing file or correct `required_docs` if the declaration is no longer true. |
| `git diff --check` reports whitespace issues | Bad line wrapping/newline style in touched docs | Normalize formatting in the flagged files and rerun checks. |

## Artifact Notes

- Keep durable proof updates in `AUDIT_OR_PROOF.md`.
- Keep temporary run logs and harness outputs outside this project folder unless
  explicitly copied into durable handoff notes.
