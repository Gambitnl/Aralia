# Unified Combat Messaging System

## Overview

This system enhances the combat experience by providing rich, contextual feedback through multiple presentation channels. Players receive satisfying, informative messages about combat events through visual logs, notifications, and potential audio/visual effects.

## Key Features

### 1. **Rich Message Types**
- **Damage Messages**: Detailed damage reporting with critical hit indicators
- **Combat Events**: Misses, dodges, spell casting, status effects
- **Achievements**: Level ups, killing blows, milestone celebrations
- **System Events**: Turn changes, combat entry/exit

### 2. **Multi-Channel Presentation**
- **Combat Log**: Persistent textual record of all events
- **Notifications**: Timed popups for important events
- **Visual Effects**: Planned screen flashes, particle effects
- **Audio Cues**: Planned sound feedback (future enhancement)

### 3. **Smart Prioritization**
- **Priority Levels**: Low, Medium, High, Critical
- **Filtering**: Show only messages above minimum priority
- **Grouping**: Combine similar messages to reduce clutter
- **Customization**: User-configurable display preferences

## Architecture

### Core Components

```
src/
├── types/
│   └── combatMessages.ts          # Message type definitions
├── utils/combat/
│   └── messageFactory.ts          # Message creation utilities
├── hooks/combat/
│   └── useCombatMessaging.ts      # State management hook
└── components/demo/
    └── CombatMessagingDemo.tsx    # Demonstration component
```

### Type System

The system uses a robust type hierarchy:

```typescript
CombatMessageType       // Categories of messages
MessagePriority         // Importance levels
MessageChannel          # Delivery mechanisms
CombatMessage           # Core message structure
CombatMessageData       # Type-specific payloads
```

## Implementation Status

### ✅ Completed
- [x] Core type definitions
- [x] Message factory utilities
- [x] React hook for state management
- [x] Demo component with simulation
- [x] Configuration system
- [x] Filtering capabilities

### 🚧 In Progress
- [ ] Integration with existing combat system
- [ ] Visual effects implementation
- [ ] Audio cue system
- [ ] Performance optimization

### 🔮 Future Enhancements
- [ ] Localization support
- [ ] Custom message themes
- [ ] Combat replay integration
- [ ] Statistics tracking
- [ ] Achievement system

## Usage Examples

### Basic Message Creation

```typescript
const { addDamageMessage, addKillMessage } = useCombatMessaging();

// Create a damage message
addDamageMessage({
  source: playerCharacter,
  target: enemyCharacter,
  damage: 15,
  damageType: 'slashing',
  isCritical: false,
  weaponName: 'Longsword'
});

// Create a kill message
addKillMessage({
  killer: playerCharacter,
  victim: enemyCharacter
});
```

### Configuration

```typescript
const { config, updateConfig } = useCombatMessaging();

// Adjust notification settings
updateConfig({
  enableNotifications: true,
  minimumPriority: 'medium',
  notificationDuration: 5000
});
```

### Filtering

```typescript
const { messages, updateFilters } = useCombatMessaging();

// Show only high-priority messages
updateFilters({
  priorities: ['high', 'critical']
});

// Filter by message type
updateFilters({
  types: [CombatMessageType.DAMAGE_DEALT, CombatMessageType.KILLING_BLOW]
});
```

## Integration Points

### Combat System Hook
The messaging system integrates with `useTurnManager` to automatically generate messages for:
- Attack results
- Spell casting
- Status effect application
- Combat state changes

### Notification System
Existing `NotificationSystem` component can be enhanced to:
- Display combat-specific notifications
- Use appropriate styling based on message priority
- Handle timed dismissals automatically

### Combat Log Component
The `CombatLog` component can be upgraded to:
- Show categorized messages with color coding
- Provide filtering controls
- Support search functionality
- Enable message grouping

## Benefits

### Player Experience
- **Increased Engagement**: Satisfying feedback for combat actions
- **Better Understanding**: Clear indication of what's happening
- **Strategic Awareness**: Information needed for tactical decisions
- **Emotional Investment**: Celebration of achievements and milestones

### Development Advantages
- **Centralized Logic**: Single source of truth for combat messaging
- **Extensible Design**: Easy to add new message types
- **Consistent Formatting**: Template-based message generation
- **Performance Optimized**: Efficient rendering and filtering

## Testing

### Automated Tests
- Unit tests for message creation functions
- Integration tests for hook behavior
- Performance benchmarks for large message sets

### Manual Testing
- Combat encounter simulations
- Edge case validation
- User experience evaluation
- Accessibility compliance

## Performance Considerations

- **Virtual Scrolling**: For large combat logs
- **Message Batching**: Reduce re-renders
- **Memory Management**: Automatic cleanup of old messages
- **Efficient Filtering**: Computed values with proper memoization

## Accessibility

- **Screen Reader Support**: Proper ARIA labels
- **Keyboard Navigation**: Tab-friendly interfaces
- **Reduced Motion**: Respects user preferences
- **Color Contrast**: Sufficient contrast ratios

## Future Roadmap

### Short Term (1-2 months)
- Full combat system integration
- Visual effects implementation
- Audio cue system
- Performance optimization

### Medium Term (3-6 months)
- Localization support
- Advanced filtering options
- Combat statistics tracking
- Achievement system integration

### Long Term (6+ months)
- Combat replay system
- Custom theme support
- Community message sharing
- AI-powered narrative enhancement

## Contributing

### Adding New Message Types

1. Add the type to `CombatMessageType` enum
2. Create appropriate data interface extending `BaseMessageData`
3. Add template to message factory
4. Update the hook with creation function
5. Add UI support in relevant components

### Extending Channels

1. Add new channel to `MessageChannel` enum
2. Update message factory to include channel in appropriate messages
3. Implement presentation logic in target component
4. Add configuration options

## Support

For questions or issues with the combat messaging system:
- Check the implementation documentation
- Review existing message types and examples
- Consult the type definitions for API reference
- Test with the demo component first