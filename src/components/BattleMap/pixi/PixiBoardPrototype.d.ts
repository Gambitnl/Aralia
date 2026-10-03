/**
 * @file PixiBoardPrototype.tsx
 * Dev-flag harness (?pixiboard=1) that feeds live combat state into the
 * PixiBattleBoard prototype. Mirrors BattleMap's visibility bridge so fog
 * matches the DOM board exactly. Display only — see the next-gen combat map
 * spec, migration step 1.
 */
import React from 'react';
type BattleMapLikeProps = React.ComponentProps<typeof import('../BattleMap').default>;
declare const PixiBoardPrototype: React.FC<BattleMapLikeProps>;
export default PixiBoardPrototype;
