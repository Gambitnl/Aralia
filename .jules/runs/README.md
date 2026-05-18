# Jules Runs

This folder stores Codex-managed Jules outsourcing manifests and run state.

- `jules-dashboard.json` is the current state read by `.jules/dashboard/index.html`.
- `<run-id>/records.json` stores session IDs and status for one launched run.
- Manifest files should keep task scope narrow, with explicit read scopes, write scopes, forbidden files, and verification commands.

Do not store API keys here. The orchestrator reads `JULES_API_KEY` from the local environment.
