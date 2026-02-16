# @HANDOVER-CREATION-GUIDE.md

**Purpose**: A generalized template and workflow for creating high-fidelity task handovers between agents in the Aralia project.

---

## 🧭 The Core Philosophy
A handover is not just a dump of information; it is a **Command Intent** document. It is designed to move an agent from "Blind Execution" to "Investigative Intelligence," ensuring the project is free of "Jerry-work" (AI Slop).

---

## 🏗️ Handover Structure (The Anatomy)

Every high-fidelity handover should include these five sections:

### 1. The Vision (The "Why")
-   Define the high-level goal in evocative terms.
-   **Authority Matrix**: Explicitly state which document is authoritative in case of conflict (e.g., "Handover > Plan > Spec").
-   Clarify what the tool is **NOT** for (Scope boundaries).

### 2. Functional Requirements (The "What")
-   **Backend/Frontend**: Data logic, API endpoints, and interaction design.
-   **Known Drifts**: List current code behaviors that explicitly contradict the vision (e.g., "UI is currently blue, must become green").
-   **Data Integrity**: Define requirements for IDs, persistence, and state stability (no `Math.random` for keys).
-   **Data Lifecycle**: Define temporary scaffolds vs. permanent sources.

### 3. Technical Architecture (The "How")
-   List the tech stack and define the data flow.
-   **Security & Permissions**: Define boundaries for features touching the host system (e.g., local command bridges, file writes).

### 4. UI/UX Mockup Description
-   Describe the HUD and visual layers in detail.
-   Use descriptive terms for VFX and animations (e.g., "Pulsating sun", "Gravity lines").

### 5. Mandatory Agent Protocol: "The Inquisition"
-   **Audit First**: Force the agent to read existing implementation plans and code before speaking.
-   **Inquiry Before Action**: Require a list of rigorous, clarifying questions before any code is written.
-   **Layman Communication**: Mandate that the agent speaks to the user in non-technical terms for high-level status.

---

## 🛠️ Creation Workflow

### Step 1: Sequential Intelligence Gathering
Before writing the handover, find and identify:
1.  The primary **Implementation Plan** for the feature.
2.  The existing **System Guide** or specification.
3.  The **Live Code** files (Engine/Visualizer).
4.  The **Work-Tracking** artifacts (Mining progress, TODOs).

### Step 2: Consistent Naming
-   Rename files to be specific to their subject.
-   Use the project sequence numbering (e.g., `1B-[PROJECT]-HANDOVER.md`).
-   Update the `@DOC-REGISTRY.md` and `@ACTIVE-DOCS.md` immediately.

### Step 3: The Kickoff Prompt
Create a single, concise prompt that provides:
-   A **sequential reading list**.
-   A clear **objective**.
-   A reminder of the **Communication Rules** (Layman terms).

---

## 📝 High-Level Directives (From the User)
-   **Zero Ambiguity**: Phasing must be logical and justified.
-   **Artifact Obsolescence**: No redundant static lists; the engine must supersede the scaffold.
-   **Investigative Curiosity**: Agents must interrogate the plan for logical flaws or " Jerry-work."
-   **User-Centricity**: Speak simply. High complexity code does not require high complexity conversation.
