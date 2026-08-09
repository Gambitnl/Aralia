---
name: agora-coordination
description: Use when multiple agents may be working the shared Aralia checkout concurrently — register presence, lock files before editing, claim/post tasks, and message other agents via the local Agora daemon to avoid clobbering each other.
---

# Agora Coordination

Agents share one working tree (`F:\Repos\Aralia`) and otherwise clobber each other — most
destructively via `git reset --hard` / `git checkout`. **Agora** is a local daemon
(`http://localhost:4319`) that coordinates presence, advisory file locks, a task board, and
messaging. Locks are honor-system, so checking in is everything.

Full step-by-step for a **single agent**: **[`tools/agora/AGENT.md`](../../../tools/agora/AGENT.md)**
(identity-first, the working loop, hard rules). Full API + etiquette:
**[`tools/agora/PROTOCOL.md`](../../../tools/agora/PROTOCOL.md)**.
If you are an **orchestrator** dispatching a fleet (not a single worker), read
**[`tools/agora/ORCHESTRATOR.md`](../../../tools/agora/ORCHESTRATOR.md)** for the campaign loop
(partition → disjoint packets → lock-before-edit → verify-gate) and the agent matrix.

## The minimal loop

> **Fresh agent shortcut:** `AGORA_AGENT_ID=<handle> node tools/agora/client.mjs onboard <handle> --note "<scope>"`
> does steps 1–3 in one shot and prints peers, locks, the ready task queue, and the rules.
> Export `AGORA_AGENT_ID=<unique handle>` for EVERY client.mjs call — it scopes your stored
> identity so `unlock --mine` can't release another agent's locks from this shared checkout.

1. **Is it up?** `curl -s http://localhost:4319/health` — `"ok": true` means yes.
   If connection is refused, **start it:** `npm run agora` (run in background; runtime state
   lives in `.agent/agora/`, which is gitignored).

2. **Register** — capture your token (all writes need it):
   ```bash
   TOKEN=$(curl -s -X POST http://localhost:4319/agents/register \
     -H 'Content-Type: application/json' -d '{"handle":"claude-A"}' | \
     node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
   ```

3. **Before any risky git op** (`git reset --hard`, `checkout`, `stash`), check who/what is
   active and **stop if someone else holds locks or is online**:
   ```bash
   curl -s http://localhost:4319/locks
   curl -s http://localhost:4319/agents
   ```

4. **Lock shared files BEFORE editing.** `201` = yours; `409` = someone owns it (back off /
   coordinate):
   ```bash
   curl -s -X POST http://localhost:4319/locks \
     -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"paths":["src/foo.ts"],"globs":["src/components/Bar/**"],"reason":"refactor"}'
   ```

5. **Announce / coordinate** — post a task for non-trivial work, or broadcast a note:
   ```bash
   curl -s -X POST http://localhost:4319/messages \
     -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
     -d '{"to":"all","body":"editing src/foo.ts — please hold off"}'
   curl -s "http://localhost:4319/messages?since=0&to=all"   # poll for replies
   ```

6. **Release on done** — free locks and mark tasks done; don't sit on locks (they
   default-expire in 30 min, but release early):
   ```bash
   curl -s -X DELETE http://localhost:4319/locks/<lockId> -H "Authorization: Bearer $TOKEN"
   ```

## Key endpoints

| Need | Call |
|---|---|
| Up-check | `GET /health` |
| Register | `POST /agents/register {handle}` → `{token}` |
| Who's here | `GET /agents` |
| Lock | `POST /locks {paths?,globs?,reason?,ttlMs?}` → `201` or `409 {conflict}` |
| Release | `DELETE /locks/:id` (holder only; `?force=1` if the holder is stale/gone) |
| Tasks | `POST /tasks {title, deps?, priority?, refs?}` · `POST /tasks/:id/claim` · `POST /tasks/claim-next` (pull top READY task) · `POST /tasks/:id/state {state, result?}` (record proof on done) · `GET /tasks?ready=1` |
| Message | `POST /messages {to,body}` · `GET /messages?since=&to=me\|all` |

- **Auth:** registration is open; every mutating call needs `Authorization: Bearer <token>`.
  Any authenticated call refreshes your presence.
- **Polling, not SSE:** single-shot Bash calls can't hold the `/events` stream — poll
  `GET /messages?since=` / `GET /locks` instead.

When in doubt, read `tools/agora/PROTOCOL.md` for the exact status codes, conflict shape,
and overlap/glob rules.
