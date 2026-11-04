/** Exercise actual crossing, accepted-foot escape and geometry-checked yielding. */
import {describe,it,expect} from 'vitest';
import {clipActorStep,yieldActorStep,canActorTurn,actorCourtesySpace,actorSpaceOverlaps,type ActorBody,type ActorPoint} from '../actorPersonalSpace';
const p=(xM:number,zM=0,yM=0):ActorPoint=>({xM,zM,yM});
const body=(xM:number,zM=0,yM=0):ActorBody=>({...p(xM,zM,yM),radiusM:.3,heightM:1.8});
describe('visible actor personal space',()=>{
 it('cannot tunnel through a resident even when the requested end is clear',()=>{
  const r=clipActorStep(p(0),p(4),'player',body(0),new Map([['rosa',body(2)]]));
  expect(r.blocked).toBe(true);expect(r.xM).toBeGreaterThan(1.39);expect(r.xM).toBeLessThan(1.401);
 });
 it('keeps an idle accepted foot exactly, including an existing overlap',()=>{
  expect(clipActorStep(p(0),p(0),'player',body(0),new Map([['rosa',body(.14)]]))).toMatchObject(p(0));
 });
 it('allows gradual escape from an overlap but refuses deeper entry',()=>{
  const space=new Map([['rosa',body(.14)]]);
  expect(clipActorStep(p(0),p(-.1),'player',body(0),space)).toMatchObject({...p(-.1),blocked:false});
  expect(clipActorStep(p(0),p(.05),'player',body(0),space)).toMatchObject({...p(0),blocked:true});
 });
 it('does not collide with its own body or a person on another floor',()=>{
  expect(clipActorStep(p(0),p(4),'player',body(0),new Map([['player',body(0)],['upstairs',body(2,0,3)]]))).toMatchObject({...p(4),blocked:false});
 });
 it('stops at the nearest of several people without mutating their records',()=>{
  const space=new Map([['far',body(3)],['near',body(1)]]),before=JSON.stringify([...space]);
  expect(clipActorStep(p(0),p(4),'player',body(0),space).xM).toBeLessThan(.401);
  expect(JSON.stringify([...space])).toBe(before);
 });
 it('a removed or unmounted body leaves no invisible barrier',()=>{
  const space=new Map([['rosa',body(1)]]);space.delete('rosa');
  expect(clipActorStep(p(0),p(2),'player',body(0),space)).toMatchObject({...p(2),blocked:false});
 });
 it('walks Rosa away from the actual saved player rather than moving Sana',()=>{
  const sana={...p(467.0960797549704,538.9181882718377,3.9288164399052112),radiusM:.55,heightM:1.8};
  const rosa={...p(467.23863341974567,538.9182322537218,sana.yM),radiusM:.3,heightM:.9};
  const space=new Map([['player',sana]]),before={...sana};
  const next=yieldActorStep(rosa,rosa,'rosa',rosa,space,.1,q=>q);
  expect(Math.hypot(next.xM-sana.xM,next.zM-sana.zM)).toBeGreaterThan(.23);
  expect(Math.hypot(next.xM-rosa.xM,next.zM-rosa.zM)).toBeLessThanOrEqual(.100001);
  expect(next.yM).toBe(sana.yM);expect(sana).toEqual(before);
 });
 it('never yields through a blocked wall or invents a supported floor',()=>{
  const from=body(.14),space=new Map([['player',body(0)]]);
  expect(yieldActorStep(from,from,'rosa',from,space,.1,()=>null)).toMatchObject(from);
  expect(yieldActorStep(from,from,'rosa',from,space,.1,q=>({...q,yM:3}))).toMatchObject(from);
 });
 it('can choose a clear sideways yield when the direct retreat is blocked',()=>{
  const from=body(.14),space=new Map([['player',body(0)]]);
  const next=yieldActorStep(from,from,'rosa',from,space,.1,q=>q.xM>.15?null:q);
  expect(Math.abs(next.zM)).toBeGreaterThan(.05);expect(next.xM).toBeLessThanOrEqual(.15);
 });
 it('cannot escape an initial overlap by crossing through the other center',()=>{
  expect(clipActorStep(p(0),p(2),'player',body(0),new Map([['rosa',body(.14)]]))).toMatchObject({...p(0),blocked:true});
 });
 it('yielding never creates a new intersection with a previously clear resident',()=>{
  const from=body(.14),space=new Map([['player',body(0)],['neighbor',body(.8)]]);
  const next=yieldActorStep(from,from,'rosa',from,space,.1,q=>q);
  expect(Math.hypot(next.xM-.8,next.zM)).toBeGreaterThanOrEqual(.599);
 });

 it('clears the player reservation before relaxing an already overlapping supper cluster',()=>{
  // Actual kitchen geometry admitted these steps, but equal overlap scoring
  // stranded Rosa between Sana and two already overlapping larger residents.
  const space=new Map<string,ActorBody>([["player",{"xM":467.0960797549704,"zM":538.9181882718377,"yM":3.9288164399052112,"radiusM":0.8477984029982069,"heightM":1.8451851610227348}],["resident:675:b54:spouse",{"xM":467.2773612085703,"yM":3.9288164399052112,"zM":540.1477141584976,"radiusM":0.4527326685697125,"heightM":1.6803597159037293}],["resident:675:b54:head",{"xM":466.2370628625559,"yM":3.9288164399052112,"zM":539.771682378572,"radiusM":0.4317255631350139,"heightM":1.6546067448194393}],["resident:675:b54:child:1",{"xM":467.83869687939784,"yM":3.9288164399052112,"zM":536.535246428252,"radiusM":0.29978844504399804,"heightM":1.1636876163001384}],["resident:675:b54:lodger:0",{"xM":467.9606848427036,"yM":3.9288164399052112,"zM":539.0050169152214,"radiusM":0.26057380705471983,"heightM":0.8665490878311264}],["resident:675:b54:lodger:1",{"xM":468.42708432641604,"yM":3.9288164399052112,"zM":539.8257451899146,"radiusM":1.056209700577446,"heightM":1.8490369956629324}],["resident:675:b54:lodger:2",{"xM":468.23808098289123,"yM":3.9288164399052112,"zM":538.3177475492263,"radiusM":0.7679150298885071,"heightM":2.00919696955844}],["resident:675:b54:lodger:3",{"xM":469.3540313352445,"yM":3.999609279267373,"zM":540.3889534452042,"radiusM":0.623905303994135,"heightM":1.3433790447774188}],["resident:675:b54:lodger:4",{"xM":469.41009190294324,"yM":3.9288164399052112,"zM":539.3112086018962,"radiusM":0.45497823808907706,"heightM":1.7052911251896434}],["resident:675:b54:lodger:5",{"xM":469.11011477832926,"yM":3.9288164399052112,"zM":538.238514900284,"radiusM":0.65787008755369,"heightM":1.463052574444168}],["resident:675:b54:lodger:8",{"xM":466.746495042732,"yM":3.9288164399052112,"zM":537.1568949044697,"radiusM":0.509846551878239,"heightM":1.6819034897158307}]]);
  const key='resident:675:b54:lodger:0',from=space.get(key)!,player=space.get('player')!;
  const next=yieldActorStep(from,from,key,from,space,.12,q=>q);
  expect(Math.hypot(next.xM-player.xM,next.zM-player.zM)).toBeGreaterThan(Math.hypot(from.xM-player.xM,from.zM-player.zM)+.01);
  expect(next.yM).toBe(from.yM);
 });

});


describe('measured oriented body space',()=>{
 const shape=(xM:number,zM=0,yawRad=0)=>({...body(xM,zM),radiusM:Math.hypot(.6,.15),footprint:{minXM:-.6,maxXM:.6,minZM:-.15,maxZM:.15,yawRad}});
 it('passes a parallel body through clear space inside the old circular margins',()=>{
  const from=shape(0),other=shape(1,.7);
  expect(clipActorStep(from,p(2),'player',from,new Map([['neighbor',other]]))).toMatchObject({...p(2),blocked:false});
 });
 it('sweeps the entire oriented box and stops before an actual body',()=>{
  const from=shape(0),other=shape(2);
  const next=clipActorStep(from,p(4),'player',from,new Map([['neighbor',other]]));
  expect(next.blocked).toBe(true);expect(next.xM).toBeGreaterThan(.798);expect(next.xM).toBeLessThan(.801);
 });
 it('keeps asymmetric tail space at its measured location around the feet',()=>{
  const from={...shape(0),radiusM:1.22,footprint:{minXM:-.2,maxXM:.2,minZM:-1.2,maxZM:.2,yawRad:0}},other={...shape(0,-2),radiusM:.3,footprint:{minXM:-.2,maxXM:.2,minZM:-.2,maxZM:.2,yawRad:0}};
  const next=clipActorStep(from,p(0,-4),'player',from,new Map([['neighbor',other]]));
  expect(next.blocked).toBe(true);expect(next.zM).toBeLessThan(-.598);expect(next.zM).toBeGreaterThan(-.601);
 });
 it('uses the measured facing rather than a world-axis box',()=>{
  const from=shape(0,0,Math.PI/2),other=shape(1);
  const next=clipActorStep(from,p(2),'player',from,new Map([['neighbor',other]]));
  expect(next.blocked).toBe(true);expect(next.xM).toBeGreaterThan(.248);expect(next.xM).toBeLessThan(.251);
 });
 it('removes the recorded kitchen circle refusal without removing any measured body',()=>{
  const bodies=[{"key":"player","xM":468.03945494011845,"yM":3.9288164399052112,"zM":538.7882787901286,"radiusM":0.6477984029982068,"heightM":1.8451851610227348,"footprint":{"minXM":-0.4480394556534125,"maxXM":0.4480394556534125,"minZM":-0.4678711543842181,"maxZM":0.2653799355030061,"yawRad":0}},{"key":"resident:675:b54:spouse","xM":470.0331226494602,"yM":3.9288164399052112,"zM":535.9283957938661,"radiusM":0.4527326685697125,"heightM":1.6803912219402823,"footprint":{"minXM":-0.3864591419696809,"maxXM":0.3864591419696809,"minZM":-0.17390568554401398,"maxZM":0.23583087325096125,"yawRad":0.27246314941259214}},{"key":"resident:675:b54:head","xM":468.1797401406417,"yM":3.9288164399052112,"zM":535.4905316279547,"radiusM":0.4317255631350139,"heightM":1.654637816033869,"footprint":{"minXM":-0.3632361590862274,"maxXM":0.3632361590862274,"minZM":-0.1577236205339432,"maxZM":0.2333376407623291,"yawRad":0.27246314941259214}},{"key":"resident:675:b54:child:0","xM":466.9992723337873,"yM":3.9288164399052112,"zM":538.9368779926892,"radiusM":0.2873842226073395,"heightM":1.1211597703624712,"footprint":{"minXM":-0.22647678036918567,"maxXM":0.22647678036918567,"minZM":-0.08404703438282013,"maxZM":0.17691229283809665,"yawRad":0.27246314941259214}},{"key":"resident:675:b54:child:1","xM":467.2767879556114,"yM":3.9288164399052112,"zM":539.6471098667895,"radiusM":0.2997884450439982,"heightM":1.1637024056465597,"footprint":{"minXM":-0.2369803558880195,"maxXM":0.2369803558880195,"minZM":-0.08907305449247359,"maxZM":0.18361215293407449,"yawRad":0.27246314941259214}},{"key":"resident:675:b54:lodger:0","xM":468.3362040333667,"yM":3.9288164399052112,"zM":536.2369051625575,"radiusM":0.26057380705471983,"heightM":0.8664061246839205,"footprint":{"minXM":-0.22591994702816012,"maxXM":0.22591994702816012,"minZM":-0.09523689001798631,"maxZM":0.1298417747020722,"yawRad":0.27246314941259214}},{"key":"resident:675:b54:lodger:1","xM":469.22889919528245,"yM":3.9288164399052112,"zM":537.2097742936124,"radiusM":1.0591785590906357,"heightM":1.8490713574371984,"footprint":{"minXM":-0.4481370582621408,"maxXM":0.4481370582621408,"minZM":-0.9597043279309881,"maxZM":0.24198496341705317,"yawRad":0.27246314941259214}},{"key":"resident:675:b54:lodger:2","xM":467.375876026017,"yM":3.9288164399052112,"zM":536.675606494319,"radiusM":0.7679150298885072,"heightM":2.0092059702281215,"footprint":{"minXM":-0.6134978532791134,"maxXM":0.6134978532791134,"minZM":-0.26313635706901556,"maxZM":0.4618591529358126,"yawRad":0.27246314941259214}},{"key":"resident:675:b54:lodger:3","xM":466.46507735581457,"yM":3.9288164399052112,"zM":537.7280879582108,"radiusM":0.623905303994135,"heightM":1.343481911585867,"footprint":{"minXM":-0.5201029181480407,"maxXM":0.5201029181480407,"minZM":-0.21422524750232697,"maxZM":0.34460235473064627,"yawRad":0.27246314941259214}},{"key":"resident:675:b54:lodger:4","xM":465.42070196598956,"yM":3.9288164399052112,"zM":537.4537125054084,"radiusM":0.45497823808907706,"heightM":1.705261536034878,"footprint":{"minXM":-0.38670018315315247,"maxXM":0.38670018315315247,"minZM":-0.17251266539096832,"maxZM":0.23972518742084495,"yawRad":0.27246314941259214}},{"key":"resident:675:b54:lodger:8","xM":466.24558486235753,"yM":3.9288164399052112,"zM":539.1977473891111,"radiusM":0.509846551878239,"heightM":1.68196737015095,"footprint":{"minXM":-0.4492839872837067,"maxXM":0.4492839872837067,"minZM":-0.21236450970172882,"maxZM":0.2410132884979248,"yawRad":0.27246314941259214}}],space=new Map(bodies.map(b=>[b.key,b])),from=space.get('player')!;
  const goal={"xM":467.9194549401185,"yM":3.9288164399052112,"zM":538.7882787901286};
  expect(clipActorStep(from,goal,'player',from,space)).toMatchObject({...goal,blocked:false});
 });

 it('checks a rotation arc even when both endpoint poses are clear',()=>{
  const from={...body(0),radiusM:Math.hypot(1,.05),footprint:{minXM:-1,maxXM:1,minZM:-.05,maxZM:.05,yawRad:-Math.PI/4}};
  const other={...body(1.05),radiusM:Math.hypot(.1,.1),footprint:{minXM:-.1,maxXM:.1,minZM:-.1,maxZM:.1,yawRad:0}};
  expect(canActorTurn(from,'player',from,Math.PI/4,new Map([['neighbor',other]]))).toBe(false);
 });
 it('refuses a turn whose rotating body would sweep through a neighbor',()=>{
  const from=shape(0),other=shape(.7,.7);
  expect(canActorTurn(from,'player',from,Math.PI/2,new Map([['neighbor',other]]))).toBe(false);
  expect(canActorTurn(from,'player',from,Math.PI/2,new Map())).toBe(true);
 });
});


describe('neighbors make room before physical contact',()=>{
 const square=(xM:number):ActorBody=>({...body(xM),footprint:{minXM:-.3,maxXM:.3,minZM:-.3,maxZM:.3,yawRad:0}});
 const lane=(q:ActorPoint)=>Math.abs(q.zM)<1e-8?q:null;
 it('passes yielding pressure along a clear line without admitting a new body overlap',()=>{
  const a={...square(.7),yielding:true},b=square(1.35),space=new Map<string,ActorBody>([['player',square(0)],['a',a],['b',b]]);
  const soft=actorCourtesySpace(space);
  const first=yieldActorStep(a,a,'a',a,soft,.12,lane,space);
  expect(first.xM).toBeGreaterThan(.74);expect(first.xM).toBeLessThan(.751);
  space.set('a',{...a,...first});
  const second=yieldActorStep(b,b,'b',b,actorCourtesySpace(space),.12,lane,space);
  expect(second.xM).toBeGreaterThan(b.xM+.09);
  space.set('b',{...b,...second});
  const third=yieldActorStep(first,a,'a',space.get('a')!,actorCourtesySpace(space),.12,lane,space);
  expect(third.xM).toBeGreaterThan(.8);
  expect(actorSpaceOverlaps(third,'a',space.get('a')!,space)).toBe(false);
 });
 it('keeps an unpressured neighbor at their station and does not mutate actual bounds',()=>{
  const a=square(.7),b=square(1.35),space=new Map([['a',a],['b',b]]),before=JSON.stringify([...space]);
  expect(yieldActorStep(b,b,'b',b,actorCourtesySpace(space),.12,lane,space)).toMatchObject(b);
  expect(JSON.stringify([...space])).toBe(before);
 });
 it('never turns a soft comfort overlap into a new physical intersection',()=>{
  const a={...square(.7),yielding:true},b=square(1.35),space=new Map<string,ActorBody>([['player',square(0)],['a',a],['b',b]]);
  const next=yieldActorStep(a,a,'a',a,actorCourtesySpace(space),.12,lane,space);
  expect(next.xM).toBeLessThanOrEqual(.75);
  expect(actorSpaceOverlaps(next,'a',a,new Map([['b',b]]))).toBe(false);
 });
 it('asks the recorded clear hall neighbor to yield while keeping every measured body',()=>{
  // Native hallway survey: lodger0 is physically clear and receives no player
  // reservation, while lodgers1/2 cannot finish clearing the player beside it.
  const space=new Map<string,ActorBody>([["player",{"xM":467.44910625494174,"zM":537.5862630068004,"yM":3.9288164399052112,"radiusM":0.6477984029982068,"heightM":1.8451851610227348,"footprint":{"minXM":-0.4480394556534126,"maxXM":0.4480394556534126,"minZM":-0.4678711543842182,"maxZM":0.2653799355030061,"yawRad":-2.356194490192345}}],["resident:675:b54:spouse",{"xM":469.38850106661016,"yM":3.9288164399052112,"zM":536.4186873389493,"radiusM":0.4527326685697123,"heightM":1.6803950443552038,"footprint":{"minXM":-0.3864591419696809,"maxXM":0.3864591419696809,"minZM":-0.17390568554401398,"maxZM":0.23583087325096125,"yawRad":1.8432594762089332}}],["resident:675:b54:child:0",{"xM":467.23863341974567,"yM":3.9288164399052112,"zM":538.9182322537218,"radiusM":0.2873842226073396,"heightM":1.121200082158131,"footprint":{"minXM":-0.2264767803691858,"maxXM":0.22647678036918584,"minZM":-0.08404703438282023,"maxZM":0.1769122928380967,"yawRad":0.2724631494125922}}],["resident:675:b54:child:1",{"xM":467.40267954541685,"yM":3.9288164399052112,"zM":539.5053447034725,"radiusM":0.29978844504399804,"heightM":1.16376998075095,"footprint":{"minXM":-0.23698035588801947,"maxXM":0.23698035588801947,"minZM":-0.08907305449247359,"maxZM":0.1836121529340743,"yawRad":0.2724631494125922}}],["resident:675:b54:lodger:0",{"xM":468.42580932914854,"yM":3.9288164399052112,"zM":536.2955611300864,"radiusM":0.26057380705471983,"heightM":0.8664941460505489,"footprint":{"minXM":-0.22591994702816012,"maxXM":0.22591994702816012,"minZM":-0.09523689001798631,"maxZM":0.1298417747020722,"yawRad":0.2724631494125922}}],["resident:675:b54:lodger:1",{"xM":468.5847653202508,"yM":3.9288164399052112,"zM":537.4384022066646,"radiusM":1.0565114947984378,"heightM":1.849053356180777,"footprint":{"minXM":-0.4481370582621408,"maxXM":0.4481370582621408,"minZM":-0.956760009434646,"maxZM":0.24198496341705317,"yawRad":0}}],["resident:675:b54:lodger:2",{"xM":467.52227630094643,"yM":3.9288164399052112,"zM":536.6191255860623,"radiusM":0.767915029888507,"heightM":2.009016157759497,"footprint":{"minXM":-0.6134978532791134,"maxXM":0.6134978532791134,"minZM":-0.26313635706901556,"maxZM":0.4618591529358122,"yawRad":0}}],["resident:675:b54:lodger:3",{"xM":466.419427652112,"yM":3.9288164399052112,"zM":536.9280082918266,"radiusM":0.623905303994135,"heightM":1.3434801119774757,"footprint":{"minXM":-0.5201029181480407,"maxXM":0.5201029181480407,"minZM":-0.21422524750232697,"maxZM":0.3446023547306467,"yawRad":0}}],["resident:675:b54:lodger:4",{"xM":465.5119174440296,"yM":3.9288164399052112,"zM":537.4029640929765,"radiusM":0.45497823808907706,"heightM":1.705312493893369,"footprint":{"minXM":-0.38670018315315247,"maxXM":0.38670018315315247,"minZM":-0.17251266539096832,"maxZM":0.23972518742084495,"yawRad":0}}],["resident:675:b54:lodger:7",{"xM":465.1492038191511,"yM":3.9288164399052112,"zM":538.236145731234,"radiusM":0.4533557547043985,"heightM":1.507801148595302,"footprint":{"minXM":-0.3983696519842638,"maxXM":0.3983696519842638,"minZM":-0.1866786926984787,"maxZM":0.21640947461128235,"yawRad":0.2724631494125922}}],["resident:675:b54:lodger:8",{"xM":466.3579647451196,"yM":3.9288164399052112,"zM":539.1643014422286,"radiusM":0.5098465518782392,"heightM":1.682049522997266,"footprint":{"minXM":-0.4492839872837068,"maxXM":0.4492839872837068,"minZM":-0.21236450970172907,"maxZM":0.24101328849792508,"yawRad":0.2724631494125922}}]]);
  const key='resident:675:b54:lodger:0',from=space.get(key)!;
  const original=yieldActorStep(from,from,key,from,actorCourtesySpace(space),.12,q=>q,space);
  expect(original).toMatchObject(from);
  for(const id of ['resident:675:b54:lodger:1','resident:675:b54:lodger:2'])space.set(id,{...space.get(id)!,yielding:true});
  const next=yieldActorStep(from,from,key,from,actorCourtesySpace(space),.12,q=>q,space);
  expect(Math.hypot(next.xM-from.xM,next.zM-from.zM)).toBeGreaterThan(.01);
  for(const [id,other]of space)if(id!==key&&!actorSpaceOverlaps(from,key,from,new Map([[id,other]])))
   expect(actorSpaceOverlaps(next,key,from,new Map([[id,other]]))).toBe(false);
 });
});


describe('bounded yielding detours around room geometry',()=>{
 const square=(xM:number,zM=0):ActorBody=>({...body(xM,zM),footprint:{minXM:-.3,maxXM:.3,minZM:-.3,maxZM:.3,yawRad:0}});
 // This narrow wall-side strip admits a sidestep, but its first several
 // steps cannot improve the minimum-axis comfort score. Body separation
 // stays clear throughout; the existing one-step greedy recovery waits.
 const strip=(q:ActorPoint)=>q.xM<.65||q.zM<0||q.zM>1.3?null:{...q,xM:Math.min(.7,q.xM)};
 const scenario=()=>{const npc=square(.7),player=square(0);return {npc,player,space:new Map<string,ActorBody>([['player',player],['npc',npc]])};};
 it('completes a wall-side detour while preserving physical separation on every step',()=>{
  const {npc,player,space}=scenario(),route={},before={...player};let point:ActorPoint=npc;
  for(let i=0;i<180&&point.zM<.8;i++){
   const next=yieldActorStep(point,npc,'npc',{...npc,...point},actorCourtesySpace(space),.12,strip,space,route);
   expect(Math.hypot(next.xM-point.xM,next.zM-point.zM)).toBeLessThanOrEqual(.120001);
   expect(actorSpaceOverlaps(next,'npc',npc,new Map([['player',player]]))).toBe(false);
   point=next;space.set('npc',{...npc,...point});
  }
  expect(point.zM).toBeGreaterThanOrEqual(.8);expect(player).toEqual(before);
 });
 it('bounds probe work per frame rather than completing a whole search at once',()=>{
  const {npc,space}=scenario(),route={};let point:ActorPoint=npc,maxCalls=0;
  for(let i=0;i<180&&point.zM<.8;i++){
   let calls=0;const probe=(q:ActorPoint)=>{calls++;return strip(q);};
   point=yieldActorStep(point,npc,'npc',{...npc,...point},actorCourtesySpace(space),.12,probe,space,route);
   space.set('npc',{...npc,...point});maxCalls=Math.max(maxCalls,calls);
  }
  expect(maxCalls).toBeLessThanOrEqual(64);expect(point.zM).toBeGreaterThanOrEqual(.8);
 });
 it('rechecks a retained detour when a previously clear neighbor steps into its route',()=>{
  const {npc,space}=scenario(),route={};let point:ActorPoint=npc;
  for(let i=0;i<180&&point.zM<.12;i++){
   point=yieldActorStep(point,npc,'npc',{...npc,...point},actorCourtesySpace(space),.12,strip,space,route);space.set('npc',{...npc,...point});
  }
  expect(point.zM).toBeGreaterThan(0);
  const neighbor=square(.7,point.zM+.65);space.set('neighbor',neighbor);
  for(let i=0;i<30;i++){
   point=yieldActorStep(point,npc,'npc',{...npc,...point},actorCourtesySpace(space),.12,strip,space,route);space.set('npc',{...npc,...point});
   expect(actorSpaceOverlaps(point,'npc',npc,new Map([['neighbor',neighbor]]))).toBe(false);
  }
 });
 it('waits when the source floor has no detour and never jumps to a different floor',()=>{
  const {npc,space}=scenario(),route={};
  for(let i=0;i<180;i++)expect(yieldActorStep(npc,npc,'npc',npc,actorCourtesySpace(space),.12,q=>q.zM>.25?null:strip(q),space,route)).toMatchObject(npc);
  for(let i=0;i<30;i++)expect(yieldActorStep(npc,npc,'npc',npc,actorCourtesySpace(space),.12,q=>({...q,yM:3}),space,{})).toMatchObject(npc);
 });
});


describe('yield detour ownership changes',()=>{
 const make=()=>{const npc:ActorBody={...body(.7),footprint:{minXM:-.3,maxXM:.3,minZM:-.3,maxZM:.3,yawRad:0}},player:ActorBody={...body(0),footprint:{minXM:-.3,maxXM:.3,minZM:-.3,maxZM:.3,yawRad:0}},space=new Map([['player',player],['npc',npc]]),route={};let point:ActorPoint=npc;const probe=(q:ActorPoint)=>q.xM<.65||q.zM<0?null:{...q,xM:Math.min(.7,q.xM)};
  for(let i=0;i<180&&point.zM<.12;i++){point=yieldActorStep(point,npc,'npc',{...npc,...point},actorCourtesySpace(space),.12,probe,space,route);space.set('npc',{...npc,...point});}
  expect(point.zM).toBeGreaterThan(0);return{npc,space,route,point,probe};
 };
 it('discards an old route when the source owner changes accepted feet or floor',()=>{
  const {npc,space,route,probe}=make(),relocated={...npc,xM:10,zM:10,yM:3};space.set('npc',relocated);
  expect(yieldActorStep(relocated,relocated,'npc',relocated,actorCourtesySpace(space),.12,probe,space,route)).toMatchObject(relocated);
 });
 it('waits instead of following a cached route through newly closed geometry',()=>{
  const {npc,space,route,point}=make();
  expect(yieldActorStep(point,npc,'npc',{...npc,...point},actorCourtesySpace(space),.12,()=>null,space,route)).toMatchObject({...point,blocked:true});
 });
});


it('does not accumulate small supported rises into an unscheduled storey change',()=>{
 const npc:ActorBody={...body(.7),footprint:{minXM:-.3,maxXM:.3,minZM:-.3,maxZM:.3,yawRad:0}},player:ActorBody={...body(0),footprint:{minXM:-.3,maxXM:.3,minZM:-.3,maxZM:.3,yawRad:0}},space=new Map([['player',player],['npc',npc]]),route={};
 const stairs=(q:ActorPoint,start:ActorPoint=npc)=>q.xM<.65||q.zM<0?null:{...q,xM:Math.min(.7,q.xM),yM:start.yM+.05};
 for(let i=0;i<180;i++)expect(yieldActorStep(npc,npc,'npc',npc,actorCourtesySpace(space),.12,stairs,space,route)).toMatchObject(npc);
});


it('permits an admitted street doorstep only when opted in, retaining body and geometry barriers',()=>{
 const npc=body(0),space=new Map([['npc',npc]]),goal=p(.12),floor=(q:ActorPoint)=>({...q,yM:.12192});
 expect(yieldActorStep(npc,goal,'npc',npc,space,.12,floor,space,{})).toMatchObject({...npc,blocked:true});
 expect(yieldActorStep(npc,goal,'npc',npc,space,.12,floor,space,{},.22)).toMatchObject({xM:.12,zM:0,yM:.12192,blocked:false});
 expect(yieldActorStep(npc,goal,'npc',npc,space,.12,()=>null,space,{},.22)).toMatchObject({...npc,blocked:true});
 expect(yieldActorStep(npc,goal,'npc',npc,space,.12,q=>({...q,yM:.23}),space,{},.22)).toMatchObject({...npc,blocked:true});
 expect(yieldActorStep(npc,goal,'npc',npc,space,.12,floor,space,{},.23)).toMatchObject({...npc,blocked:true});
 const occupied=new Map([...space,['player',body(.7)] as const]);
 expect(yieldActorStep(npc,goal,'npc',npc,occupied,.12,floor,occupied,{},.22).xM).toBeLessThan(.12);
});
