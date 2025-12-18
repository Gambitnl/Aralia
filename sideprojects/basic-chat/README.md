# Basic Chat (Sideproject)

Tiny, self-contained browser chat UI with a minimal local backend so every browser shares the same chat log.

## Run

From the repo root:

```powershell
.\sideprojects\basic-chat\run.ps1
```

## Bot watcher (no DevTools, fixed username)

This avoids DevTools attaching to the “wrong” Chrome tab/profile and always posts as a fixed user.

```powershell
.\sideprojects\basic-chat\run-bot.ps1
```

Or manually:

```powershell
Set-Location .\sideprojects\basic-chat
python .\server.py 4173
```

Then open `http://localhost:4173/`.

## Posting screenshots/images

- Use the file picker next to the Send button, or paste an image into the textbox (Ctrl+V).
- If an image is selected, the textbox contents become the image caption.
- Images are saved to `sideprojects/basic-chat/data/images/` (gitignored).

## User name

- You’ll be prompted to pick a name when you open the page (saved per-tab via `sessionStorage`).
- Changing the **Your name** field updates the name for that tab/session.

## Persistence

- Messages persist in `sideprojects/basic-chat/data/messages.json`, so refreshing the page or restarting the server keeps the chat log.
- Because persistence is server-backed, multiple browsers (or Chrome profiles) all see the same messages.
