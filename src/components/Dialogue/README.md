# Dialogue Pane

This component provides a structured interface for player-NPC conversations, replacing or augmenting the open-ended AI chat with defined topic choices, skill checks, and knowledge tracking.

## Features

- **Topic Selection**: Displays a list of available topics based on player knowledge and NPC willingness.
- **Skill Checks**: Integrates social skill checks (Persuasion, Intimidation, etc.) directly into the dialogue flow.
- **Knowledge Gating**: Hides topics the NPC doesn't know or the player hasn't unlocked.
- **History**: Shows the last response from the NPC.

## Usage

This component is managed by `GameModals.tsx`. It appears when `gameState.isDialoguePaneVisible` is true.

```tsx
<DialoguePane
  isOpen={gameState.isDialoguePaneVisible}
  session={gameState.activeDialogueSession}
  npc={NPCS[gameState.activeDialogueSession?.npcId]}
  onClose={() => dispatch({ type: 'END_DIALOGUE' })}
  onSelectTopic={(topicId) => dispatch({ type: 'SELECT_TOPIC', payload: { topicId } })}
/>
```

## Architecture

- **State**: `DialogueSession` in `GameState` tracks discussed topics and session-specific modifiers.
- **Service**: `dialogueService.ts` handles the logic for topic availability (`getAvailableTopics`) and outcome processing (`processTopicSelection`).
- **Reducer**: `dialogueReducer.ts` handles state transitions.
