# Spell Phase 1 Jules Environment Operator Runbook

Status: completed for Package 2 scoped setup.

This runbook records the manual/browser action used to unblock Package 2. It is
not a replacement for the receipt; the authoritative result lives in
`docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md`.

## Target Page

Open:

```text
https://jules.google.com/repo/github/Gambitnl/Aralia/config
```

Confirm the page shows:

- signed-in account: `Gambit Lebeau (cranenre@gmail.com)`
- repository: `Gambitnl/Aralia`
- section: `Setup script`
- button: `Run and snapshot`

## Script Attempted First

This broad setup script was attempted first:

```bash
npm ci --no-audit --no-fund
npm run typecheck
npm run validate:spells
```

It failed during `npm run typecheck` in the Jules clean clone because broad
repo-wide typecheck depends on local untracked/generated TypeScript modules that
are not present in the tracked clone.

## Package 2 Scoped Script That Passed

This script was then pasted into the setup textbox:

```bash
npm ci --no-audit --no-fund
npm run validate:spells
npx vitest run src/utils/combat/__tests__/combatUtils_*.test.ts --reporter=verbose
```

Then `Run and snapshot` was clicked. The scoped run completed `npm ci`, spell
validation, and 6 split combat utility test files with 37 tests passing, then
exported environment state.

## Record The Result

After Jules finishes, update or verify
`docs/tasks/spells/SPELL_PHASE_1_JULES_ENVIRONMENT_SNAPSHOT_RECEIPT.md`:

- set `Receipt status` to `passed`, `failed`, or `waived`
- set `Jules Environment page action performed` to `yes`
- set `Snapshot result` to the visible result summary
- set `Script used` to the exact script that ran
- set `Result captured by` and `Captured at`
- add the evidence link, screenshot path, or copied output
- set `Can Package 2 dispatch after this receipt` to `yes` only if the setup
  result proves the Package 2 verification commands can run

## If `npm ci` Fails In A Future Slice

Do not silently switch to the fallback. Record the failure in the receipt first.

Only use the diagnostic fallback after a deliberate decision entry explains why
`npm ci` is impossible for this snapshot:

```bash
npm install --no-audit --no-fund
npm run typecheck
npm run validate:spells
```

The fallback can change lockfile state in the Jules working copy, so it is not
equivalent to a clean setup snapshot.
