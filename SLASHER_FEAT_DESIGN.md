# Design Plan: Slasher Feat Implementation

## Objective
We want to add the **Slasher** feat to the game. In "Dungeons & Dragons", a feat is a special talent or area of expertise that gives a character new capabilities. The Slasher feat is specifically for characters who use slashing weapons (like swords or axes).

## The Rules (What does it do?)
The Slasher feat has three main benefits:
1.  **Stat Boost**: It increases your Strength or Dexterity by 1 (This is already handled by the current interface).
2.  **Hamstring (Speed Reduction)**: Once per turn, when you hit a creature with slashing damage, you reduce their speed by 10 feet. This makes it harder for them to run away or chase you.
3.  **Grievous Wound (Critical Hit Effect)**: If you land a **Critical Hit** (usually rolling a "Natural 20" on the dice), the target has "Disadvantage" on their own attacks until your next turn. This means they struggle to fight back effectively because of the severe wound.

## The Problem (What was missing?)
To make this work in our digital game, we identified a few gaps in the current code:
1.  **Feat Storage**: The game knew what feats *existed*, but the combat system didn't actually know which feats the *characters currently on the map* possessed. We need to attach a list of "Owned Feats" to every combatant.
2.  **Critical Hit Awareness**: The combat engine calculated damage, but it didn't explicitly "flag" whether a hit was a Critical Hit or a normal hit. Without this flag, we couldn't trigger the special Grievous Wound effect.

## The Proposed Solution
Here is how we will build this feature, broken down into simple steps:

### 1. Character Data Update ("The ID Card")
We will update the "Combat Character" definition (think of this as the ID card the game references during battle).
-   **Change**: Add a new line to this ID card called `feats`.
-   **Result**: Now, when the game looks at "Valeros the Fighter", it sees not just his HP and Strength, but also a list: `['Slasher', 'Athlete']`.

### 2. Teaching the Engine about Critical Hits ("The Referee")
We will update the combat logic (the code that acts as the referee for attacks).
-   **Change**: When the "referee" rolls the 20-sided die for an attack, it will check if the number is a **20**.
-   **Result**: If it is a 20, the referee raises a flag saying "This is a Critical Hit!". This flag is passed down to the damage system.

### 3. Implementing the Slasher Logic ("The Special Move")
Now that the game knows *who* has the feat and *when* a crit happens, we write the specific rule:
-   **Trigger**: When damage is dealt...
    -   **Check 1**: Does the attacker have the "Slasher" feat?
    -   **Check 2**: Was the damage type "Slashing"?
    -   **Action A (Speed)**: If yes, check if we've already slowed them this turn. If not, stick a "Slowed (-10ft)" label on the enemy.
    -   **Action B (Crit)**: If the "Critical Hit" flag is raised, stick a "Disadvantage" label on the enemy.

### 4. Visual Feedback ("The Display")
Players need to know this happened.
-   **Log**: We will write a message to the combat log: *"Valeros's Slasher feat reduces the Goblin's speed!"* or *"CRITICAL HIT! The Goblin is hampered by the grievous wound!"*
-   **Icons**: We will show small icons (like a foot for speed, or a crossed sword for disadvantage) on the enemy so the player can see the effect is active.

## Summary
By connecting the **Character's Feats** to the **Combat Engine** and teaching the engine to recognize **Critical Hits**, we can automate these complex rules. The player won't have to remember to subtract speed or apply disadvantage—the game will handle it for them automatically.
