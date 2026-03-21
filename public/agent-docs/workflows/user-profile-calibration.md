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
2. Existing local profile file: `.agent/workflows/USER.local.md`.
3. Current task context (what the user was trying to accomplish).

## Execution

1. Update the profile only when the session surfaced something materially useful.
2. Distinguish between:
   - user cognition/style
   - trust/process preferences
   - project philosophy that reveals reasoning style
3. Record evidence for new claims.
4. Ask concise clarification questions only when they improve the profile; do not force intake-form behavior.
5. Mark uncertain items as `hypothesis` instead of asserting them as settled facts.
6. Keep the profile concise enough to remain readable and usable.

## Required Output Block

- `User Profile Calibration: yes|no (with reason)`
- `Profile File: .agent/workflows/USER.local.md`
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
