# Effective Prompting for Stitch

This guide provides instructions for crafting effective prompts to design and refine your app with Stitch.

## Starting Your Project

Choose to start with a broad concept or specific details. For complex apps, start high-level and then drill down screen by screen.

### High-Level vs. Detailed Prompts

**High-Level:**
> An app for marathon runners.

**Detailed (Better):**
> An app for marathon runners to engage with a community, find partners, get training advice, and find races near them.

### Set the Vibe with Adjectives

Use adjectives to define the app's feel (influences colors, fonts, imagery).

**Examples:**
> A vibrant and encouraging fitness tracking app.

> A minimalist and focused app for meditation.

## Refining Your App

Stitch performs best with clear, specific instructions. Focus on one screen/component at a time.

### Be Specific

| Do | Don't |
|----|-------|
| "Change the primary CTA button on the login screen to be larger and use brand blue" | "Make the button bigger" |
| "Product detail page for Japandi-styled tea store, neutral colors, black buttons" | "A product page" |

### Target Specific Elements

- **Screen**: "On the 'Team' page..."
- **Component**: "...the image of 'Dr. Carter (Lead Dentist)'..."
- **Action**: "...update her lab coat to black."

## Controlling App Theme

### Colors

**Specific:** "Change primary color to forest green."

**Mood-Based:** "Update theme to a warm, inviting color palette."

### Fonts & Borders

**Font:** "Use a playful sans-serif font." OR "Change headings to a serif font."

**Borders:** "Make all buttons have fully rounded corners." OR "Give input fields a 2px solid black border."

**Combined:**
> Book discovery app: serif font for text, light green brand color for accents.

## Modifying Images

### Be Specific When Changing Images

**General:** "Change background of all product images on landing page to light taupe."

**Specific:**
> On 'Team' page, image of 'Dr. Carter (Lead Dentist)': update her lab coat to black.

### Coordinate with Theme Changes

> Update theme to light orange. Ensure all images and icons match this new color scheme.

## Changing Language

> Switch all product copy and button text to Spanish.

## Pro Tips

6. **Review & Refine** - If wrong, rephrase or be more targeted
7. **HTML to React Workflow** - Stitch generates Tailwind HTML. You can then prompt me to "Convert this HTML to a modular React component system".
8. **Resource Downloading** - Use `curl -L` to download screen images or HTML from the `downloadUrl` provided in screen metadata.

## Pro Tips (Official)

- **Starting Points**: For complex apps, start with a broad prompt (e.g., "A D&D character management app") and then drill down screen-by-screen once the project structure exists.
- **Vibe & Adjectives**: Use descriptive prefixes like "vibrant and encouraging" or "minimalist and focused" to influence colors and typography.
- **Language**: You can ask Stitch to "Switch all copy to Spanish" or any other language after generation.

## Device Types

Specify `deviceType` in your API calls:
- `MOBILE` - Mobile device design
- `DESKTOP` - Desktop/web design (recommended for Aralia)
- `TABLET` - Tablet design
- `AGNOSTIC` - Device-independent design

## Model Selection

Specify `modelId` for quality tradeoffs:
- `GEMINI_3_FLASH` - Faster generation (default)
- `GEMINI_3_PRO` - Higher quality, slower
