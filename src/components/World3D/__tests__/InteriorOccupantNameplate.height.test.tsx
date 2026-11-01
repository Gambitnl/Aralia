import React from 'react';
import {act,render,screen} from '@testing-library/react';
import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {BuildingOccupantRender} from '@/systems/world3d/types';
const sample=vi.hoisted(()=>({frames:[] as Array<()=>void>,anchors:[] as any[],receive:null as null|((body:{radiusM:number;heightM:number})=>void)}));
vi.mock('@react-three/fiber',()=>({useFrame:(frame:()=>void)=>sample.frames.push(frame)}));
vi.mock('@react-three/drei',async()=>{
 const React=await import('react'),{Group}=await import('three');
 return {Html:(props:{children?:React.ReactNode;position?:[number,number,number];onUpdate?:(group:any)=>void})=>{
  const group=React.useMemo(()=>{const g=new Group();g.position.fromArray(props.position??[0,0,0]);sample.anchors.push(g);return g;},[]);
  React.useLayoutEffect(()=>props.onUpdate?.(group),[props.onUpdate,group]);return <div>{props.children}</div>;
 }};
});
vi.mock('../OccupantFigure',()=>({default:(props:{onBodySpace?:(body:{radiusM:number;heightM:number})=>void})=>{sample.receive=props.onBodySpace??null;return null;}}));
import {InteriorOccupantActor,InteriorOccupantNameplate} from '../InteriorOccupants';
const occupant={id:145,name:'Faelan Ironsmith',householdMemberId:'b54:spouse',ageBand:'elder',body:{},stationsByHour:[]} as unknown as BuildingOccupantRender;
beforeEach(()=>{sample.frames.length=0;sample.anchors.length=0;sample.receive=null;});
describe('physical resident label height',()=>{
 it('anchors above the measured elder rather than a fixed tall figure',()=>{
  render(<InteriorOccupantNameplate occupant={occupant} readHeight={()=>1.68}/>);
  act(()=>sample.frames.at(-1)!());expect(sample.anchors[0].position.y).toBeCloseTo(1.83);
 });
 it('follows a smaller body and returns to the legacy fallback only while measurement is unavailable',()=>{
  let height:number|undefined=1.68;
  render(<InteriorOccupantNameplate occupant={occupant} readHeight={()=>height}/>);
  act(()=>sample.frames.at(-1)!());height=.9;act(()=>sample.frames.at(-1)!());expect(sample.anchors[0].position.y).toBeCloseTo(1.05);
  for(const unknown of [undefined,NaN,Infinity,-1]){height=unknown;act(()=>sample.frames.at(-1)!());expect(sample.anchors[0].position.y).toBe(2.15);}
 });
 it('uses the actual actor body callback without granting a missing contact action',()=>{
  const figure={key:'675:b54:spouse',occ:occupant,placement:{gx:0,gz:0,rotationY:0,doorZSign:-1},frame:{widthFt:20,depthFt:20},surfaceY:0,doorPosition:{x:0,y:0,z:0}} as React.ComponentProps<typeof InteriorOccupantActor>['figure'];
  render(<InteriorOccupantActor figure={figure} clockRef={{current:20}}/>);
  act(()=>sample.receive!({radiusM:.4,heightM:1.1}));act(()=>sample.frames.at(-1)!());
  expect(sample.anchors[0].position.y).toBeCloseTo(1.25);expect(screen.getByTestId('interior-occupant-name-145')).toBeDisabled();
 });
});
