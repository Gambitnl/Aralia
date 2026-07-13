# groq-proxy — local dev proxy for Groq (key stays out of git)

A tiny local proxy that lets the game use Groq during dev **without the API key ever touching a file or GitHub**.

## Why

The game's "Local proxy" AI mode calls `http://localhost:8787/v1/...`. This proxy holds the key server-side and injects it, so:

- the key never enters the browser (unlike the Persistent/Session modes),
- the key never lands on disk, so the 2am auto-commit can't sync it to GitHub,
- this file contains **no secret** — it reads the key from Windows Credential Manager at startup.

## You usually don't need to run this

When you run the game with `npm run dev`, the Vite dev server **is** the proxy. It
serves `/__groq/v1` on the same origin (see `scripts/vite-plugins/groqProxyManager.ts`),
reads the key from Credential Manager, and injects it. So in dev you just pick
**Local proxy** mode in the game — the default URL `/__groq/v1` already matches, and
there is nothing to start by hand.

This standalone proxy is for **non-Vite** use (a built preview, a different app, or a
second machine) where that same-origin middleware isn't available.

## Run (standalone)

```
npm run groq-proxy
```

Then point **Local proxy** mode at `http://localhost:8787/v1`.

## Where the key comes from

It reads the Windows Credential Manager target **`AgentMatrix/Groq/GROQ_API_KEY`** (already set on this machine). To use a different target or a plain env var instead:

- `GROQ_PROXY_CRED=Some/Other/Target npm run groq-proxy`
- or set `GROQ_API_KEY=gsk_...` in your shell (used as a fallback if the credential is missing).

Change the port with `GROQ_PROXY_PORT=9000` or `--port 9000`.

## How it works

- `GET /health` — reports whether the key loaded (never prints it).
- `POST /v1/chat/completions`, `GET /v1/models`, any `/v1/*` — forwarded to `https://api.groq.com/openai/v1/*` with the `Authorization` header added. Streaming responses pass straight through.
- CORS is open so the browser app (any localhost port) can call it.

## Security

- The key is read once, held in memory, and never logged or returned.
- Bind is `127.0.0.1` only — not reachable from other machines.
- Zero npm dependencies (Node built-ins + `fetch`).
