# GAPS: Scripts: Archive

Status: active
Last updated: 2026-06-05

## Gap Log

| Gap ID | Gap | Classification | Owner | Evidence | Next action | Next proof | Status |
|---|---|---|---|---|---|---|---|
| SARCH-001 | Retired archive scripts are not represented in active tooling registry metadata, so later reuse intent may still be unclear. | blocked_human_decision | Worker C | `docs/projects/scripts-archive/NORTH_STAR.md` and `docs/projects/scripts-archive/TRACKER.md` still leave the tombstone policy unresolved | Decide whether retired archive scripts need a tombstone bucket or an explicit no-registry policy. | A durable policy note is added in the project docs. | open |
| SARCH-002 | Temporary auth/session inputs for one-time retrieval runs still need a direct project-level cleanup check, even though the temp auth file was absent on the latest pass. | support_needed_now | Worker C | `Test-Path .agent/roadmap-local/spell-validation/dndbeyond-auth.json` returned `False` on 2026-06-05 | Keep the manual cleanup check in the tracker and note any reappearance of the auth artifact immediately. | Re-run the same `Test-Path` check during the next archive pass. | open |
