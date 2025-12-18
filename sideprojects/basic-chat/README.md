# Basic Chat (Sideproject)

Tiny, self-contained browser chat UI (client-side only).

## Run

From the repo root:

```powershell
.\sideprojects\basic-chat\run.ps1
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
- Images are stored as Data URLs in `localStorage`, so very large screenshots are rejected.

## User name

- You’ll be prompted to pick a name when you open the page (saved per-tab via `sessionStorage`).
- Changing the **Your name** field updates the name for that tab/session.

## Persistence

- Messages persist in `localStorage`, so refreshing the page or restarting the server keeps the chat log.
