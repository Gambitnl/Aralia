// @dependencies-start
/**
 * ARCHITECTURAL ADVISORY:
 * This file appears to be an ISOLATED UTILITY or ORPHAN.
 *
 * Last Sync: 27/02/2026, 09:26:46
 * Dependents: None (Orphan)
 * Imports: 41 files
 *
 * MULTI-AGENT SAFETY:
 * If you modify exports/imports, re-run the sync tool to update this header:
 * > npx tsx misc/dev_hub/codebase-visualizer/server/index.ts --sync [this-file-path]
 * See misc/dev_hub/codebase-visualizer/VISUALIZER_README.md for more info.
 */
// @dependencies-end

/**
 * @file CharacterCreator.tsx
 * Main character creation component wrapped in a resizable window frame.
 */
import React, { useReducer, useCallback, useContext, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  PlayerCharacter,
  AbilityScores,
  Skill,
  Spell,
  FightingStyle,
  Item,
} from '../../types';
import {
  RACES_DATA,
  CLASSES_DATA,
} from '../../constants';
import { ACTIVE_RACES } from '../../data/races/index';
import { FEATS_DATA } from '../../data/feats/featsData';
import { evaluateFeatPrerequisites } from '../../utils/characterUtils';
import RaceSelection from './Race/RaceSelection';
import AgeSelection from './AgeSelection';
import BackgroundSelection from './BackgroundSelection';
import ClassSelection from './Class/ClassSelection';
import AbilityScoreAllocation from './AbilityScoreAllocation';
import SkillSelection from './SkillSelection';
import HumanSkillSelection from './Race/HumanSkillSelection';
import FighterFeatureSelection from './Class/FighterFeatureSelection';
import ClericFeatureSelection from './Class/ClericFeatureSelection';
import WizardFeatureSelection from './Class/WizardFeatureSelection';
import SorcererFeatureSelection from './Class/SorcererFeatureSelection';
import RangerFeatureSelection from './Class/RangerFeatureSelection';
import ArtificerFeatureSelection from './Class/ArtificerFeatureSelection';
import PaladinFeatureSelection from './Class/PaladinFeatureSelection';
import BardFeatureSelection from './Class/BardFeatureSelection';
import DruidFeatureSelection from './Class/DruidFeatureSelection';
import WarlockFeatureSelection from './Class/WarlockFeatureSelection';
import WeaponMasterySelection from './WeaponMasterySelection';
import FeatSelection from './FeatSelection';
// Deprecated: DragonbornAncestrySelection, ElfLineageSelection, GnomeSubraceSelection,
// GiantAncestrySelection, TieflingLegacySelection, RacialSpellAbilitySelection
// These have been replaced by inline race variant selection in RaceDetailPane
import type { RacialChoiceData } from './Race/RaceDetailPane';
import VisualsSelection from './VisualsSelection';
import NameAndReview from './NameAndReview';
import CreationSidebar from './CreationSidebar';
import {
  CreationStep,
  characterCreatorReducer,
  initialCharacterCreatorState,
} from './state/characterCreatorState';
import type { CharacterCreationState } from './state/characterCreatorState';
import type { AppAction } from '../../state/actionTypes';
import { useCharacterAssembly } from './hooks/useCharacterAssembly';
import { CharacterVisualConfig } from '../../services/CharacterAssetService';
import { generatePortraitUrl } from '../../services/PortraitService';
import SpellContext from '../../context/SpellContext';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { WindowFrame } from '../ui/WindowFrame';
import { WINDOW_KEYS } from '../../styles/uiIds';
import { Button } from '../ui/Button';
import { SafeStorage } from '../../utils/storageUtils';
import { sanitizeAIPromptText } from '../../utils/securityUtils';
import { ENV } from '../../config/env';

interface CharacterCreatorProps {
  onCharacterCreate: (character: PlayerCharacter, startingInventory: Item[]) => void;
  onExitToMainMenu: () => void;
  dispatch: React.Dispatch<AppAction>;
}

const STORAGE_KEY = 'aralia_character_creation_state';

const isPortraitInFlight = (state: CharacterCreationState) =>
  state.portrait.status === 'requesting' || state.portrait.status === 'polling';

function buildFallbackVisualDescription(state: CharacterCreationState): string {
  const race = state.selectedRace?.name || 'adventurer';
  const charClass = state.selectedClass?.name || 'wanderer';
  const gender = state.visuals?.gender || 'Male';
  const hairStyle = state.visuals?.hairStyle || 'Hair1';
  const clothing = state.visuals?.clothing || 'Clothing1';

  return [
    `A high fantasy character portrait of a level 1 ${race} ${charClass}.`,
    `${gender} adventurer.`,
    `Hair: ${hairStyle}.`,
    `Clothing: ${clothing}.`,
    'Head-and-shoulders, detailed, dramatic lighting, neutral background.'
  ].join(' ');
}

function rehydrateCharacterCreatorState(
  initial: CharacterCreationState,
  raw: unknown
): CharacterCreationState {
  if (!raw || typeof raw !== 'object') return initial;

  const persisted = raw as Partial<CharacterCreationState> & {
    visuals?: unknown;
    portrait?: unknown;
  };

  const merged: CharacterCreationState = {
    ...initial,
    ...persisted,
    visuals: {
      ...initial.visuals,
      ...((persisted.visuals && typeof persisted.visuals === 'object') ? (persisted.visuals as Partial<CharacterCreationState['visuals']>) : {}),
    },
    visualDescription: typeof persisted.visualDescription === 'string' ? persisted.visualDescription : initial.visualDescription,
    portrait: {
      ...initial.portrait,
      ...((persisted.portrait && typeof persisted.portrait === 'object') ? (persisted.portrait as Partial<CharacterCreationState['portrait']>) : {}),
    },
  };

  // Don’t resume in-flight portrait requests after reload.
  if (merged.portrait.status === 'requesting' || merged.portrait.status === 'polling') {
    merged.portrait = {
      ...merged.portrait,
      status: 'idle',
      error: null,
      requestedForName: null,
    };
  }

  if (merged.portrait.url !== null && typeof merged.portrait.url !== 'string') merged.portrait.url = null;
  if (merged.portrait.error !== null && typeof merged.portrait.error !== 'string') merged.portrait.error = null;
  if (merged.portrait.requestedForName !== null && typeof merged.portrait.requestedForName !== 'string') {
    merged.portrait.requestedForName = null;
  }

  return merged;
}

const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onCharacterCreate, onExitToMainMenu, dispatch: appDispatch }) => {
  const [state, dispatch] = useReducer(characterCreatorReducer, initialCharacterCreatorState, (initial) => {
    try {
      const persisted = SafeStorage.getItem(STORAGE_KEY);
      return persisted ? rehydrateCharacterCreatorState(initial, JSON.parse(persisted)) : initial;
    } catch (e) {
      console.warn('Failed to load character creation state', e);
      return initial;
    }
  });

  // Persist state on change
  React.useEffect(() => {
    SafeStorage.trySetItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const allSpells = useContext(SpellContext);
  const [showSidebar, setShowSidebar] = useState(true);
  const portraitJobRef = React.useRef<{ token: number; cancelled: boolean }>({ token: 0, cancelled: false });

  const { assembleAndSubmitCharacter, generatePreviewCharacter } = useCharacterAssembly({
    onCharacterCreate
  });

  const { selectedRace, selectedClass, finalAbilityScores } = state;

  const handleCancelPortrait = useCallback(() => {
    portraitJobRef.current.cancelled = true;
    dispatch({ type: 'PORTRAIT_REQUEST_CANCEL' });
  }, [dispatch]);

  const handleClearPortrait = useCallback(() => {
    portraitJobRef.current.cancelled = true;
    dispatch({ type: 'CLEAR_PORTRAIT' });
  }, [dispatch]);

  const handleGeneratePortrait = useCallback(async () => {
    if (!ENV.VITE_ENABLE_PORTRAITS) return;
    if (!selectedRace || !selectedClass) {
      dispatch({ type: 'PORTRAIT_REQUEST_ERROR', payload: { error: 'Select a race and class first.' } });
      return;
    }

    if (isPortraitInFlight(state)) return;

    const requestedForName = (state.characterName || '').trim() || null;

    const descriptionSource = (state.visualDescription || '').trim() || buildFallbackVisualDescription(state);
    const description = sanitizeAIPromptText(descriptionSource, 500);

    // Start a new job token so late responses from older jobs can be ignored.
    const token = portraitJobRef.current.token + 1;
    portraitJobRef.current = { token, cancelled: false };

    dispatch({ type: 'PORTRAIT_REQUEST_START', payload: { requestedForName } });

    try {
      const url = await generatePortraitUrl({
        description,
        race: selectedRace.name,
        className: selectedClass.name,
      });

      if (portraitJobRef.current.token !== token || portraitJobRef.current.cancelled) {
        dispatch({ type: 'PORTRAIT_REQUEST_CANCEL' });
        return;
      }

      dispatch({ type: 'PORTRAIT_REQUEST_SUCCESS', payload: { url } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate portrait.';
      dispatch({ type: 'PORTRAIT_REQUEST_ERROR', payload: { error: message } });
    }
  }, [
    dispatch,
    selectedRace,
    selectedClass,
    state,
  ]);

  // Cancel portrait generation if the user navigates away from the review step.
  React.useEffect(() => {
    const inFlight = state.portrait.status === 'requesting' || state.portrait.status === 'polling';
    if (state.step !== CreationStep.NameAndReview && inFlight) {
      portraitJobRef.current.cancelled = true;
      dispatch({ type: 'PORTRAIT_REQUEST_CANCEL' });
    }
  }, [dispatch, state.step, state.portrait.status]);

  // Ensure we don't keep polling if this component unmounts.
  React.useEffect(() => {
    return () => {
      portraitJobRef.current.cancelled = true;
    };
  }, []);

  const featOptions = useMemo(() => {
    const abilityScores = finalAbilityScores || state.baseAbilityScores || {
      Strength: 0, Dexterity: 0, Constitution: 0, Intelligence: 0, Wisdom: 0, Charisma: 0,
    };

    return FEATS_DATA.map((feat) => {
      const eligibility = evaluateFeatPrerequisites(feat, {
        level: 1,
        abilityScores,
        raceId: selectedRace?.id,
        classId: selectedClass?.id,
        knownFeats: [],
        hasFightingStyle: !!(selectedClass?.fightingStyles && selectedClass.fightingStyles.length > 0),
      });

      return { ...feat, isEligible: eligibility.isEligible, unmet: eligibility.unmet };
    });
  }, [finalAbilityScores, selectedRace, selectedClass, state.baseAbilityScores]);

  const hasEligibleFeats = useMemo(() => featOptions.some(option => option.isEligible), [featOptions]);

  // Handlers (kept same as before)
  const handleRaceSelect = useCallback((raceId: string, choices?: RacialChoiceData) => {
    dispatch({ type: 'SELECT_RACE', payload: RACES_DATA[raceId] });

    if (choices?.spellAbility) {
      dispatch({ type: 'SET_RACIAL_SELECTION', payload: { raceId, patch: { spellAbility: choices.spellAbility } } });
    }

    if (choices?.keenSensesSkillId) {
      dispatch({ type: 'SET_RACIAL_SELECTION', payload: { raceId: 'elf', patch: { skillIds: [choices.keenSensesSkillId] } } });
    }

    if (choices?.centaurNaturalAffinitySkillId) {
      dispatch({ type: 'SET_RACIAL_SELECTION', payload: { raceId: 'centaur', patch: { skillIds: [choices.centaurNaturalAffinitySkillId] } } });
    }

    if (choices?.changelingInstinctSkillIds) {
      dispatch({ type: 'SET_RACIAL_SELECTION', payload: { raceId: 'changeling', patch: { skillIds: choices.changelingInstinctSkillIds } } });
    }
  }, [dispatch]);

  const handleClassSelect = useCallback((classId: string) => dispatch({ type: 'SELECT_CLASS', payload: CLASSES_DATA[classId] }), [dispatch]);
  const handleAbilityScoresSet = useCallback((scores: AbilityScores) => dispatch({ type: 'SET_ABILITY_SCORES', payload: { baseScores: scores } }), [dispatch]);
  const handleHumanSkillSelect = useCallback((skillId: string) => dispatch({ type: 'SELECT_HUMAN_SKILL', payload: skillId }), [dispatch]);
  const handleSkillsSelect = useCallback((skills: Skill[]) => dispatch({ type: 'SELECT_SKILLS', payload: skills }), [dispatch]);
  const handleFighterFeaturesSelect = useCallback((style: FightingStyle) => dispatch({ type: 'SELECT_FIGHTER_FEATURES', payload: style }), [dispatch]);
  const handleClericFeaturesSelect = useCallback((order: 'Protector' | 'Thaumaturge', cantrips: Spell[], spellsL1: Spell[]) => dispatch({ type: 'SELECT_CLERIC_FEATURES', payload: { order, cantrips, spellsL1 } }), [dispatch]);
  const handleDruidFeaturesSelect = useCallback((order: 'Magician' | 'Warden', cantrips: Spell[], spellsL1: Spell[]) => dispatch({ type: 'SELECT_DRUID_FEATURES', payload: { order, cantrips, spellsL1 } }), [dispatch]);
  const handleWizardFeaturesSelect = useCallback((cantripsSpells: Spell[], spellsL1Spells: Spell[]) => dispatch({ type: 'SELECT_WIZARD_FEATURES', payload: { cantrips: cantripsSpells, spellsL1: spellsL1Spells } }), [dispatch]);
  const handleSorcererFeaturesSelect = useCallback((cantrips: Spell[], spellsL1: Spell[]) => dispatch({ type: 'SELECT_SORCERER_FEATURES', payload: { cantrips, spellsL1 } }), [dispatch]);
  const handleRangerFeaturesSelect = useCallback((spellsL1: Spell[]) => dispatch({ type: 'SELECT_RANGER_FEATURES', payload: { spellsL1 } }), [dispatch]);
  const handlePaladinFeaturesSelect = useCallback((spellsL1: Spell[]) => dispatch({ type: 'SELECT_PALADIN_FEATURES', payload: { spellsL1 } }), [dispatch]);
  const handleArtificerFeaturesSelect = useCallback((cantripsSpells: Spell[], spellsL1Spells: Spell[]) => dispatch({ type: 'SELECT_ARTIFICER_FEATURES', payload: { cantrips: cantripsSpells, spellsL1: spellsL1Spells } }), [dispatch]);
  const handleBardFeaturesSelect = useCallback((cantripsSpells: Spell[], spellsL1Spells: Spell[]) => dispatch({ type: 'SELECT_BARD_FEATURES', payload: { cantrips: cantripsSpells, spellsL1: spellsL1Spells } }), [dispatch]);
  const handleWarlockFeaturesSelect = useCallback((cantripsSpells: Spell[], spellsL1Spells: Spell[]) => dispatch({ type: 'SELECT_WARLOCK_FEATURES', payload: { cantrips: cantripsSpells, spellsL1: spellsL1Spells } }), [dispatch]);
  const handleWeaponMasteriesSelect = useCallback((weaponIds: string[]) => dispatch({ type: 'SELECT_WEAPON_MASTERIES', payload: weaponIds }), [dispatch]);
  const handleFeatSelect = useCallback((featId: string) => dispatch({ type: 'SELECT_FEAT', payload: featId }), [dispatch]);

  const handleFeatConfirm = useCallback(() => {
    const chosenFeat = state.selectedFeat ? featOptions.find(f => f.id === state.selectedFeat) : null;
    const shouldClear = chosenFeat && !chosenFeat.isEligible;
    if (shouldClear) {
      dispatch({ type: 'SELECT_FEAT', payload: '' });
    }
    dispatch({ type: 'CONFIRM_FEAT_STEP' });
  }, [featOptions, state.selectedFeat, dispatch]);

  const handleVisualsChange = useCallback((visuals: Partial<CharacterVisualConfig>) => dispatch({ type: 'SELECT_VISUALS', payload: visuals }), [dispatch]);
  const handleNameAndReviewSubmit = useCallback((name: string) => {
    dispatch({ type: 'SET_CHARACTER_NAME', payload: name });
    assembleAndSubmitCharacter(state, name);
    SafeStorage.removeItem(STORAGE_KEY);
  }, [state, assembleAndSubmitCharacter, dispatch]);

  const handleAgeChange = useCallback((age: number) => {
    const sanitizedAge = Math.max(1, Math.min(999, age || 0));
    dispatch({ type: 'SET_CHARACTER_AGE', payload: sanitizedAge });
  }, [dispatch]);

  const goBack = useCallback(() => dispatch({ type: 'GO_BACK' }), [dispatch]);
  const handleNavigateToStep = useCallback((step: CreationStep) => dispatch({ type: 'NAVIGATE_TO_STEP', payload: step }), [dispatch]);

  const renderStep = (): React.ReactElement | null => {
    if (!allSpells) {
      return <LoadingSpinner message="Loading spell data..." />;
    }
    // ... (Keep existing switch statement logic for steps) ...
    // Note: I'm abbreviating here for clarity, but in the real write I must include the full switch
    switch (state.step) {
      case CreationStep.Race:
        return (
          <RaceSelection
            // Use filtered race list (excludes forced-choice base helpers like elf/tiefling/goliath/eladrin).
            races={ACTIVE_RACES}
            onRaceSelect={handleRaceSelect}
            selectedRaceId={state.selectedRace?.id ?? null}
            racialSelections={state.racialSelections}
            onBack={onExitToMainMenu}
          />
        );
      case CreationStep.AgeSelection:
        if (!selectedRace) { dispatch({ type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <AgeSelection selectedRace={selectedRace} currentAge={state.characterAge} onAgeChange={handleAgeChange} onNext={() => dispatch({ type: 'SET_STEP', payload: CreationStep.BackgroundSelection })} onBack={goBack} />;
      case CreationStep.BackgroundSelection:
        if (!selectedRace) { dispatch({ type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <BackgroundSelection selectedRace={selectedRace} characterAge={state.characterAge} currentBackground={state.selectedBackground} onBackgroundChange={(backgroundId) => dispatch({ type: 'SELECT_BACKGROUND', payload: backgroundId })} onNext={() => dispatch({ type: 'SET_STEP', payload: CreationStep.Visuals })} onBack={goBack} />;
      case CreationStep.Visuals:
        return <VisualsSelection visuals={state.visuals} onVisualsChange={handleVisualsChange} onNext={() => dispatch({ type: 'SET_STEP', payload: CreationStep.Class })} onBack={goBack} />;
      case CreationStep.Class:
        return <ClassSelection classes={Object.values(CLASSES_DATA)} onClassSelect={handleClassSelect} onBack={goBack} />;
      case CreationStep.AbilityScores:
        if (!selectedRace || !selectedClass) { dispatch({ type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <AbilityScoreAllocation race={selectedRace} selectedClass={selectedClass} onAbilityScoresSet={handleAbilityScoresSet} onBack={goBack} />;
      case CreationStep.HumanSkillChoice:
        if (!finalAbilityScores) { dispatch({ type: 'SET_STEP', payload: CreationStep.AbilityScores }); return null; }
        return <HumanSkillSelection abilityScores={finalAbilityScores} onSkillSelect={handleHumanSkillSelect} onBack={goBack} />;
      case CreationStep.Skills:
        if (!selectedClass || !finalAbilityScores || !selectedRace) { dispatch({ type: 'SET_STEP', payload: CreationStep.AbilityScores }); return null; }
        return <SkillSelection charClass={selectedClass} abilityScores={finalAbilityScores} race={selectedRace} racialSelections={state.racialSelections} onSkillsSelect={handleSkillsSelect} onBack={goBack} />;
      case CreationStep.ClassFeatures:
        if (!selectedClass || !finalAbilityScores) { dispatch({ type: 'SET_STEP', payload: CreationStep.Skills }); return null; }
        // ... (Keep existing conditional logic for features) ...
        if (selectedClass.id === 'fighter' && selectedClass.fightingStyles) { return <FighterFeatureSelection styles={selectedClass.fightingStyles} onStyleSelect={handleFighterFeaturesSelect} onBack={goBack} />; }
        if (selectedClass.id === 'cleric' && selectedClass.divineOrders && selectedClass.spellcasting) { return <ClericFeatureSelection divineOrders={selectedClass.divineOrders} spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onClericFeaturesSelect={handleClericFeaturesSelect} onBack={goBack} />; }
        if (selectedClass.id === 'druid' && selectedClass.primalOrders && selectedClass.spellcasting) { return <DruidFeatureSelection primalOrders={selectedClass.primalOrders} spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onDruidFeaturesSelect={handleDruidFeaturesSelect} onBack={goBack} />; }
        if (selectedClass.id === 'wizard' && selectedClass.spellcasting) { return <WizardFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onWizardFeaturesSelect={handleWizardFeaturesSelect} onBack={goBack} />; }
        if (selectedClass.id === 'sorcerer' && selectedClass.spellcasting) { return <SorcererFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onSorcererFeaturesSelect={handleSorcererFeaturesSelect} onBack={goBack} />; }
        if (selectedClass.id === 'bard' && selectedClass.spellcasting) { return <BardFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onBardFeaturesSelect={handleBardFeaturesSelect} onBack={goBack} />; }
        if (selectedClass.id === 'warlock' && selectedClass.spellcasting) { return <WarlockFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onWarlockFeaturesSelect={handleWarlockFeaturesSelect} onBack={goBack} />; }
        if (selectedClass.id === 'ranger' && selectedClass.spellcasting) { return <RangerFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onRangerFeaturesSelect={handleRangerFeaturesSelect} onBack={goBack} />; }
        if (selectedClass.id === 'paladin' && selectedClass.spellcasting) { return <PaladinFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onPaladinFeaturesSelect={handlePaladinFeaturesSelect} onBack={goBack} />; }
        if (selectedClass.id === 'artificer' && selectedClass.spellcasting) { return <ArtificerFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} abilityScores={finalAbilityScores} onArtificerFeaturesSelect={handleArtificerFeaturesSelect} onBack={goBack} />; }
        if ((selectedClass.weaponMasterySlots ?? 0) > 0) { dispatch({ type: 'SET_STEP', payload: CreationStep.WeaponMastery }); } else { dispatch({ type: 'SET_STEP', payload: CreationStep.NameAndReview }); }
        return null;
      case CreationStep.WeaponMastery:
        if (!selectedClass) { dispatch({ type: 'SET_STEP', payload: CreationStep.Class }); return null; }
        return <WeaponMasterySelection charClass={selectedClass} onMasteriesSelect={handleWeaponMasteriesSelect} onBack={goBack} />
      case CreationStep.FeatSelection:
        // Calculate known skills so we can disable them in the Skilled feat picker
        const previewForFeat = generatePreviewCharacter(state, state.characterName);
        const knownSkills = previewForFeat?.skills.map(s => s.id) || [];
        return <FeatSelection availableFeats={featOptions} selectedFeatId={state.selectedFeat || undefined} featChoices={state.featChoices} onSelectFeat={handleFeatSelect} onSetFeatChoice={(featId, choiceType, value) => { dispatch({ type: 'SET_FEAT_CHOICE', payload: { featId, choiceType, value } }); }} onConfirm={handleFeatConfirm} onBack={goBack} hasEligibleFeats={hasEligibleFeats} dispatch={appDispatch} knownSkillIds={knownSkills} />;
      case CreationStep.NameAndReview:
        {
          const characterToPreview: PlayerCharacter | null = generatePreviewCharacter(state, state.characterName);
          if (!characterToPreview) {
            console.error("Missing critical data for review step. Reverting to Race Selection.", state);
            dispatch({ type: 'SET_STEP', payload: CreationStep.Race });
            return <p className="text-red-400">Error: Missing critical character data. Returning to start.</p>;
          }
          return (
            <NameAndReview
              characterPreview={characterToPreview}
              onConfirm={handleNameAndReviewSubmit}
              initialName={state.characterName}
              onNameDraftChange={(nextName) => dispatch({ type: 'SET_CHARACTER_NAME', payload: nextName })}
              visualDescription={state.visualDescription}
              onVisualDescriptionChange={(nextDescription) => dispatch({ type: 'SET_VISUAL_DESCRIPTION', payload: nextDescription })}
              portraitsEnabled={ENV.VITE_ENABLE_PORTRAITS}
              portrait={state.portrait}
              onGeneratePortrait={handleGeneratePortrait}
              onCancelPortrait={handleCancelPortrait}
              onClearPortrait={handleClearPortrait}
              onBack={goBack}
              featStepSkipped={state.featStepSkipped}
            />
          );
        }
      default:
        return <p>Unknown character creation step.</p>;
    }
  };

  return (
    <WindowFrame
      title="Create Your Adventurer"
      onClose={onExitToMainMenu}
      storageKey={WINDOW_KEYS.CHARACTER_CREATOR}
      headerActions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSidebar(!showSidebar)}
          title={showSidebar ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          {showSidebar ? '◧' : '☐'}
        </Button>
      }
    >
      <div className="flex h-full bg-gray-900 text-gray-200">
        {/* Sidebar */}
        {showSidebar && (
          <CreationSidebar
            currentStep={state.step}
            state={state}
            onNavigateToStep={handleNavigateToStep}
          />
        )}

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0 bg-gray-800">
          <div className="flex-grow overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={state.step}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
};

export default CharacterCreator;
