---
description: Scaffold the project and set up the Conductor environment for context-driven development (run once per project)
---

# Track Setup Workflow

Scaffold the project and set up the Conductor environment for context-driven development.

---

## Steps

### 1. Check Existing Setup

Read `conductor/setup_state.json` if it exists:
- If `last_successful_step` is `"3.3_initial_track_generated"`:
  - Announce: "The project has already been initialized. Use `/track-plan` to create a new track or `/track-implement` to start implementing."
  - Halt
- If another value, resume from that step (see step references below)

### 2. Detect Project Type

Classify the project:

**Brownfield (Existing)** if ANY of these exist:
- `.git` directory
- `package.json`, `pom.xml`, `requirements.txt`, `go.mod`
- `src/`, `app/`, `lib/` directories with code

**Greenfield (New)** if:
- Directory is empty or contains only README.md

### 3. Project Initialization

**For Brownfield Projects:**
1. Ask permission: "I detected an existing project. May I perform a read-only scan to analyze it? (yes/no)"
2. If yes, scan the codebase (respect .gitignore):
   - Analyze README.md first
   - Check package.json/manifest files for tech stack
   - Infer architecture from directory structure
3. Summarize findings before proceeding

**For Greenfield Projects:**
1. Initialize git if `.git` doesn't exist: `git init`
2. Ask: "What do you want to build?"
3. Create `conductor/` directory
4. Create `conductor/setup_state.json` with `{"last_successful_step": ""}`
5. Write initial concept to `conductor/product.md` under `# Initial Concept`

### 4. Generate Product Guide (Step 2.1)

1. Announce: "Let's create the product definition (product.md)."

2. Ask up to 5 questions sequentially about:
   - Target users
   - Main goals
   - Key features
   - Success metrics

   For each question, offer 3 options + "Type your own" + "Auto-generate rest"

3. Draft `conductor/product.md` with gathered information

4. Present draft, get approval, revise if needed

5. Write file and update state: `{"last_successful_step": "2.1_product_guide"}`

### 5. Generate Product Guidelines (Step 2.2)

1. Announce: "Now let's define product guidelines (product-guidelines.md)."

2. Ask up to 5 questions about:
   - Prose style / tone
   - Brand messaging
   - Visual identity principles

3. Draft, present, get approval

4. Write `conductor/product-guidelines.md`

5. Update state: `{"last_successful_step": "2.2_product_guidelines"}`

### 6. Generate Tech Stack (Step 2.3)

1. Announce: "Let's define the technology stack (tech-stack.md)."

2. **For Brownfield**: State detected stack, ask for confirmation
   **For Greenfield**: Ask about languages, frameworks, databases

3. Draft, present, get approval

4. Write `conductor/tech-stack.md`

5. Update state: `{"last_successful_step": "2.3_tech_stack"}`

### 7. Setup Code Styleguides (Step 2.4)

1. Create `conductor/code_styleguides/` directory

2. Based on tech stack, recommend appropriate style guides

3. Ask user to confirm or customize selection

4. Create placeholder files or copy from templates if available

5. Update state: `{"last_successful_step": "2.4_code_styleguides"}`

### 8. Generate Workflow (Step 2.5)

1. Announce: "Let's define your development workflow."

2. Ask about:
   - Test coverage requirement (default: 80%)
   - Commit frequency: per task (recommended) or per phase
   - Task summary location: git notes or commit messages

3. Write `conductor/workflow.md` with chosen options

4. Update state: `{"last_successful_step": "2.5_workflow"}`

### 9. Generate Index File

Create `conductor/index.md`:
```markdown
# Project Context

## Definition
- [Product Definition](./product.md)
- [Product Guidelines](./product-guidelines.md)
- [Tech Stack](./tech-stack.md)

## Workflow
- [Workflow](./workflow.md)
- [Code Style Guides](./code_styleguides/)

## Management
- [Tracks Registry](./tracks.md)
- [Tracks Directory](./tracks/)
```

### 10. Generate Initial Track (Step 3.x)

1. Announce: "Setup is almost complete. Let's create your first track."

2. **For Greenfield**: Ask about first feature/MVP scope
   **For Brownfield**: Recommend maintenance or enhancement track

3. Generate track title and get approval

4. Create track artifacts:
   - Directory: `conductor/tracks/<track_id>/`
   - Files: metadata.json, index.md, spec.md, plan.md

5. Create `conductor/tracks.md`:
```markdown
# Project Tracks

This file tracks all major tracks for the project.

---

- [ ] **Track: <Description>**
  *Link: [./tracks/<track_id>/](./tracks/<track_id>/)*
```

6. Update state: `{"last_successful_step": "3.3_initial_track_generated"}`

### 11. Finalize

1. Commit all conductor files:
   ```
   git add conductor/
   git commit -m "conductor(setup): Add conductor setup files"
   ```

2. Announce: "Conductor setup is complete! You can now start implementation with `/track-implement`."
