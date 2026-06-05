# Project Verification Indicator Schema

Status: active
Last updated: 2026-06-04

This file captures the first dashboard-facing verification vocabulary discovered
from existing Aralia project docs. Project `Dashboard Card Schema` sections use
this vocabulary for required and completed verification fields.

## Discovered Verification Types

| Token | Type | Evidence seen in project docs | Typical proof source |
|---|---|---|---|
| T | scoped_tests | Unit, integration, or focused test runs | TRACKER.md next proof/check, AUDIT_OR_PROOF.md |
| B | build_typecheck | TypeScript, build, lint, or quality gates | AUDIT_OR_PROOF.md proof summary |
| V | visual_browser | Browser, screenshot, Playwright, visual inspection, replay | AUDIT_OR_PROOF.md promoted evidence |
| M | manual_flow | Manual smoke flow or operator acceptance check | TRACKER.md evidence, AUDIT_OR_PROOF.md |
| D | docs_consistency | Re-read project docs, registry, tracker/gaps for agreement | TRACKER.md next check/proof |

## Dashboard Schema Shape

```json
{
  "verification": {
    "required": ["scoped_tests", "visual_browser"],
    "completed": ["scoped_tests"],
    "missing": ["visual_browser"],
    "lastProofDate": "2026-06-04",
    "source": "docs/projects/<slug>/AUDIT_OR_PROOF.md"
  }
}
```

## Rules Before Dashboard Icons

1. Verification indicators should come from explicit project proof entries or
   explicit `Dashboard Card Schema` fields, not
   filesystem modification time.
2. AUDIT_OR_PROOF.md is the preferred durable source for completed checks.
3. TRACKER.md and NORTH_STAR.md may define required verification for the active
   task.
4. Missing verification should show as missing proof, not as task failure, until
   the active task claims completion.
5. Visual/browser proof must remain empirical: screenshot, rendered inspection,
   deterministic replay, or captured observable output.
