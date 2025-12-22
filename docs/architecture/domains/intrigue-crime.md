# Intrigue & Crimes

## Purpose

Handles systems related to noble houses, secrets, identity management, and criminal activities (theft, smuggling, heists).

## Key Entry Points

| File | Role |
|------|------|
| `src/systems/intrigue/` | Intrigue and social systems |
| `src/systems/crime/` | Criminal systems |

## Subcomponents

- **Intrigue**: Noble house generation and secret management.
- **Crime**: Thieves' guild, smuggling, and heist mechanics.

## File Ownership

| Path | Type | Description |
|------|------|-------------|
| `src/systems/intrigue/*.ts` | Directory | Intrigue systems |
| `src/systems/crime/**/*.ts` | Directory | Criminal systems |
| `src/components/Crime/**/*.tsx` | Directory | Criminal interfaces |
| `src/components/debug/NobleHouseList.tsx` | Component | Noble debug UI |
| `src/state/reducers/crimeReducer.ts` | Reducer | Crime state |
| `src/state/reducers/identityReducer.ts` | Reducer | Identity state |
| `src/utils/nobleHouseGenerator.ts` | Utils | Noble house generation |
| `src/utils/secretGenerator.ts` | Utils | Secret generation |
| `src/utils/identityUtils.ts` | Utils | Identity/disguise helpers |
| `src/utils/securityUtils.ts` | Utils | Crime-related security |
| `src/types/crime/*.ts` | Types | Crime-related types |
| `src/types/noble.ts` | Types | Noble house types |
| `src/types/identity.ts` | Types | Identity types |

## Dependencies

### Depends On

- **[NPCs / Companions](./npcs-companions.md)**: Interactions with nobles and criminals

### Used By

- **[Town Map](./town-map.md)**: Crimes and intrigue in urban settings
- **[Submap](./submap.md)**: Secrets found in the wild

### Claimed Tests (Auto-generated)

| Test File | Description |
|-----------|-------------|
| `src/systems/intrigue/__tests__/NobleHouseGenerator.test.ts` | Noble house generator tests |
| `src/systems/intrigue/__tests__/SecretSystem.test.ts` | Secret system tests |
| `src/state/reducers/__tests__/crimeReducer.test.ts` | Crime reducer tests |
| `src/state/reducers/__tests__/crimeReducer.heist.test.ts` | Crime heist reducer tests |
