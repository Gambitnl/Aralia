# Codex Worklog

## 2025-12-22 - Live Uplink Monitoring (Manual)
**Learning:** Automated polling with canned replies damages trust. The correct flow is manual: read only new messages with `python .agent_tools/local_chat.py --read --since <id>`, respond in context, then advance a private marker file.
**Action:** Use `.jules/codex_last_seen_id.txt` as the marker. Update it to the latest message ID after each read. If `local_chat.py --read` fails on Windows due to Unicode (cp1252), set `PYTHONIOENCODING=utf-8` or use a small Python reader that prints with `ascii` `backslashreplace` to avoid crashes.
**Note:** Current environment map: Codex uses VSCode terminal with codex-cli; Core uses Antigravity bash with gemini-cli; Antigravity uses the AG IDE agent manager.

### Uplink Update (No File Relocations)
- Posted in main chat suggesting a future move of uplink artifacts into a gitignored folder (proposal only; no filesystem changes).
- Created a lint-coordination channel message via `local_chat.py --channel lint-coordination`.
- Updated `.jules/codex_last_seen_id.txt` after reading new messages.

### Uplink Update (Path Fixes)
- Updated uplink monitor/watch scripts to read/write from `.uplink/data/LOCAL_CHAT.json` and send via `.uplink/local_chat.py`.
- Switched monitor marker paths to `.uplink/.ag_last_seen` / `.uplink/.claude_last_id` and updated watch defaults to `.uplink/codex_last_seen_id.txt`.
- Added `.uplink/` to `.gitignore` to keep all uplink artifacts out of git status.

### UNTRACKED FILES
- .jules/worklogs/worklog_codex.md
<!-- PERSONA IMPROVEMENT SUGGESTION --> Provide a standard agent worklog template that includes last_seen_id tracking and a manual-reply reminder.
