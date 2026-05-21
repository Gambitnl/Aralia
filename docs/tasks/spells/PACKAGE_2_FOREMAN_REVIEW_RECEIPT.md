# Package 2 Foreman Review And Failure Classification Receipt

Status: pending Package 2 implementation.

This receipt is the review desk for Codex after Jules returns the premade party
and gear slice. It exists before dispatch so the first Spell Phase 1 Jules PR
has a clear, repeatable review path instead of relying on memory or scattered
terminal notes.

## Current State

- Package 2 Jules handoff exists: `no`
- Package 2 PR or patch exists: `no`
- Scope review complete: `no`
- Local verification complete: `no`
- Failure classification complete: `no`
- Deployment/local-sync evidence applicable: `no`
- Can Package 3 begin from this receipt: `no`

Reason: Package 2 is still blocked on the Jules Environment snapshot receipt.
There is no Jules implementation output to review yet.

## Scope Review Fields

Fill these after Jules returns:

- Jules handoff/session id:
- Package 2 branch:
- Package 2 PR or patch:
- Changed files:
- Files within allowed write scope: `yes` or `no`
- Out-of-scope files, if any:
- Premade identities preserved: `yes`, `no`, or `needs_review`
- Character creator UI touched: `yes` or `no`
- Character sheet spellbook UI touched: `yes` or `no`
- Broad spell schema/runtime architecture touched: `yes` or `no`
- AI arbitration policy touched: `yes` or `no`
- Symphony orchestration files touched: `yes` or `no`

## Verification Fields

Record exact command results:

- `npm run validate:spells`:
- `npm run generate:spell-gates`:
- Combat utility or premade legality test:
- Additional focused checks:
- Visual spellbook or character creator proof claimed by Package 2: `yes` or
  `no`

Package 2 must not claim visual spellbook or character creator proof. If Jules
touches or reports those surfaces, route that as Package 3 follow-up unless the
operator explicitly changes the slice scope.

## Failure Classification

Classify each blocker before deciding repair, feedback, merge, or Package 3
readiness:

- `none`: no blocker remains
- `scope`: Jules changed files or behavior outside Package 2
- `data`: premade JSON, equipment shape, caster legality, or manifest issue
- `runtime`: combat conversion, AC/baseAC, weapon range, or attack behavior
- `test`: missing, weak, or failing local verification
- `spell_gate`: spell validation or gate refresh issue
- `atlas`: Atlas/reporting evidence missing or inconsistent
- `setup`: dependency, install, typecheck, or environment issue
- `decision_boundary`: requires an operator or foreman decision before moving
  forward
- `external`: GitHub, deployment, or other outside-system state

For each blocker, record:

- Blocker:
- Classification:
- Evidence:
- Agent decision:
- Repair path:
- Next proof:

## Review Outcomes

Choose exactly one outcome after review:

- `ready_for_pr_follow_through`: scope and local verification are good enough to
  continue PR/deployment/local-sync tracking.
- `needs_jules_feedback`: Jules should repair within the same Package 2 branch.
- `needs_codex_review_repair`: Codex should use the reserved
  `codex/spells-package2-premade-party-gear-review` branch for a bounded repair.
- `needs_operator_decision`: the blocker is a real scope, product, or workflow
  decision.
- `blocked_do_not_advance`: Package 2 is not safe to advance and Package 3 must
  not begin.

## Rules

- Do not mark Package 2 complete from Jules status alone.
- Do not open Package 3 until this receipt, the Atlas/gate checkpoint receipt,
  and the ROI evidence path all agree that Package 2 is safe to advance.
- Do not silently fold Package 3 UI work, broad spell runtime architecture, or
  AI arbitration policy into this receipt.
- If Codex performs any review repair, record why Jules feedback was not the
  better first repair path.
