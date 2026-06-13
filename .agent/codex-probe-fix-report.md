I’m blocked before I can write the fix: every local execution/edit path is failing at process startup with Windows status `0xc0000142`.

Failed surfaces:
- `exec_command` cannot start PowerShell.
- `apply_patch` cannot read/write the target file because its filesystem helper fails.
- `node_repl` cannot start Node.

No repo file was changed.

What I found before the tool layer failed:
- `claude`: `/usage` needs the slash-command popup to be accepted with `Tab` before `Enter`; inherited `CLAUDE*` env vars should be stripped; the parser also needs to tolerate collapsed rendered text like `Totalcost`.
- `qoder`: typed `/usage` is being routed through the composer in this PTY, so the probe reports garbage. The reliable fallback is the recent bounded `~/.qoder/logs/runs/*/qodercli.log` quota response, which contains the plan/quota data needed for `Community` and `0/0`.

I can apply and verify the prepared single-file patch once the local process helper recovers or the Codex session is restarted.