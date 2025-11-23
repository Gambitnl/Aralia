# Guide: Adding or Updating a Spell

This guide outlines the streamlined process for adding a new spell to the Aralia RPG application or updating an existing one. This new workflow uses a single, unified prompt, and the AI assistant handles all the necessary file creation, updates, and system integrity checks.

## The Simplified Prompt System

The new process is designed to be as simple as possible for you. You no longer need to know if a spell already exists, manually enter the name multiple times, or worry about linking glossary terms. Your role is to provide the definitive source of information (the spell card image) and the AI will handle the complete implementation.

### The Unified Prompt Template

Use the following template for all spell addition or update requests.

```
Here is the spell card for [Spell Name]. Please add or update it in the game.

`[Attach screenshot(s) of the spell card here]`
```

*Optionally, you can simplify it even further if the spell name is very clear in the image:*
```
Here is the spell card. Please implement it.

`[Attach screenshot(s) of the spell card here]`
```

### AI Responsibilities

Upon receiving this prompt, the AI assistant will now automatically handle the following:

1.  **Infer Spell Name & ID**: Analyze the image to determine the spell's name and create the corresponding kebab-case file ID.
2.  **Check for Existence**: Determine if files for the spell already exist to perform an update, or if new files need to be created.
3.  **Populate Data File**: Create or update `public/data/spells/[spell-id].json` to match the new structured JSON format, using the provided image for all values. This includes correctly normalizing the `classes` array by including both the base class and any subclass-specific callouts, as long as the subclass is on the official list in the **<span data-term-id="spell_data_creation_guide" class="glossary-term-link-from-markdown">Spell Data Creation Guide</span>**.
4.  **Populate Glossary Entry**: Create or update `public/data/glossary/entries/spells/[spell-id].md`.
5.  **Auto-Link `seeAlso`**: Intelligently scan the spell's description and tags, cross-reference them with the existing glossary, and automatically populate the `seeAlso` array in the frontmatter with relevant term IDs.
6.  **Integrate with Classes**: Update `src/data/classes/index.ts` to add the spell ID to the spell lists for all appropriate classes mentioned on the spell card.
7.  **Run System Integrity Scripts**: If new files are created, the AI will handle the equivalent of running scripts to update the `spells_manifest.json` and regenerate the glossary indexes.

This new workflow makes adding and maintaining the game's spell list more efficient and less prone to manual error.
