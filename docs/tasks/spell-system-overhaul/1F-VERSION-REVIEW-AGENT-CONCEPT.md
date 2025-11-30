# Task 1F Concept: Version Sizing Review Agent

**Status**: Concept / Roadmap Item
**Priority**: Low (nice-to-have)
**Created**: November 30, 2025

---

## The Problem

AI models (including Claude) are notoriously bad at estimating:
- How long a task will take
- Whether a change is "small" or "large"
- Appropriate version bump type (patch vs minor vs major)

**Example**:
- Model says: "This will take several hours"
- Reality: Takes 10 minutes
- Or vice versa: "Quick 30-minute task" → Actually 4 hours

---

## Proposed Solution

**Specialized Review Agent** that analyzes a planned task and recommends version bump size.

### Workflow

1. **Task gets planned** (by human or agent)
   - Task description written
   - Changes outlined
   - Estimated effort noted

2. **Version Review Agent analyzes**:
   ```
   Input: Task description, files to change, scope
   Output: Recommended version bump + justification
   ```

3. **Agent considers**:
   - **Breaking changes?** → Major bump
   - **New features?** → Minor bump
   - **Bug fixes only?** → Patch bump
   - **How many files affected?**
   - **Complexity of changes?**
   - **API/interface changes?**
   - **User-facing changes?**

4. **Agent outputs**:
   ```markdown
   ## Version Sizing Recommendation

   **Recommended Bump**: Minor (0.4.0 → 0.5.0)

   **Reasoning**:
   - Adds new user-facing feature (version display)
   - Modifies package.json (metadata change)
   - Creates 1 new component
   - No breaking changes
   - No API changes

   **Confidence**: High

   **Alternative Consideration**:
   Could be Patch if version display is considered
   purely cosmetic, but recommend Minor due to
   version system establishment.
   ```

---

## Implementation Ideas

### Option A: Prompt Template

Create a specialized prompt for an agent:

```markdown
You are a Version Sizing Specialist. Analyze this task
and recommend SemVer bump type.

Task: [description]
Files changed: [list]
Scope: [scope]

Analyze and recommend:
- Patch (0.4.0 → 0.4.1): Bug fix, no new features
- Minor (0.4.0 → 0.5.0): New feature, backward compatible
- Major (0.4.0 → 1.0.0): Breaking change, milestone

Provide:
1. Recommendation
2. Reasoning
3. Confidence level
4. Alternative considerations
```

### Option B: Checklist System

Agent uses a decision tree:

```
Breaking changes? → Yes → MAJOR
  ↓ No
New feature? → Yes → MINOR
  ↓ No
Bug fix? → Yes → PATCH
  ↓ No
Documentation only? → Yes → PATCH
  ↓ No
(unclear) → Ask for clarification
```

### Option C: Hybrid

Combine checklist with AI analysis:
1. Run automated checks (breaking changes detector)
2. AI analyzes context and impact
3. Combine results for recommendation

---

## Benefits

1. **Consistency**: Same criteria applied to all tasks
2. **Learning**: Helps humans understand version sizing better
3. **Accuracy**: Better than gut feeling
4. **Documentation**: Reasoning is recorded

---

## Challenges

1. **AI models still not great at this** - might not be much better than humans
2. **Adds complexity** to workflow
3. **Could slow down** quick fixes if required for every change
4. **Might disagree** with human judgment → creates debate

---

## Alternatives / Simpler Approaches

### 1. Simple Guidelines Document

Instead of AI, create clear human-readable guidelines:

```markdown
## Version Bump Decision Guide

### Patch (0.4.0 → 0.4.1)
- Bug fixes
- Typo corrections
- Documentation updates
- Performance improvements (no API changes)
- Dependency updates (no breaking changes)

### Minor (0.4.0 → 0.5.0)
- New features
- New UI components
- New optional parameters
- Completed project phases
- Deprecations (but not removals)

### Major (0.4.0 → 1.0.0)
- Breaking API changes
- Removal of deprecated features
- Major system overhauls
- Milestone releases (e.g., "spell system complete")
```

### 2. Version Planning in PR Template

Add to PR template:

```markdown
## Version Impact

- [ ] Patch - Bug fix or small improvement
- [ ] Minor - New feature or enhancement
- [ ] Major - Breaking change or milestone

**Justification**: [explain]
```

Human decides during PR creation.

### 3. Monthly Version Review

Don't decide per-task, instead:
- Merge PRs without version bumps
- Monthly: Review all changes together
- Decide on cumulative version bump
- Update version once per sprint

---

## Recommendation

**Start simple, iterate if needed:**

1. **Phase 1** (now): Use simple guidelines (Alternative 1)
2. **Phase 2** (after 20-30 PRs): Review if version sizing is consistent
3. **Phase 3** (if problems arise): Consider specialized agent

Don't over-engineer until we know it's actually a problem.

---

## Example Guidelines Document

Could create: `docs/VERSION-BUMP-GUIDELINES.md`

With clear examples:
- ✅ This is a patch
- ✅ This is a minor
- ✅ This is a major

Based on real examples from the project.

---

## Next Steps

**For now:**
1. ✅ Add to roadmap (document exists)
2. ⏸️ Wait and see if version sizing becomes problematic
3. 📋 Track version decisions in CHANGELOG
4. 📊 Review in 3 months: Are we consistent?

**If inconsistency emerges:**
1. Create VERSION-BUMP-GUIDELINES.md with clear rules
2. Add checklist to PR template
3. Only then consider specialized review agent

---

**Status**: Documented concept, parked for future consideration
