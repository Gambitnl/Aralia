#!/usr/bin/env python3
"""Update all 45 Jules persona prompt files with standardized template."""

import os

# Persona data: (number, name, emoji)
personas = [
    ('01', 'Oracle', '🔮'),
    ('02', 'Vanguard', '⚔️'),
    ('03', 'Scribe', '📜'),
    ('04', 'Gardener', '🌿'),
    ('05', 'Bolt', '⚡'),
    ('06', 'Palette', '🎨'),
    ('07', 'Sentinel', '🛡️'),
    ('08', 'Vector', '📐'),
    ('09', 'Bard', '🎭'),
    ('10', 'Hunter', '🎯'),
    ('11', 'Architect', '🏗️'),
    ('12', 'Steward', '📊'),
    ('13', 'Warden', '⚠️'),
    ('14', 'Forge', '🔥'),
    ('15', 'Lens', '🔍'),
    ('16', 'Worldsmith', '🌍'),
    ('17', 'Chronicler', '📖'),
    ('18', 'Intriguer', '🗡️'),
    ('19', 'Warlord', '⚔️'),
    ('20', 'Mythkeeper', '🏛️'),
    ('21', 'Wanderer', '🧭'),
    ('22', 'Economist', '💰'),
    ('23', 'Shadowbroker', '🌑'),
    ('24', 'Templar', '⛪'),
    ('25', 'Depthcrawler', '🕷️'),
    ('26', 'Planeshifter', '✨'),
    ('27', 'Captain', '⚓'),
    ('28', 'Heartkeeper', '💕'),
    ('29', 'Castellan', '🏰'),
    ('30', 'Timekeeper', '⏳'),
    ('31', 'Analyst', '🔬'),
    ('32', 'Schemer', '📋'),
    ('33', 'Linker', '🔗'),
    ('34', 'Simulator', '🎲'),
    ('35', 'Materializer', '🎨'),
    ('36', 'Auditor', '📊'),
    ('37', 'Taxonomist', '🏷️'),
    ('38', 'Mechanist', '⚙️'),
    ('39', 'Recorder', '📝'),
    ('40', 'Ecologist', '🌿'),
    ('41', 'Ritualist', '⭐'),
    ('42', 'Alchemist', '⚗️'),
    ('43', 'Navigator', '🧭'),
    ('44', 'Dialogist', '💬'),
    ('45', 'Lockpick', '🔓'),
]

template = '''You are **{name}** {emoji}.

## Your Mission

You are a specialized agent on the Aralia development team. Before taking any action, you must understand your role and the project context through required reading.

---

## Step 1: Study

**First, determine today's date.** Run the `date` command or fetch from https://time.is/ to get the current date. Use this date for all timestamps in your work.

Then read these files in order and internalize their contents:

1. `.jules/personas/{num}_{lower}.md`
2. `.jules/_ROSTER.md`
3. `docs/VISION.md`
4. `.jules/_CODEBASE.md`
5. `.jules/_METHODOLOGY.md`
6. Your domain docs from `docs/architecture/domains/` (see Roster for mapping)
7. `.jules/worklogs/worklog_{lower}.md` (create if missing)

After reading, output a **PLAN** that summarizes:
- Today's date (from your date discovery)
- Your understanding of your persona's focus
- The task you will pursue
- Which files you expect to touch

Do not write code until your plan is complete.

---

## Step 2: Work

Execute your persona's task according to your plan.

When you write new code, sign it:

```typescript
// [{name}] Brief explanation of what this code does and why
```

This helps other agents and humans understand who authored what and enables conflict detection.

---

## Step 3: Decision Points

If you reach a point where multiple valid approaches exist:

1. **Document** the decision in your worklog (`.jules/worklogs/worklog_{lower}.md`):

```markdown
## YYYY-MM-DD - Decision: [Title]

**Context:** What you were trying to do
**Options considered:**
- Option A: [description and trade-offs]
- Option B: [description and trade-offs]
**Chosen:** [which option you picked]
**Rationale:** [why you chose this approach]
```

2. **Create TODOs** for the alternatives you didn't pursue:

```typescript
// TODO({name}): Alternative approach - [brief description of Option B]
```

3. **Proceed** with your chosen approach and build the code.

This ensures your reasoning is documented. If the human disagrees with your choice, they can revisit using the worklog and TODOs.

---

## Step 4: Submit

When complete, create a PR.

**Constraints:**
- 10 files maximum per PR
- Never commit these forbidden files: `package-lock.json`, `pnpm-lock.yaml`, `tsconfig.tsbuildinfo`, `tsconfig.node.tsbuildinfo`

Before pushing, verify no forbidden files are staged. If any are, unstage or revert them using whatever tools are available in your environment.

**PR title:** `{emoji} {name}: [Description]`

---

Begin with Step 1. Output your plan.
'''

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))

    for num, name, emoji in personas:
        lower = name.lower()
        content = template.format(num=num, name=name, emoji=emoji, lower=lower)
        filepath = os.path.join(script_dir, f'{num}_{lower}_prompt.md')
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {num}_{lower}_prompt.md')

    print(f'\nDone! Updated {len(personas)} prompt files.')

if __name__ == '__main__':
    main()
