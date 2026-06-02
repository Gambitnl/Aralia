# NORTH_STAR: Sideproject: Basic Chat

Status: active
Last updated: 2026-05-31

## Why This Project Exists

This sideproject provides a small, local proof-of-concept chat tool that is already
implemented and should remain easy to resume, validate, and classify as active or
reference-only.

## Scope

- `sideprojects/basic-chat` implementation evidence, without touching other repo areas.
- Project registry alignment in `docs/projects/PROJECT_TRACKER.md` for scope and ownership context.
- Continuation-facing docs in `docs/projects/sideproject-basic-chat/`.

## File Map

- `docs/projects/sideproject-basic-chat/NORTH_STAR.md` - project intent, scope, and resume path.
- `docs/projects/sideproject-basic-chat/TRACKER.md` - task status and ownership state.
- `docs/projects/sideproject-basic-chat/GAPS.md` - durable unresolved findings.
- `sideprojects/basic-chat/server.py` - Python HTTP backend and data store.
- `sideprojects/basic-chat/index.html` - browser UI, polling loop, chat selector, image upload.
- `sideprojects/basic-chat/run.ps1` - starts server at localhost:4173.
- `sideprojects/basic-chat/run-bot.ps1` - starts watcher bot.
- `sideprojects/basic-chat/bot_watch.py` - polling bot and reply sender.
- `sideprojects/basic-chat/post-message.ps1` - CLI message posting helper.
- `sideprojects/basic-chat/data/*` - persisted chat state and uploaded assets.

## Implemented State

- Backend and UI are both present and runnable locally.
- Multi-chat and archive flow is implemented.
- Active chat is stored in `data/chats/active.json`.
- Messages are mirrored in `data/messages.json` and per-chat files under `data/chats`.
- Image upload is supported via `imageDataUrl` POST payload with size-limited server decode.
- A bot watcher and command posting scripts are available for local automation.
- Tracker row currently marks this as implemented but does not yet define final active/reference status.

## Integrations

- HTTP API from `server.py`:
  - `GET /api/health`
  - `GET /api/messages`
  - `GET /api/chats`
  - `POST /api/messages`
  - `POST /api/chats/archive`
  - `POST /api/chats/select`
- `index.html` polls and renders API-backed chat and chat list.
- `bot_watch.py` and `post-message.ps1` both call the same API surface.
- Runtime depends on local Python (`python` or `py`) and port 4173.

## Active vs Reference-Only

- Project registry evidence: [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md)
- The row for this sideproject is currently marked `experimental` and `implemented` and explicitly asks to define whether it is active or reference-only.
- The docs in this folder do not make that decision yet; they preserve it as an open call.

## Next Checks

1. Confirm active/reference decision in `docs/projects/PROJECT_TRACKER.md` row 123.
2. Validate that API routes and local persistence still match current behavior.
3. Record the decision in `TRACKER.md` before implementation expansion.

## Next Action

Read this file, then `TRACKER.md`, then `GAPS.md`, then align the active/reference status
with `docs/projects/PROJECT_TRACKER.md`.

## Supporting Files

- [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md) | Registry anchor | active
- [docs/projects/GLOBAL_GAPS.md](docs/projects/GLOBAL_GAPS.md) | Cross-project routing | active
- [docs/projects/sideproject-basic-chat/TRACKER.md](docs/projects/sideproject-basic-chat/TRACKER.md) | Status and task queue | active
- [docs/projects/sideproject-basic-chat/GAPS.md](docs/projects/sideproject-basic-chat/GAPS.md) | Gaps and uncertain decisions | active

## Resume Path For A Cold Agent

1. Read this file.
2. Read [docs/projects/sideproject-basic-chat/TRACKER.md](docs/projects/sideproject-basic-chat/TRACKER.md).
3. Read [docs/projects/sideproject-basic-chat/GAPS.md](docs/projects/sideproject-basic-chat/GAPS.md).
4. Confirm row 123 in [docs/projects/PROJECT_TRACKER.md](docs/projects/PROJECT_TRACKER.md).
5. Continue from the active/reference decision and keep edits scoped to the chosen boundary.


## Cold-Start Gap Routing

The next cold-start agent must:
- read `TRACKER.md` and `GAPS.md` first
- tackle one real, evidence-backed project gap in the same pass
- identify and register 2 additional real project gaps tied to this project in `GAPS.md`
- if no valid in-scope project gaps exist, identify 2 real cross-project gaps in `docs/projects/GLOBAL_GAPS.md` instead and register them there
- do not invent gaps just to satisfy the count
