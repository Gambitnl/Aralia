# Terminal Command Issues and Best Practices

This guide tracks common issues encountered when running terminal commands and provides best practices for reliable execution.

## Common CLI Errors

- **Error: `EADDRINUSE` (Address already in use)**
  - **Cause:** Another process is already using the port (common with MCP servers or dev servers).
  - **Solution:** Identify the process using the port (e.g., `netstat -ano | findstr :<port>`) and terminate it, or configure the server to use a different port.

- **Error: `Command not found`**
  - **Cause:** Tool/binary is not in the system PATH or not installed.
  - **Solution:** 
    1. Ensure installation was successful.
    2. Check npm global binary directory or project-local `node_modules/.bin`.
    3. Use absolute paths if necessary.
    4. **Fallback:** If a command like `rg` (ripgrep) is missing, use `git grep` or PowerShell's `Select-String`. Note that `rg` may be missing from the path in background terminal environments even if available in the VS Code integrated terminal.

- **Error: `fatal: unable to resolve revision: src` (Git Grep)**
  - **Cause:** Occurs when mixing Windows path separators or specific pathspec syntax that PowerShell misinterprets.
  - **Solution:** Wrap complex pathspecs in quotes and use forward slashes for internal Git paths (e.g., `git grep "pattern" -- src ":(exclude)path/to/ignore"`).

- **Error: `MODULE_NOT_FOUND` / Import Errors**
  - **Cause:** Dependencies are missing or the project isn't built.
  - **Solution:** Run `npm install` and `npm run build` to ensure the environment is ready.

- **Error: "Operation not permitted" / "Permission denied"**
  - **Cause:** Sandboxing restrictions or OS-level file permissions.
  - **Solution:** Check if you are attempting to write outside allowed directories. Review [Sandboxing Docs](./cli/configuration.md#sandboxing).

- **Error: `File path ... is ignored by configured ignore patterns`**
  - **Cause:** The `read_file` tool cannot access files listed in `.gitignore` or `.geminiignore` (e.g., log files, build artifacts).
  - **Solution:** Use `run_shell_command` with `type` (Windows) or `cat` (Linux/Mac) to read the file content directly from the terminal.
    - Example: `type tsc_output.log`

## Windows & PowerShell Caveats

- **Path Separators:** Always use backslashes `\` for Windows-native commands, but remember that many tools (including Git and Node.js) handle forward slashes `/` correctly.
- **Quoting & Escaping:** 
  - PowerShell uses backticks `` ` `` for escaping, not backslashes `\`.
  - Use double quotes `"` for paths containing spaces.
  - Be careful with complex JSON strings in `run_command`; prefer writing to a temp file and reading it if escaping becomes too complex.
  - **PowerShell Command Invocation**: When running an executable via an absolute path that contains spaces, use the call operator `&`: `& "C:\Path With Spaces\app.exe"`.
  - **Pathspec Exclusions:** In PowerShell, use `: (exclude)` with careful quoting: `git grep "pattern" -- "." ":(exclude)node_modules/*"`.
- **Chaining Commands:** The `&&` operator is not supported as a statement separator in all PowerShell versions. Use `;` instead to chain multiple commands.
  - Example: `git add . ; git commit -m "message"`
- **Sorting:** PowerShell's `sort` (alias for `Sort-Object`) does not use `-r` for reverse. Use `-Descending` or its shorthand `-desc`.
  - Example: `git for-each-ref ... | sort -Descending`
- **File Encoding & Redirection:** PowerShell's `>` redirection often defaults to `UTF-16LE`. Tools like `view_file` might fail with "unsupported mime type".
  - **Solution:** Use `Out-File -Encoding utf8` or `Set-Content -Encoding utf8` if the file must be read by environment tools, or use `Get-Content` to view it in the terminal.
- **Execution Policy:** If scripts fail to run, check the PowerShell Execution Policy (`Get-ExecutionPolicy`).
- **Spawning Shell Processes:** When using Node's `child_process.spawn` or `exec` on Windows to run commands like `npx`, always set `{ shell: true }` in the options. This ensures that `.cmd` and `.ps1` wrappers are correctly handled by the system shell.

## Execution Best Practices

- **Verify Project Type:** Before running framework-specific tools (like Flutter or Playwright), check `package.json` or `pubspec.yaml` to confirm the project stack. Don't assume the presence of an MCP server implies a valid project environment.
- **Staging Changes:** Avoid `git add .` if you have not run `git status` first. This prevents accidentally staging unrelated manual changes or artifacts. Prefer `git add path/to/file`.
- **Non-Watch Mode:** When running tests or build tools, always use non-watch mode (e.g., `npm test -- --run`) to prevent the terminal from hanging.
- **Hanging Processes:** If a command hangs, redirect output to a log file or null to avoid filling the buffer and to preserve a record of the output.
  - PowerShell to file: `command > output.log 2>&1`
  - PowerShell to null: `command | Out-Null` or `command > $null 2>&1`
- **Async Management:** For long-running commands (like `gemini --yolo`), use the background execution capability and monitor status via `command_status` helper tools.
- **Exit Code Interpretation:** Some commands (like `npx tsc --noEmit`) may return non-zero exit codes due to pre-existing errors. Filter the output with `Select-String` to focus on your changes rather than relying solely on the exit code.
  - **TSC Formatting:** Use `--pretty false` when redirecting `tsc` output to a file (e.g., `npx tsc --noEmit --pretty false > tsc.log`) to avoid ANSI escape codes in the log file.
- **Tool Issues:** If a specific tool like `grep_search` fails with internal OS errors (e.g., missing `.antigravityignore` or special files like `nul`), fallback to `run_command` with native CLI tools.
- **Log Encoding (UTF-16LE):** Files like `test_output.log` are often encoded in `UTF-16LE` (Unicode). standard `view_file` or `type` commands may fail or show scramble.
  - **Solution:** Use PowerShell with the encoding flag: `Get-Content -Path "test_output.log" -Encoding Unicode`.
- **Special File Conflicts (nul):** The `nul` file in the project root causes `Select-String` and other recursive PowerShell commands to fail.
  - **Solution:** Explicitly exclude `nul` or use `git grep` which respects `.gitignore`.
- **Node Spawn on Windows:** When using `child_process.spawn` or `exec` on Windows, ALWAYS set `{ shell: true }` to avoid `ENOENT` errors when calling `.cmd` or `.ps1` wrappers (like `npx`).
- **Rapid-Fire File Edits:** When performing multiple `multi_replace_file_content` calls on a single file, ensure each call is followed by a `view_file` to resync line numbers. Overlapping or rapid non-atomic edits can lead to catastrophic file corruption if internal line-tracking state desyncs from the actual file state.
- **TSC Exit Codes:** `npx tsc --noEmit` on this project often returns exit code 1 due to pre-existing `node_modules` (Zod/fa) interop issues. Focus on specific file errors in the output rather than the final exit code.