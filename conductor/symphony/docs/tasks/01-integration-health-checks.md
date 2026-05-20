# Task 01: Integration Health Checks

## Status

Completed.

## Purpose

Add lightweight "are you up?" checks for Symphony, Linear, and Jules so the dashboard can show connection readiness without creating a task, creating a Linear issue, writing `.jules` files, launching Jules, or starting any worker.

## Current Boundary

Clean-Git dashboard intake has been proven. The next workflow boundary is Linear issue creation, but this task should not cross that boundary. This task only adds or verifies read-only health/status checks.

## Read First

- `AGENTS.md`
- `conductor/symphony/JULES_MIDDLEMAN_AUDIT.md`
- `conductor/symphony/docs/JULES_MIDDLEMAN_OPERATING_SPEC.md`
- `conductor/symphony/docs/SYMPHONY_MIDDLEMAN_ARCHITECTURE.md`
- `conductor/symphony/src/server.ts`
- `conductor/symphony/src/linear-client.ts`
- `conductor/symphony/src/task-intake.ts`
- `conductor/symphony/public/dashboard.js`
- `conductor/symphony/public/dashboard.html`
- `conductor/symphony/public/dashboard.css`

## Requirements

1. Add a read-only API endpoint, recommended shape:
   - `GET /api/v1/integrations/status`
2. The endpoint must report Symphony API status and dispatch state.
3. The endpoint must report Linear readiness without creating an issue or polling candidate work.
4. The endpoint must report Jules local readiness without launching a Jules session.
5. Every integration status packet must include explicit safety flags:
   - `mutatesExternalSystems: false`
   - `mutatesLocalFiles: false`
   - `startsWorker: false`
   - `createsTask: false`
6. Add a compact dashboard panel or status row for the checks.
7. Add focused verifier coverage for the endpoint and dashboard rendering.

## Suggested Shape

The response can look like this, but adapt to existing Symphony types:

```json
{
  "symphony": {
    "status": "up",
    "dispatch": "paused"
  },
  "linear": {
    "status": "ok | missing_config | auth_failed | unreachable | project_missing | unknown",
    "checkedAt": "2026-05-19T00:00:00.000Z",
    "mutatesExternalSystems": false
  },
  "jules": {
    "status": "ready | missing_cli | missing_manifest_support | unknown",
    "checkedAt": "2026-05-19T00:00:00.000Z",
    "mutatesLocalFiles": false
  },
  "safety": {
    "createsTask": false,
    "startsWorker": false,
    "mutatesExternalSystems": false,
    "mutatesLocalFiles": false
  }
}
```

## Linear Guidance

Use the cheapest read-only check possible. Prefer configuration checks plus a minimal authenticated GraphQL query such as `viewer { id name }`. If project readiness is included, use a tiny project lookup by configured slug. Do not call issue creation, task intake, candidate issue polling, or terminal issue cleanup for this health endpoint.

## Jules Guidance

Start with local readiness:

- `.jules/orchestrator/cli.ts` exists when launch support is expected.
- Required manifest staging paths can be derived.
- Launch/status commands can be constructed.

If there is no cheap, read-only Jules cloud ping, report `cloudStatus: "not_checked"` or similar instead of pretending cloud readiness was proven.

## Acceptance Criteria

- Dashboard can answer "is Symphony/Linear/Jules up?" from a refresh button or auto-refresh state.
- Health checks do not create drafts, create Linear issues, write `.jules` files, launch Jules, enable dispatch, or start workers.
- Missing config and auth/network failures are human-readable.
- The endpoint works in dashboard-only mode.
- Verifiers prove both healthy/mocked-ready and missing-config states.
- Documentation mentions the endpoint and its non-mutating guarantees.

## Response

Implemented the complete read-only integration health checks feature, satisfying all core requirements and acceptance criteria.

- Summary:
  - Created the `GET /api/v1/integrations/status` endpoint in `HttpServer` (`src/server.ts`).
  - Added robust server-side caching (30 seconds) to prevent spamming APIs (Linear viewer GraphQL query) and the filesystem (`fs.stat`) on auto-refresh poll loops.
  - Supported cache-bypass using a `?force=true` query parameter for manual refresh operations.
  - Wired manual dashboard refresh in `public/dashboard.js` to append `?force=true` to guarantee fresh connectivity and validation.
  - Provided fully complete safety flags (`createsTask: false`, `startsWorker: false`, `mutatesExternalSystems: false`, `mutatesLocalFiles: false`) on every single integration status packet (`symphony`, `linear`, `jules`, `safety`).
  - Resolved routing duplicate registration inside `server.ts`.
  - Expanded the verifier script `verify-integration-health.mjs` to spin up Symphony under BOTH healthy/mocked-ready state and a temporary missing-config state, asserting correct error reporting and absolute preservation of safety guarantees.
  - Documented the endpoint, safety constraints, and caching behavior in `SYMPHONY_MIDDLEMAN_ARCHITECTURE.md` and `JULES_MIDDLEMAN_OPERATING_SPEC.md`.

- Files changed:
  - `conductor/symphony/src/server.ts`
  - `conductor/symphony/public/dashboard.js`
  - `conductor/symphony/scripts/verify-integration-health.mjs`
  - `conductor/symphony/docs/SYMPHONY_MIDDLEMAN_ARCHITECTURE.md`
  - `conductor/symphony/docs/JULES_MIDDLEMAN_OPERATING_SPEC.md`

- Commands run:
  - `npm run build`
  - `node scripts/verify-integration-health.mjs`
  - `npm run verify:jules-contract`

- Verification:
  - Built and compiled TypeScript code with zero errors.
  - Executed `verify-integration-health.mjs` which successfully verified both healthy mock paths and unconfigured missing-config paths.
  - Executed the full contract suite `npm run verify:jules-contract` and all 50+ contract tests passed successfully.

- Current status:
  - Completed.

- Remaining blockers:
  - None.

- Proof artifacts:
  - Automated verifier output for `verify-integration-health.mjs` (both healthy mock and missing config).
