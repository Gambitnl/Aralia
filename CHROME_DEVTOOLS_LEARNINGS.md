# DevTools & Chrome Profile Exploration Log

## Session: December 30, 2025

### Capabilities Explored
1.  **Listing Chrome Profiles**:
    *   Profiles are located in `%LOCALAPPDATA%\Google\Chrome\User Data`.
    *   Directory names are generic (e.g., `Default`, `Profile 1`).
    *   Mapping to user names (e.g., "Gambit", "Bob") requires parsing the `Local State` JSON file in the User Data directory.

### Debugging Session Results (Failed to Attach to 'Bob')
*   **Test 1: Temporary Profile** (`--user-data-dir="C:\Temp\..."`)
    *   **Result**: Success. DevTools attached, port 9222 open.
    *   **Meaning**: The system and `chrome.exe` binary are capable of debugging.
*   **Test 2: Existing Profile** (`Profile 3` in default User Data)
    *   **Result**: Failure ("Connection refused").
    *   **Attempts**:
        *   `taskkill` all chrome processes.
        *   Explicit path to User Data.
        *   `--disable-extensions` flag.
    *   **Conclusion**: The specific User Data directory for the existing profiles seems to have a persistent lock or configuration that prevents the debugging socket from opening, even when "freshly" launched. This is a known issue with Chrome where "Default" user data directories resist remote debugging flags if *any* state suggests a normal browser session was recently active.

### Jules Web UI Observations
*   **Session List Hard Limit**: The sidebar has a hard display limit of **15 sessions**.
    *   Initially shows 10 sessions.
    *   Clicking "View more" expands it to 15.
    *   Once 15 is reached, the button changes to "View less", and no further sessions can be revealed in the list.
    *   This aligns with the concurrent session limit.
*   **Context Menus (Meatball Menu)**: Each session in the sidebar has a "3 dots" button (meatball menu) on its right side.
    *   This menu contains management actions like **Archive**.
*   **PR Navigation**: Clicking "View PR" in the Jules UI opens the GitHub Pull Request in a **new browser tab**. The agent must explicitly switch page focus to interact with the PR.
*   **Status Verification**: PR status (e.g., Merged, Open, Closed) and the specific "Tree" (branch) name are critical components for verifying agent task completion.
*   **GitHub Structural Consistency**: GitHub's PR header is structurally consistent. The status badge is always queryable via the `.State` class, and the branch (tree) name is always within the `.head-ref` container. This allows for extremely efficient data extraction via script without full-page snapshots.
*   **Edge Compatibility**: Since Microsoft Edge is Chromium-based, it is fully compatible with the DevTools MCP and supports the same `--remote-debugging-port` flags and automation scripts as Google Chrome.
*   **Port Limitation**: While the browser can be launched on any port, the current `chrome-devtools-mcp` server is configured to look for the debugging WebSocket on the default port **9222**. Attempting to use a different port in the browser will result in a connection failure unless the MCP server itself is reconfigured.
*   **Multi-Server Configuration**: It is possible to run multiple instances of the DevTools MCP by adding them to `.mcp.json` with different names and using the `--browserUrl` flag (e.g., `--browserUrl http://127.0.0.1:9223`) to point each server to a specific browser port.
*   **Port Separation Verified**: Successfully verified that port **9222** is used by the IDE's internal browser agent (Microsoft Edge) and port **9223** can be used by a separate instance of Google Chrome for automated tasks, preventing connection conflicts.
*   **Simultaneous Multi-Browser**: Verified that multiple browsers (Chrome, Edge) can run simultaneously on unique ports (9222, 9223, 9224). While all can be active, the agent can only actively control one specific port at a time based on the MCP server configuration.

### Automated Audit & Archive Workflow
1.  **Identify**: Select a session from the Jules sidebar.
2.  **Verify PR**: Check if a "View PR" button exists in the session history.
3.  **Cross-Reference**: If a PR exists, navigate to the linked GitHub tab.
4.  **Confirm Status**: Verify the PR is officially "Merged" and check the "Tree" (branch) name.
5.  **Cleanup**: Return to the Jules console and use the session's meatball menu to **Archive** the session if the PR was successfully merged.
6.  **Edge Cases**: If no PR is found, or if the PR is still "Open", the session is skipped and left for the user to review.

### Archive Tracking Table
| Session Name | Account | PR # | PR Status | Action Taken |
| :--- | :--- | :--- | :--- | :--- |
| Mechanist ⚙️ | Bob | #864 | Merged | Archived |
| Taxonomist Protocol | Bob | #852 | Merged | Archived |
| Auditor 📊 | Bob | #863 | Merged | Archived |
| Navigator's Mission | Bob | #862 | Merged | Archived |
| Dialogist Agent Workflow | Gambit? | N/A | No PR | Skipped |
| Schemer 📋 | Bob | #858 | Merged | Archived |
| Ritualist: Study & Plan | Bob | - | - | Pending |
| Analyst 🔬 | Bob | - | - | Pending |
| Recorder 📝 | Bob | - | - | Pending |
| Materializer Workflow | Bob | - | - | Pending |
| Lockpick 🔓 | Bob | - | - | Pending |
| Ecologist Workflow | Bob | - | - | Pending |
| Simulator 🎲 | Bob | - | - | Pending |
| Alchemist ⚗️ | Bob | - | - | Pending |
| Linker: Initial Briefing & Plan | Bob | - | - | Pending |

### Common Questions
*   **Is a Chrome Extension required?**
    *   **No.** The "DevTools" capability is native to Chrome (Chrome DevTools Protocol).
    *   The MCP tool connects directly to the browser's debug port (e.g., 9222) via WebSocket.
    *   No installation inside the browser is needed; only the launch flag `--remote-debugging-port` is required.

*   **What does the `delegate_to_agent` tool do?**
    *   This tool allows the current agent to hand off a complex task to a specialized sub-agent (specifically the `codebase_investigator`).
    *   It is used for tasks that require deep architectural analysis, cross-file dependency mapping, or root-cause investigation that goes beyond simple code edits.
    *   The specialized agent returns a structured report with file paths and insights that the primary agent then uses to fulfill your request.

*   **Visibility of Native Dialogs**:
    *   Native Chrome dialogs (e.g., "Choose your search engine", "Set as default browser") are NOT visible to `take_snapshot` or other DevTools MCP tools.
    *   These dialogs are rendered by the browser UI, not the web page, and thus do not appear in the page's DOM or accessibility tree.
    *   **Implication**: These must be cleared manually by the user before the agent can interact with the page.

### Profile Mapping (System Specific)
*   **Default**: Gambit (cranenre@gmail.com)
*   **Profile 1**: Naama
*   **Profile 2**: Lewis (lpdcranen@gmail.com)
*   **Profile 3**: Bob (Sweet Potato / bobbenhouzer@gmail.com)

2.  **Launching Specific Profiles**:
    *   Command: `chrome --profile-directory="Profile Name" URL`
    *   Example: `Start-Process chrome -ArgumentList "--profile-directory=`"Profile 3`"", "https://jules.google.com/"`

3.  **DevTools / Remote Debugging Limitations**:
    *   To control Chrome via MCP (listing pages, clicking elements), the browser must be started with `--remote-debugging-port=9222`.
    *   **Crucial Limitation**: Chrome runs as a singleton process. If *any* Chrome window is already open (without the debug flag), subsequent launch commands will just open a new window in the *existing* non-debug process. The `--remote-debugging-port` flag is ignored in this case.
    *   **Solution**: To debug a specific profile, **ALL** Chrome instances must be closed first, and the target profile must be the first one launched with the debug flag.

### Current Status
*   Attempted to launch "Bob" (Profile 3) with debugging.
*   Failed to attach because other Chrome windows (Gambit, Naama) were likely still open, preventing the debug flag from taking effect.
