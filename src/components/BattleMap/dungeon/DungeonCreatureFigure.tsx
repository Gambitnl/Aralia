/** Render an observed source creature through the same entity system as the party.
 * Loading appearance data never starts initiative or writes to game state. */

// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * LOCAL HELPER: This file has a small, manageable dependency footprint.
 *
 * Last Sync: 29/10/2026, 00:16:10
 * Dependents: components/BattleMap/dungeon/Dungeon3DPreview.tsx
 * Imports: 8 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import {adaptCreatureMaterials,adaptWaterMaterials} from '../characters/characterActor/creatureMaterials';
import {loadMonstersData} from '../../../data/monsters';
import type {MonsterData} from '../../../types/ui';
import {generateEntityBlueprint} from '../../../systems/entities3d/generateEntityBlueprint';
import {registerAllParts} from '../../../systems/entities3d/parts';
import {heightM} from '../../../systems/entities3d/types';
import {EntityModel} from '../characters/characterActor/EntityModel';
import {dungeonCreatureRecipe,usesProceduralDungeonWater,type DungeonCreatureActor} from './dungeonCreatureActors';

registerAllParts();

export function DungeonCreatureFigure({actor,cellFeet}:{actor:DungeonCreatureActor;cellFeet:number}){
  const [monster,setMonster]=useState<MonsterData>();
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let alive=true;setMonster(undefined);setFailed(false);
    // Reuse the lazy registry promise. Never import the multi-MB bestiary into
    // the synchronous dungeon generator or build a replacement encounter.
    loadMonstersData().then(data=>{if(alive){setMonster(data[actor.monsterKey]);setFailed(!data[actor.monsterKey]);}},
      ()=>{if(alive)setFailed(true);});
    return ()=>{alive=false;};
  },[actor.monsterKey]);
  const blueprint=useMemo(()=>{
    const recipe=monster?dungeonCreatureRecipe(monster,actor.eventId):null;
    return recipe?generateEntityBlueprint(recipe):null;
  },[monster,actor.eventId]);
  const animTimeRef=useRef(0);
  useFrame((_state,delta)=>{animTimeRef.current+=delta;});
  const unitsPerMeter=1/(cellFeet*0.3048);
  const proceduralWater=monster?usesProceduralDungeonWater(monster):false;
  return <group position={[actor.position.x,0.015,actor.position.z]} name={`dungeon-creature:${actor.eventId}`}>
    {blueprint?<group scale={unitsPerMeter}><EntityModel blueprint={blueprint} animState="idle"
      animTimeRef={animTimeRef} bodyTech={proceduralWater?'segments':undefined}
      adaptMaterials={proceduralWater?adaptWaterMaterials:adaptCreatureMaterials}/></group>:null}
    <Html position={[0,blueprint?heightM(blueprint.frame)*unitsPerMeter+0.8:1.8,0]} center distanceFactor={13} occlude style={{pointerEvents:'none'}} zIndexRange={[0,0]}>
      <span data-testid="dungeon-creature-marker" className="whitespace-nowrap rounded border border-rose-300/50 bg-stone-950/85 px-2 py-0.5 text-[10px] text-rose-100">
        {monster?.name??actor.monsterKey.replace(/_/g,' ')}{!blueprint?(failed||monster?' · appearance unavailable':' · loading appearance'):''}
      </span>
    </Html>
  </group>;
}
