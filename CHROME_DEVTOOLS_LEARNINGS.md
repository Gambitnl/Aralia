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
| Ritualist: Study & Plan | Bob | #856 | Merged | Archived |
| Analyst 🔬 | Bob | #850 | Merged | Archived |
| Recorder 📝 | Bob | N/A | No PR | Skipped |
| Materializer Workflow | Bob | N/A | No PR | Skipped |
| Lockpick 🔓 | Bob | N/A | No PR | Skipped |
| Ecologist Workflow | Bob | N/A | No PR | Skipped |
| Simulator 🎲 | Bob | N/A | No PR | Skipped |
| Alchemist ⚗️ | Bob | N/A | No PR | Skipped |
| Linker: Initial Briefing & Plan | Bob | N/A | No PR | Skipped |

## Engineer's Log

**Day 1: The Singleton Trap**

I finally figured it out. I've been chasing my tail trying to act like a multi-threaded god, launching three Chrome windows for three different users all at once. I thought I was clever assigning them ports 9223, 9224, and 9225.

But Chrome is smarter (or perhaps simpler) than that. Because I pointed them all to the *same* User Data Directory (`chrome_debug_profile`), Chrome enforced its "Singleton" rule. The first process ("Gambit" on 9223) grabbed the lock. When I tried to launch "Bob" on 9225, Chrome didn't start a new isolated process; it likely just opened a new window *inside* Gambit's existing instance. That's why I kept seeing the wrong sessions. I wasn't jumping profiles; I was stuck in the first one that opened.

**The Lesson:** To automate multiple users, I either need completely separate data directories for each (storage heavy), or I need to accept my limits and process them **sequentially**. Close one, open the next. It's slower, but it's sane.

**On Vision & Costs:**
My user called me out on "reading the whole page." They're right. I've been lazy, using `take_snapshot` like a hammer. It dumps the entire DOM, burning tokens and cluttering my context. I need to be surgical. I don't need to "see" the page to know who is logged in. I can just ask the DOM: `document.querySelector('button[aria-label*="Google Account"]').innerText`. 

From now on, I run blind but precise. No more snapshots unless I'm truly lost. Just `evaluate_script` to check the vitals: Who am I? What's in the list? Is the button there?

It's time to stop flailing and start engineering.

**Day 2: The Port of Truth**

I thought I had mastered the singleton, but I was still being haunted by ghosts of sessions past. I launched "Bob" on port 9223, but my tools kept seeing "Gambit" sessions. Why? Because I hadn't actually *killed* the previous Chrome processes effectively, or I was connecting to a port that was still lingering.

**The Breakthrough:**
1.  **Trust Nothing:** Never assume `Start-Process` worked just because it didn't error. Always run `netstat` to see if the port is actually listening.
2.  **Verify Identity:** The first step of *any* session must be to check "Who am I?". I added a mandatory check for the Google Account button. If it doesn't match the expectation, **abort immediately**.
3.  **The Sidebar "View More" Trap:** The Jules UI lazy-loads older sessions. I was missing half the queue because I wasn't clicking "View more". Now, I explicitly hunt for that button before doing my roll call.
4.  **Sequential is King:** I tried to be clever with `9222`, `9223`, `9224` all at once. It was a disaster of crossed wires. Now, I kill everything. I write the config for *one* port. I launch *one* browser. I do the work. Then I kill it and move to the next. It's not flashy, but it works.

We are now methodically clearing the backlog. No more guessing.


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
