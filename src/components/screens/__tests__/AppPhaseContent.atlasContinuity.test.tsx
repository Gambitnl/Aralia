/** Returning to the map releases render objects without erasing earned Local presence. */
import React from 'react';
import {describe, expect, it, vi} from 'vitest';
import {AppPhaseContent} from '../AppPhaseContent';
import {createMockGameState} from '../../../utils/core/factories';
import {GamePhase} from '../../../types';

vi.mock('../index',()=>({MainMenuScreen:()=>null,CharacterCreatorScreen:()=>null,BattleScreen:()=>null,PlayingScreen:()=>null}));

describe('native Atlas return continuity',()=>{
  it('releases only the transient artifact carrier after ground unmounts',()=>{
    const dispatch=vi.fn(),setAtlasGroundDrilldown=vi.fn();
    const props={
      gameState:createMockGameState({phase:GamePhase.PLAYING,party:[{id:'earned-traveler'} as never]}),dispatch,
      preferences:{},characterEntry:{},atlasRuntime:{setAtlasGroundDrilldown,safeWorldViewMode:'atlas'},
      atlasEntry:{},worldGeneration:{},developerMenu:{},initialization:{},
    } as unknown as React.ComponentProps<typeof AppPhaseContent>;
    const screen=AppPhaseContent(props) as React.ReactElement<{onAtlasRestored:()=>void}>;
    screen.props.onAtlasRestored();
    expect(setAtlasGroundDrilldown).toHaveBeenCalledExactlyOnceWith(null);
    // Compact address and matching meters belong to the saved journey, even
    // while the player is looking at its map instead of the ground renderer.
    expect(dispatch).not.toHaveBeenCalled();
  });
});
