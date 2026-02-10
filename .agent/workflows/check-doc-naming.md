---
description: Check naming conventions before creating or renaming documentation files
---

# Pre-Flight: Documentation Naming

Before creating or renaming any `.md` file in `docs/`:

// turbo
1. Read `docs/@DOC-NAMING-CONVENTIONS.md`

2. Determine document type:
   - **Static/Permanent** (workflows, guides) → Use `@` prefix: `@WORKFLOW-NAME.md`
   - **Task** (single unit of work) → Use numbered format: `1A-TASK-NAME.md`
   - **Project** (multi-task) → Use numbered format: `1A-PROJECT-NAME.md`

3. If numbered, check `docs/@DOC-REGISTRY.md` for next available number

4. After creating, update `docs/@DOC-REGISTRY.md`
