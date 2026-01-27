# Windows Compatibility Patch for Stitch MCP

## The Problem

On Windows, the `stitch-mcp` library crashes with `spawn EINVAL` when trying to call `gcloud.cmd`. This is because Node.js's `spawn()` function cannot directly execute `.cmd` files without a shell wrapper.

**Error Message:**
```
[Gcloud] Token fetch exception: Error: spawn EINVAL
    at ChildProcess.spawn (node:internal/child_process:420:11)
    at execCommand (...stitch-mcp/dist/cli.js:4223:19)
```

## The Solution

Patch the `execCommand` function in the globally installed library to wrap `.cmd` files with `cmd.exe /c`.

### Patch Location

```
C:\Users\gambi\AppData\Roaming\npm\node_modules\@_davideast\stitch-mcp\dist\cli.js
```

### Patch Instructions

1. Open `cli.js` in a text editor
2. Search for `async function execCommand` (around line 4209)
3. Find the line `const child = spawn(cmd, args, spawnOptions);` (around line 4223)
4. Replace it with:

```javascript
// Windows .cmd/.bat shim (fixes spawn EINVAL)
const useCmdShim = process.platform === "win32" && /\.(cmd|bat)$/i.test(cmd);
const spawnCmd = useCmdShim ? "cmd.exe" : cmd;
const spawnArgs = useCmdShim ? ["/c", cmd, ...args] : args;
const child = spawn(spawnCmd, spawnArgs, spawnOptions);
```

### Verification

After patching, test with:
```bash
npx tsx scripts/inspect_stitch.ts --list-tools
```

You should see `[Bridge] Connected!` instead of `spawn EINVAL`.

## Note

This patch needs to be reapplied after updating `@_davideast/stitch-mcp` via npm.

## Alternative: Use WSL

If patching is problematic, running the entire toolchain inside WSL (Windows Subsystem for Linux) avoids the `.cmd` spawn issue entirely.
