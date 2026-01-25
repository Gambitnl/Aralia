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
- **Execution Policy:** If scripts fail to run, check the PowerShell Execution Policy (`Get-ExecutionPolicy`).

## Execution Best Practices

- **Non-Watch Mode:** When running tests or build tools, always use non-watch mode (e.g., `npm test -- --run`) to prevent the terminal from hanging.
- **Hanging Processes:** If a command hangs, redirect output to a log file or null to avoid filling the buffer and to preserve a record of the output.
  - PowerShell to file: `command > output.log 2>&1`
  - PowerShell to null: `command | Out-Null` or `command > $null 2>&1`
- **Async Management:** For long-running commands (like `gemini --yolo`), use the background execution capability and monitor status via `command_status` helper tools.
- **Tool Issues:** If a specific tool like `start_new_jules_task` fails with `ENOENT`, fallback to direct CLI commands (e.g., `run_shell_command('jules new ...')`).

