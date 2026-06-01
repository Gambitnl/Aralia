---
description: Maintain a local, evidence-based user profile by converting observations into validated operating rules.
---

# /user-profile-calibration Workflow

This workflow keeps a local user profile accurate without drifting into unverified personality claims.
It should refine the profile when the session reveals meaningful signal, not force a questionnaire every run.

## Mission

1. Capture meaningful observations from the current session.
2. Surface hidden assumptions only where they matter.
3. Use direct drill-down questions when they clarify motive, trust, or reasoning style.
4. Promote only validated items into the profile.
5. Preserve uncertainty explicitly when evidence is incomplete.

## Required Inputs

1. Session conversation history (primary evidence source).
2. Existing local profile file: `.agent/workflows/USER.local.md`, when present.
3. Current task context (what the user was trying to accomplish).

## Execution

1. Update the profile only when the session surfaced something materially useful.
2. Treat `.agent/workflows/USER.local.md` as local-only ignored state, not a tracked workflow doc.
3. If the profile file is missing, report `User Profile Calibration: no (profile file absent)` and do not block tidy-up.
4. Create or edit that local file only when the active session produced meaningful validated signal.
5. Distinguish between:
   - user cognition/style
   - trust/process preferences
   - project philosophy that reveals reasoning style
6. Record evidence for new claims.
7. Ask concise clarification questions only when they improve the profile; do not force intake-form behavior.
8. Mark uncertain items as `hypothesis` instead of asserting them as settled facts.
9. Keep the profile concise enough to remain readable and usable.

## Required Output Block

- `User Profile Calibration: yes|no (with reason)`
- `Profile File: .agent/workflows/USER.local.md (present|absent)`
- `New Observations Logged: <count>`
- `Profile Areas Updated: cognition|trust|process|project-philosophy|none`
- `Assumptions Tested: <list or none>`
- `Questions Asked: <list or none>`
- `Confirmed Rules Added: <list or none>`
- `Rejected/Invalidated Assumptions: <list or none>`
- `Unresolved Hypotheses: <list or none>`
- `Confidence Distribution: high=<n>, medium=<n>, low=<n>`
- `Open Follow-ups: <list or none>`

If this block is missing, calibration is incomplete.
