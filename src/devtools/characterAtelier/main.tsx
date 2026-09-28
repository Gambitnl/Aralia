/** A playable visual study of the BG3 creator shown in the user's reference.
 * Reuses Aralia's class descriptions and icons. Drafts are local to this page;
 * the final sheet exports a JSON document without starting or changing a game.
 */
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
// The shared performance tool: fps pill, Alt+P panel, the atelier's canvas
// measured with no probe in the scene. First, before CharacterScene loads.
import '../perf/staple';
import { Check, ChevronLeft, ChevronRight, RotateCcw, RotateCw, Shuffle, ZoomIn, ZoomOut, X, Heart, Shield, Sparkles, Leaf, Swords, UserRound, BookOpen, Sun, Download, Settings2 } from 'lucide-react';
import { CLASSES_DATA } from '../../data/classes';
import { CharacterScene, type Appearance } from './CharacterScene';
import { abilities, startingScores, pointsRemaining, changeScore, raceOptions, backgrounds, classOrder, subclasses, cantrips } from './choices';
import './style.css';

const base = import.meta.env.BASE_URL;
const icon = (kind: string, id: string) => `${base}assets/icons/tw-dnd/${kind}/${id}.svg`;
const steps = ['Origin','Race','Subrace','Cantrip','Class','Subclass','Background','Abilities'] as const;
type Step = typeof steps[number];
const colors = {
  hair: ['#c7b899','#9a6a3d','#503528','#201b1c','#b3b6ba','#76362a','#c09673','#684557'],
  skin: ['#ffffff','#ebcfb4','#c59c77','#9c7656','#725647','#48403c','#b7b4cb','#b2c49c'],
  scales: ['#b89672','#a84235','#6692ad','#819b69','#ddd6bf','#716786','#605951','#cead65'],
  cloth: ['#174c3c','#243e50','#602b30','#493d68','#403c2d','#77818a','#9a712f','#1c2226'],
};

class SceneBoundary extends React.Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-error" role="alert">The character could not load.<button onClick={() => window.location.reload()}>Reload scene</button></div> : this.props.children; }
}

function App() {
  const [step, setStep] = useState<Step>('Subrace');
  const [raceId, setRace] = useState('high-elf');
  const [classId, setClass] = useState('paladin');
  const [subclass, setSubclass] = useState('Oath of the Ancients');
  const [background, setBackground] = useState('Folk Hero');
  const [cantripId, setCantrip] = useState('fire-bolt');
  const [scores, setScores] = useState(startingScores);
  const [appearance, setAppearance] = useState<Appearance>({ hair:'#c7b899', skin:'#ffffff', cloth:'#174c3c', build:1, tattoo:false, tattooColor:'#28333d', tattooOpacity:.78 });
  const [editing, setEditing] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  useEffect(() => {
    const restore = (event: KeyboardEvent) => { if(event.key==='Escape') setUiHidden(false); };
    window.addEventListener('keydown',restore);
    return () => window.removeEventListener('keydown',restore);
  }, []);
  const [appearanceTab, setAppearanceTab] = useState('General');
  const [closeup, setCloseup] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [cameraRevision, setCameraRevision] = useState(0);
  const [review, setReview] = useState(false);
  const [name, setName] = useState('Tav');
  const [help, setHelp] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!review && !help) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const focusable = () => [...(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input') ?? [])];
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setReview(false); setHelp(false); }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1)?.focus(); }
      else if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0]?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [review, help]);
  const race = raceOptions.find(r => r.id === raceId)!;
  const chooseRace = (id: string) => {
    const next = raceOptions.find(r => r.id === id)!;
    setRace(id);
    // Start each ancestry with its characteristic palette while keeping the
    // player's clothing dye and build choice. All tones remain editable.
    setAppearance(current => ({ ...current, skin:next.skin, hair:next.hairColor, tattoo:id==='goliath' }));
  };
  const characterClass = CLASSES_DATA[classId];
  const selectedCantrip = cantrips.find(c => c.id === cantripId)!;
  const selectedBackground = backgrounds.find(b => b[0] === background)!;
  const subclassOptions = subclasses[classId] ?? [];
  const modifier = (score: number) => Math.floor((score - 10)/2);
  const hitPoints = characterClass.hitDie + modifier(scores.Constitution);
  const summaries = { Origin:'Custom', Race:race.race, Subrace:race.name, Cantrip:'1/1', Class:characterClass.name, Subclass:subclassOptions.length ? subclass : 'At a later level', Background:background, Abilities:`${27-pointsRemaining(scores)}/27` };
  const go = (next: Step) => { setEditing(false); setCloseup(false); setStep(next); };
  const chooseClass = (id: string) => { setClass(id); setSubclass(subclasses[id]?.[0] ?? ''); };
  const randomize = () => {
    const skinPalette = raceId==='dragonborn' ? colors.scales : colors.skin;
    setAppearance({ ...appearance, hair:colors.hair[Math.floor(Math.random()*colors.hair.length)], skin:skinPalette[Math.floor(Math.random()*skinPalette.length)], cloth:colors.cloth[Math.floor(Math.random()*colors.cloth.length)], build:[.94,1,1.07][Math.floor(Math.random()*3)] });
    setNotice('Appearance randomized');
  };
  const exportCharacter = () => {
    const document = { format:'aralia-character-atelier-v1', name, origin:'Custom', race:race.name, class:classId, subclass, background, cantrip:cantripId, scores, appearance, model:`${raceId}.glb` };
    const url=URL.createObjectURL(new Blob([JSON.stringify(document,null,2)],{type:'application/json'}));
    const link=window.document.createElement('a'); link.href=url; link.download=`${name.trim() || 'character'}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000); setNotice('Character sheet exported');
  };
  const openAppearance = () => { setEditing(true); setCloseup(true); };

  return <main className={`atelier ${editing ? 'is-editing' : ''} ${uiHidden ? 'ui-hidden' : ''}`}>
    <button className="ui-visibility-toggle" aria-pressed={uiHidden} onClick={()=>setUiHidden(hidden=>!hidden)}>{uiHidden?'Show UI':'Hide UI'}</button>
    <div className="landscape" />
    <div className="vignette" />
    <header className="topbar"><span className="brand">ARALIA <i /> CHARACTER ATELIER</span><div><button aria-label="About this recreation" onClick={() => setHelp(true)}><BookOpen size={16}/></button><button aria-label="Open appearance settings" onClick={openAppearance}><Settings2 size={16}/></button></div></header>

    <nav className="steps" aria-label="Character creation steps">
      {steps.map((item,index) => <button key={item} onClick={() => go(item)} className={step===item && !editing ? 'current' : ''} aria-current={step===item && !editing ? 'step' : undefined}>
        <span className="step-seal">{step===item && !editing ? <ChevronRight size={15}/> : <Check size={14}/>}</span><span><strong>{item==='Cantrip' ? `${raceId==='high-elf' ? 'High Elf ' : ''}Cantrip` : item}</strong><small>{summaries[item]}</small></span><span className="step-index">{index+1}</span>
      </button>)}
    </nav>

    <SceneBoundary><CharacterScene model={raceId} appearance={appearance} closeup={closeup} rotation={rotation} resetKey={cameraRevision}/></SceneBoundary>

    {!editing && <section className="choice-panel ornate" aria-labelledby="step-title">
      <div className="panel-crown"><Sparkles size={19}/></div>
      <h1 id="step-title">{step==='Cantrip' ? 'Cantrips' : step}</h1>
      <div className="panel-scroll">
        {step==='Origin' && <><button className="origin-custom selected" aria-pressed="true"><UserRound size={38}/><span>Custom</span></button><h2>A story of your own</h2><p>Create a character whose past belongs to you. Choose your ancestry, calling, and the face you will bring into the world.</p><div className="section-rule">Your character</div><label className="field-label" htmlFor="character-name">Name</label><input id="character-name" maxLength={40} value={name} onChange={e=>setName(e.target.value)}/><p className="subtle">Every great journey begins with a choice.</p></>}
        {(step==='Race' || step==='Subrace') && <><div className={`choice-grid race-grid ${step==='Subrace' ? 'two-cols' : ''}`}>
          {(step==='Subrace' ? raceOptions.filter(r=>r.race===race.race) : raceOptions).map(option=><button key={option.id} onClick={()=>chooseRace(option.id)} aria-pressed={raceId===option.id} className={`choice-tile ${raceId===option.id?'selected':''}`}><span className="tile-art"><img src={`${base}assets/character-atelier/${option.id}-portrait.png`} alt=""/></span><span>{option.name}</span></button>)}
        </div><h2>{race.name}</h2><p>{race.description}</p><div className="trait-box"><span>{raceId==='high-elf'?'High Elf Cantrip':race.traits[0]}</span>{raceId==='high-elf'?<button className="spell-tile warm" title={`${selectedCantrip.name}: ${selectedCantrip.description}`} aria-label={`Choose cantrip, currently ${selectedCantrip.name}`} onClick={()=>go('Cantrip')}><img src={`${base}assets/icons/spells/${selectedCantrip.icon}.svg`} alt=""/></button>:<Leaf size={30}/>}</div><div className="traits">{race.traits.map(trait=><div key={trait}><Sparkles size={13}/>{trait}</div>)}</div></>}
        {step==='Class' && <><div className="choice-grid class-grid">{classOrder.map(id=><button className={`choice-tile ${classId===id?'selected':''}`} onClick={()=>chooseClass(id)} aria-pressed={classId===id} key={id}><span className="tile-art"><img src={icon('class',id)} alt=""/></span><span>{CLASSES_DATA[id].name}</span></button>)}</div><h2>{characterClass.name}</h2><p>{characterClass.description}</p><div className="section-rule">Class features</div><p className="feature-line"><Heart size={16}/>{characterClass.hitDie} starting Hit Points <span>+ Constitution</span></p><p className="feature-line"><Swords size={16}/>Primary ability <span>{characterClass.primaryAbility.join(' / ')}</span></p></>}
        {step==='Subclass' && <><div className="choice-grid subclass-grid">{subclassOptions.map((option,index)=><button className={`choice-tile ${subclass===option?'selected':''}`} aria-pressed={subclass===option} key={option} onClick={()=>setSubclass(option)}><span className="tile-art">{index===0?<Leaf/>:index===1?<Sun/>:<Swords/>}</span><span>{option}</span></button>)}</div><h2>{subclassOptions.length ? subclass : 'Your path is still unfolding'}</h2><p>{subclassOptions.length ? 'Your calling is more than a set of skills. Let this choice shape the convictions and powers you bring to your adventures.' : `${characterClass.name} specializations become available as you gain levels. Continue to choose your background.`}</p>{classId==='paladin' && <><div className="section-rule">Tenets of your oath</div><p>Kindle the light. Shelter the light.<br/>Preserve your own light. Be the light.</p></>}</>}
        {step==='Cantrip' && <><p className="selection-count">Choose a cantrip <span>1 / 1</span></p><div className="choice-grid cantrip-grid">{cantrips.map(c=><button className={`choice-tile ${cantripId===c.id?'selected':''}`} aria-pressed={cantripId===c.id} key={c.id} onClick={()=>setCantrip(c.id)}><span className="tile-art"><img src={`${base}assets/icons/spells/${c.icon}.svg`} alt=""/></span><span>{c.name}</span></button>)}</div><h2>{selectedCantrip.name}</h2><p>{selectedCantrip.description}</p><div className="section-rule">Cantrip</div><p className="subtle">A spell you can cast without expending a spell slot.</p></>}
        {step==='Background' && <><div className="background-list">{backgrounds.map(b=><button key={b[0]} className={background===b[0]?'selected':''} aria-pressed={background===b[0]} onClick={()=>setBackground(b[0])}><span>{b[0]}</span>{background===b[0] && <Check size={15}/>}</button>)}</div><h2>{background}</h2><p>{selectedBackground[1]}</p><div className="section-rule">Skill proficiencies</div><p>{selectedBackground[2]}</p></>}
        {step==='Abilities' && <><p>Shape your strengths. Higher scores make your character more capable in the abilities you choose.</p><div className="points"><strong>{pointsRemaining(scores)}</strong><span>Points remaining</span><button onClick={()=>setScores(startingScores)} aria-label="Reset ability scores"><RotateCcw size={16}/></button></div><div className="ability-editor">{abilities.map(ability=><div key={ability}><img src={icon('ability',ability.toLowerCase())} alt=""/><label>{ability}</label><button aria-label={`Decrease ${ability}`} disabled={scores[ability]===8} onClick={()=>setScores(s=>changeScore(s,ability,-1))}>−</button><output aria-label={`${ability} score`}>{scores[ability]}</output><button aria-label={`Increase ${ability}`} disabled={changeScore(scores,ability,1)===scores} onClick={()=>setScores(s=>changeScore(s,ability,1))}>+</button></div>)}</div><p className="subtle">Scores of 14 and 15 cost two points per increase. Racial bonuses are separate from this allocation.</p></>}
      </div>
      <div className="panel-foot"><span>CREATE YOUR CHARACTER</span><i/></div>
    </section>}

    {!editing && <aside className="summary-panel ornate" aria-label="Character summary">
      <div className="class-crest"><img src={icon('class',classId)} alt=""/></div>
      <h2>{race.name}</h2><p className="level">Level 1 {characterClass.name}</p>
      <div className="stat-row">{abilities.map(a=><div key={a}><abbr title={a}>{a.slice(0,3).toUpperCase()}</abbr><strong>{scores[a]}</strong></div>)}</div>
      <div className="vitals"><div title="Initiative"><Shield size={22}/><span>{modifier(scores.Dexterity)>=0?'+':''}{modifier(scores.Dexterity)}</span></div><div title="Hit Points"><Heart size={22}/><span>{hitPoints}</span></div></div>
      <div className="section-rule">Cantrips</div><div className="summary-spells"><button className="spell-tile warm" title={selectedCantrip.name} aria-label={`Edit ${selectedCantrip.name}`} onClick={()=>go('Cantrip')}><img src={`${base}assets/icons/spells/${selectedCantrip.icon}.svg`} alt=""/></button></div>
      <div className="section-rule">Actions</div><div className="summary-spells"><span className="spell-tile teal" title="Help"><Heart/></span><span className="spell-tile amber" title="Jump"><Sparkles/></span><span className="spell-tile teal" title="Dash"><Swords/></span></div>
      <div className="section-rule">Proficiencies</div><p className="proficiencies"><em>Saving Throws</em><br/>{characterClass.savingThrowProficiencies.join(', ')}<br/><br/><em>Skills</em><br/>{selectedBackground[2]}<br/><br/><em>Ancestry</em><br/>{race.traits.join(', ')}</p>
      <button className="summary-link" onClick={()=>setReview(true)}>Character details <ChevronRight size={13}/></button>
    </aside>}

    {editing && <section className="appearance-panel ornate" aria-labelledby="appearance-title"><div className="panel-crown"><Sparkles size={19}/></div><h1 id="appearance-title">Appearance</h1><div className="appearance-tabs" role="tablist">{['General','Skin','Hair','Clothing'].map(tab=><button role="tab" aria-selected={appearanceTab===tab} key={tab} onClick={()=>setAppearanceTab(tab)}>{tab}</button>)}</div><div className="panel-scroll">
      {appearanceTab==='General' && <><h2>Body type</h2><div className="body-types">{[.94,1,1.07].map((build,index)=><button key={build} aria-label={`Body build ${index+1}`} aria-pressed={appearance.build===build} className={appearance.build===build?'selected':''} onClick={()=>setAppearance(a=>({...a,build}))}><UserRound size={32}/><span>{index+1}</span></button>)}</div><div className="section-rule">Ancestry</div><div className="race-switch">{raceOptions.map(r=><button key={r.id} className={raceId===r.id?'selected':''} onClick={()=>chooseRace(r.id)}>{r.name}</button>)}</div><p className="subtle">Drag your character to turn them. Scroll to inspect the details.</p></>}
      {(appearanceTab==='Skin'||appearanceTab==='General') && <ColorPicker title={raceId==='dragonborn'?'Scale color':'Skin tone'} values={raceId==='dragonborn'?colors.scales:colors.skin} value={appearance.skin} onChange={skin=>setAppearance(a=>({...a,skin}))}/>}
      {(appearanceTab==='Skin'||appearanceTab==='General') && <fieldset className="tattoo-controls"><legend>Face tattoos</legend>{raceId==='dragonborn'?<p className="subtle">Facial ink is available on the humanoid skin models.</p>:<><div className="race-switch"><button aria-pressed={!appearance.tattoo} className={!appearance.tattoo?'selected':''} onClick={()=>setAppearance(a=>({...a,tattoo:false}))}>None</button><button aria-pressed={appearance.tattoo} className={appearance.tattoo?'selected':''} onClick={()=>setAppearance(a=>({...a,tattoo:true}))}>Stone sigil</button></div>{appearance.tattoo && <><ColorPicker title="Tattoo ink" values={['#28333d','#141416','#49342f','#263d51','#4a2848','#355047']} value={appearance.tattooColor} onChange={tattooColor=>setAppearance(a=>({...a,tattooColor}))}/><label className="tattoo-strength">Ink strength <output>{Math.round(appearance.tattooOpacity*100)}%</output><input aria-label="Tattoo opacity" type="range" min="0" max="1" step="0.01" value={appearance.tattooOpacity} onChange={e=>setAppearance(a=>({...a,tattooOpacity:Number(e.target.value)}))}/></label></>}</>}</fieldset>}
      {(appearanceTab==='Hair'||appearanceTab==='General') && <ColorPicker title="Hair color" values={colors.hair} value={appearance.hair} onChange={hair=>setAppearance(a=>({...a,hair}))}/>}
      {(appearanceTab==='Clothing'||appearanceTab==='General') && <ColorPicker title="Cloth dye" values={colors.cloth} value={appearance.cloth} onChange={cloth=>setAppearance(a=>({...a,cloth}))}/>}
      {appearanceTab==='Hair' && <><div className="section-rule">Hair style</div><p>{race.hairLabel}</p><p className="subtle">Each model has its own fitted hairstyle.</p></>}
    </div><button className="gold-button appearance-done" onClick={()=>{setEditing(false);setCloseup(false);}}>Confirm appearance <Check size={15}/></button></section>}

    <div className="camera-controls"><button aria-label={closeup?'Zoom out to full body':'Zoom in to face'} onClick={()=>setCloseup(!closeup)}>{closeup?<ZoomOut/>:<ZoomIn/>}</button><button aria-label="Reset camera" onClick={()=>{setCloseup(false);setRotation(0);setCameraRevision(r=>r+1);}}><RotateCcw/></button><button aria-label="Rotate character left" onClick={()=>setRotation(r=>r-.45)}><RotateCcw/></button><button aria-label="Rotate character right" onClick={()=>setRotation(r=>r+.45)}><RotateCw/></button></div>
    {!editing && <div className="randomizer ornate"><span>Body Type</span><div className="body-mini">{[.94,1,1.07].map((b,i)=><button key={b} className={appearance.build===b?'selected':''} aria-label={`Set body build ${i+1}`} onClick={()=>setAppearance(a=>({...a,build:b}))}>{i+1}</button>)}</div><button className="random-button" onClick={randomize}><Shuffle size={17}/>Randomize Appearance</button></div>}
    <footer className="footer"><button className="back-button" onClick={()=>go(steps[Math.max(0,steps.indexOf(step)-1)])}><ChevronLeft size={14}/>Back</button><div className="main-actions">{!editing && <button className="gold-button" onClick={openAppearance}>Edit Appearance</button>}<button className="gold-button primary" onClick={()=>{if(editing){setEditing(false);setCloseup(false);}else if(step==='Abilities'){setReview(true);}else{go(steps[steps.indexOf(step)+1]);}}}>{editing?'Confirm Appearance':step==='Abilities'?'Review Character':'Proceed'}<ChevronRight size={14}/></button></div><span className="draft-label">A STORY WAITING TO BE TOLD</span></footer>
    <div className="sr-only" role="status">{notice}</div>

    {review && <div className="modal-backdrop"><section className="review-modal ornate" role="dialog" aria-modal="true" aria-labelledby="review-title"><button className="modal-close" aria-label="Close character review" onClick={()=>setReview(false)}><X/></button><Sparkles className="review-spark"/><p className="eyebrow">YOUR JOURNEY BEGINS</p><h1 id="review-title">{name || 'Tav'}</h1><p>{race.name} · {characterClass.name} · {background}</p><div className="section-rule">Character sheet</div><div className="review-stats">{abilities.map(a=><div key={a}><span>{a}</span><strong>{scores[a]}</strong></div>)}</div><p>{subclass || 'A path yet to be chosen'}</p><p className="subtle">Save this character as a file, or return to keep creating.</p><div className="review-actions"><button className="gold-button" onClick={()=>setReview(false)}>Keep editing</button><button className="gold-button primary" onClick={exportCharacter}><Download size={15}/>Export character</button></div></section></div>}
    {help && <div className="modal-backdrop"><section className="review-modal ornate" role="dialog" aria-modal="true" aria-labelledby="about-title"><button className="modal-close" aria-label="Close about" onClick={()=>setHelp(false)}><X/></button><h1 id="about-title">Character Atelier</h1><p>An interactive recreation inspired by the Baldur’s Gate 3 character-creation video.</p><p>The characters are newly assembled in Blender with MakeHuman anatomy and custom fantasy garments. Fourteen ancestry models are available here, including ten additional races. The original game's origin cast is not yet reproduced.</p><p className="subtle">This preview keeps its own character choices. Exporting does not modify an Aralia game save.</p><a href="https://www.youtube.com/watch?v=3cnYcEh0J5o" target="_blank" rel="noreferrer">View the reference film</a><button className="gold-button appearance-done" onClick={()=>setHelp(false)}>Return to creator</button></section></div>}
  </main>;
}

function ColorPicker({ title, values, value, onChange }: { title:string; values:string[]; value:string; onChange:(color:string)=>void }) {
  return <fieldset className="color-picker"><legend>{title}</legend><div>{values.map((color,index)=><button key={color} style={{backgroundColor:color}} aria-label={`${title} ${index+1}`} aria-pressed={value===color} className={value===color?'selected':''} onClick={()=>onChange(color)}>{value===color && <Check size={15}/>}</button>)}</div></fieldset>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<App/>);
// Release the old preview root before Vite runs this entry again during edits.
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
