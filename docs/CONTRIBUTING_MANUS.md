# Manus Contribution Guidelines for Aralia

To ensure consistency and prevent merge conflicts when working on the Aralia codebase, the following standard operating procedures (SOP) are established for the Manus AI agent.

## **1. Sync-First Policy**
Before starting any task (feature implementation, bug fix, or documentation update), Manus MUST synchronize the local environment with the remote repository.

### **Procedure**
1.  **Fetch & Status**: Check for remote changes.
    ```bash
    git fetch origin master
    git status
    ```
2.  **Integrate**: Update the local branch.
    *   If no local changes: `git pull origin master`
    *   If local changes exist: `git pull origin master --rebase`
3.  **Verify**: Ensure the environment is clean and dependencies are up to date.
    ```bash
    npm install
    ```

## **2. Development Standards**
*   **Package Manager**: Always use `npm`. Do not use `pnpm` or `yarn`.
*   **Type Safety**: Ensure all new code passes `npm run typecheck`.
*   **Testing**: New features must include unit tests in the appropriate `__tests__` directory.
*   **Documentation**: Update relevant `.md` files in the `docs/` folder and mark tasks as completed in `QOL_TODO.md` or `FEATURES_TODO.md`.

## **3. Commit & Push**
*   Use descriptive commit messages (e.g., `feat: ...`, `fix: ...`, `refactor: ...`).
*   Always push changes to the `master` branch immediately after a successful implementation and verification.
