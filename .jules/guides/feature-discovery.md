# Feature Discovery Guide

How to find work and track features in Aralia.

---

## Self-Check Prompts

Ask yourself when looking for work:

> "Am I solving a real problem, or inventing work to do?"
> "Has someone else already started on this? (Check recent PRs/branches)"
> "Is this the highest-impact thing I could work on right now?"
> "Does this align with my persona's domain?"

Finding the *right* work is as important as doing the work well.

---

## Think Outside the Box (The "Everything App" Mindset)

Aralia isn't just a game - it's a **living world simulator**. When working on any feature, think expansively:

### Feature Discovery Questions

Ask yourself:
1. **What's missing?** If players can do X, shouldn't they also be able to do Y?
2. **What does this connect to?** Every feature should wire to other systems
3. **What would a tabletop DM allow?** If it's possible at a real D&D table, it should be possible here
4. **What emergent stories could this enable?** Systems create stories, not scripts

### Examples of Expansive Thinking

| If you see... | Think about adding... |
|--------------|----------------------|
| Combat exists | Wounds, trauma, reputation from victories, vengeance from enemies |
| NPCs talk | Memory of past conversations, gossip between NPCs, secrets |
| Time passes | Seasons, aging, news spreading, prices changing, opportunities expiring |
| Shops exist | Haggling, fencing stolen goods, trade routes, merchant relationships |
| Magic works | Wild magic consequences, spell research, magical item creation |

### The Web of Features

Every feature should connect to multiple others:
- Commerce → Crime (black markets, smuggling)
- Crime → Politics (corruption, bounties)
- Politics → Religion (holy wars, inquisitions)
- Religion → Planes (divine intervention, planar beings)
- Planes → Combat (extraplanar creatures, environmental effects)
- Combat → Companions (loyalty tested, relationships)

> *"If it exists in a D&D world, it should be simulatable in Aralia."*

See `docs/VISION.md` → "The Everything App Philosophy" for the full vision.

---

## Where to Find Work

### 1. TODOs in Code

```bash
# All TODOs
grep -r "TODO\|FIXME\|HACK\|XXX" src/

# TODOs for your persona
grep -r "TODO(Oracle)" src/
grep -r "TODO(Vanguard)" src/
grep -r "TODO(Hunter)" src/

# High priority
grep -r "TODO:.*\[P0\]\|TODO:.*\[P1\]" src/
```

### 2. Type Errors

```bash
# Find TypeScript issues
npm run build 2>&1 | grep "error TS"

# Find any usage
grep -r ": any" src/ --include="*.ts" --include="*.tsx"

# Find ts-ignore
grep -r "@ts-ignore\|@ts-expect-error" src/
```

### 3. Test Coverage Gaps

```bash
# Generate coverage report
npm test --coverage

# Look for uncovered files
# Focus on utils/ and hooks/ - they should have high coverage
```

### 4. Documentation

- `docs/FEATURES_TODO.md` - Feature roadmap
- `docs/VISION.md` - "Systems Needed" checklists
- GitHub Issues - If using issue tracking

### 5. Recent Changes

```bash
# What changed recently? Might need follow-up
git log --oneline -20

# Files with most recent changes
git log --pretty=format: --name-only | head -50 | sort | uniq -c | sort -rn
```

---

## For CODE GUILD Personas

### Oracle (Types)
```bash
grep -r ": any" src/
grep -r "as unknown as" src/
grep -r "@ts-ignore" src/
npm run build 2>&1 | grep "error TS"
```

### Vanguard (Tests)
```bash
# Files without tests
find src -name "*.ts" -o -name "*.tsx" | while read f; do
  test_file="${f%.ts*}.test.${f##*.}"
  [ ! -f "$test_file" ] && echo "No test: $f"
done

# Low coverage areas
npm test --coverage
```

### Gardener (Cleanup)
```bash
# Unused exports (manual review needed)
grep -r "export " src/ --include="*.ts"

# Duplicate code patterns
grep -rn "function calculate" src/
```

### Hunter (TODOs)
```bash
grep -rn "TODO\|FIXME\|HACK\|XXX" src/
```

### Bolt (Performance)
```bash
# Large components
wc -l src/components/**/*.tsx | sort -n | tail -20

# Missing memoization
grep -r "useState\|useEffect" src/ -l | xargs grep -L "useMemo\|useCallback"
```

---

## For GAMEPLAY GUILD Personas

Check `docs/VISION.md` for "Systems Needed" checkboxes under your domain:

- **Warlord**: War & Conflict section
- **Mythkeeper**: D&D Lore, ensure accuracy
- **Chronicler**: AI Narrative integration
- **Economist**: Economy & Trade section
- **Worldsmith**: World Simulation, factions

---

## Claiming Work

### Before Starting

1. **Check nobody else is working on it**
   ```bash
   git branch -a | grep [keyword]
   # Check open PRs on GitHub
   ```

2. **Create a branch**
   ```bash
   git checkout -b [persona]/[brief-description]
   ```

3. **Announce** (if relevant)
   - Add `// WIP: [Persona] working on this` comment
   - Or create draft PR

### While Working

- Commit frequently
- Keep scope focused
- If scope grows, split into multiple PRs

### When Done

- Remove WIP markers
- Create PR
- Request review if needed

---

## Prioritization

### High Priority
- Build failures
- Test failures
- `[P0]` TODOs
- Security issues (`TODO(Sentinel)`)
- Blocking bugs

### Medium Priority
- `[P1]` TODOs
- Missing test coverage for critical paths
- Type safety improvements
- Performance issues

### Low Priority
- `[P2]` TODOs
- Nice-to-have refactors
- Documentation improvements
- Code style cleanup

---

## When to Stop Looking

If you can't find meaningful work in your domain:

1. **Check adjacent domains** - Maybe help another persona
2. **Explore unfamiliar areas** - Document what you find
3. **Do nothing** - It's okay. Not every run finds work.

> "If no suitable task can be identified, stop and do not create a PR."

Don't invent busywork. Quality over quantity.

---

*Back to [_METHODOLOGY.md](../_METHODOLOGY.md)*
