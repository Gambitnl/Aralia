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
    4. **Fallback:** If a command like `rg` (ripgrep) is missing, use `git grep` or PowerShell's `Select-String`.

- **Error: `fatal: unable to resolve revision: src` (Git Grep)**
  - **Cause:** Occurs when mixing Windows path separators or specific pathspec syntax that PowerShell misinterprets.
  - **Solution:** Wrap complex pathspecs in quotes and use forward slashes for internal Git paths (e.g., `git grep "pattern" -- src ":(exclude)path/to/ignore"`).

- **Error: `MODULE_NOT_FOUND` / Import Errors**
  - **Cause:** Dependencies are missing or the project isn't built.
  - **Solution:** Run `npm install` and `npm run build` to ensure the environment is ready.

- **Error: "Operation not permitted" / "Permission denied"**
  - **Cause:** Sandboxing restrictions or OS-level file permissions.
  - **Solution:** Check if you are attempting to write outside allowed directories. Review [Sandboxing Docs](./cli/configuration.md#sandboxing).

## Windows & PowerShell Caveats

- **Path Separators:** Always use backslashes `\` for Windows-native commands, but remember that many tools (including Git and Node.js) handle forward slashes `/` correctly.
- **Quoting & Escaping:** 
  - PowerShell uses backticks `` ` `` for escaping, not backslashes `\`.
  - Use double quotes `"` for paths containing spaces.
  - Be careful with complex JSON strings in `run_command`; prefer writing to a temp file and reading it if escaping becomes too complex.
  - **Pathspec Exclusions:** In PowerShell, use `: (exclude)` with careful quoting: `git grep "pattern" -- "." ":(exclude)node_modules/*"`.
- **Execution Policy:** If scripts fail to run, check the PowerShell Execution Policy (`Get-ExecutionPolicy`).
- **Spawning Shell Processes:** When using Node's `child_process.spawn` or `exec` on Windows to run commands like `npx`, always set `{ shell: true }` in the options. This ensures that `.cmd` and `.ps1` wrappers are correctly handled by the system shell.

## Execution Best Practices

- **Non-Watch Mode:** When running tests or build tools, always use non-watch mode (e.g., `npm test -- --run`) to prevent the terminal from hanging.
- **Hanging Processes:** If a command hangs, redirect output to a log file or null to avoid filling the buffer and to preserve a record of the output.
  - PowerShell to file: `command > output.log 2>&1`
  - PowerShell to null: `command | Out-Null` or `command > $null 2>&1`
- **Async Management:** For long-running commands (like `gemini --yolo`), use the background execution capability and monitor status via `command_status` helper tools.
- **Exit Code Interpretation:** Some commands (like `npx tsc --noEmit`) may return non-zero exit codes due to pre-existing errors. Filter the output with `Select-String` to focus on your changes rather than relying solely on the exit code.
- **Tool Issues:** If a specific tool like `grep_search` fails with internal OS errors (e.g., missing `.antigravityignore` or special files like `nul`), fallback to `run_command` with native CLI tools.
- **Node Spawn on Windows:** When using `child_process.spawn` or `exec` on Windows, ALWAYS set `{ shell: true }` to avoid `ENOENT` errors when calling `.cmd` or `.ps1` wrappers (like `npx`).

