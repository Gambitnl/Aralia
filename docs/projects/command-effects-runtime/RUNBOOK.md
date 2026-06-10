# Command Effects Runtime Runbook

Status: review-required
Last updated: 2026-06-09

## Resume Steps

1. Read `NORTH_STAR.md` for current ownership and dashboard status.
2. Read `TRACKER.md` for the active T2 queue.
3. Read `GAPS.md` before choosing work; G1 is now review-required and must be answered before any implementation resumes.
4. Check `DECISIONS.md` before changing movement or teleport command routing.
5. Check `AUDIT_OR_PROOF.md` for the latest focused test evidence.

## Verification

- Run focused Vitest files for the command/factory path touched.
- Run `node scripts/audit-living-project-docs.cjs` and confirm the `command-effects-runtime` row is valid.
- Run `git diff --check` on touched files before closeout.
- If exported signatures or broad hook/state surfaces change, run the dependency sync command named in `AGENTS.md`.

## Notes

G2 and G4 are closed. Do not reopen teleport budget or teleport factory routing
without new evidence. The next safe implementation pass is G1:
`ReactiveEffectCommand` can only advance after the delegated payload source-of-truth is decided and recorded in the Required Review Brief.
