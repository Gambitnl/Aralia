# AGENTS.md

**Application Intent & Developer Tools**
- **Intent**: Aralia is a web-based application/game that features procedural systems and complex mechanics (e.g., encounters, crime systems).
- **Human Dev Tools**: The repository includes dedicated tools to assist human developers, such as the **Dev Hub** (`misc/dev_hub.html`) for modular tool management and the **Codebase Visualizer** (`scripts/codebase-visualizer-server.ts`) for tracking code quality and dependencies.

**Environment**
- **Shell**: The environment is Windows PowerShell. Run commands using `powershell -NoLogo -Command` (do not use `pwsh`).
- **Paths**: Project root is `C:\Users\gambi\Documents\Git\AraliaV4\Aralia`. Use backslashes for native commands and avoid `Users\Users` nesting errors.
- **Node Execution**: Setting `{ shell: true }` is mandatory when spawning Windows `.cmd` or `.ps1` wrappers via Node.js.

**Project Tooling & Commands**
- **Testing**: Use `/test-ts` to execute unit tests (Vitest), type tests (TSD), or build-time checks (TSC).
- **Dependency Tracking**: When modifying exported signatures, `utils`, `hooks`, or `state` files, run `npx tsx scripts/codebase-visualizer-server.ts --sync <path>` to update the required dependency headers.
- **Session Hygiene**: Execute `/session-ritual` upon completing major task verification to automatically sync dependencies and extract any environment learnings. 

*Note: For other specific workflows or troubleshooting, rely on your tools or standard project search.*
