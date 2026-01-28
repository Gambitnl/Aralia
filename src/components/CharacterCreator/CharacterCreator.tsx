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
  AbilityScoreName,
  Item,
} from '../../types';
import {
  RACES_DATA,
  CLASSES_DATA,
} from '../../constants';
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
import CentaurNaturalAffinitySkillSelection from './Race/CentaurNaturalAffinitySkillSelection';
import ChangelingInstinctsSelection from './Race/ChangelingInstinctsSelection';
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
import SpellContext from '../../context/SpellContext';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { WindowFrame } from '../ui/WindowFrame';
import { Button } from '../ui/Button';
import { WizardStepper } from '../ui/WizardStepper';
import { SIDEBAR_STEPS, isStepCompleted } from './config/sidebarSteps';

// Helper function to determine the next step
const getNextStep = (state: CharacterCreationState): CreationStep => {
  switch (state.step) {
    case CreationStep.AgeSelection:
      return CreationStep.BackgroundSelection;
    case CreationStep.BackgroundSelection:
      return CreationStep.Visuals;
    case CreationStep.Visuals:
      return CreationStep.Class;
    default:
      return CreationStep.Class; // fallback
  }
};

interface CharacterCreatorProps {
  onCharacterCreate: (character: PlayerCharacter, startingInventory: Item[]) => void;
  onExitToMainMenu: () => void;
  dispatch: React.Dispatch<AppAction>;
}

const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onCharacterCreate, onExitToMainMenu, dispatch: appDispatch }) => {
  const [state, dispatch] = useReducer(characterCreatorReducer, initialCharacterCreatorState);
  const allSpells = useContext(SpellContext);
  const [showSidebar, setShowSidebar] = useState(true);

  const { assembleAndSubmitCharacter, generatePreviewCharacter } = useCharacterAssembly({
    onCharacterCreate
  });

  const { selectedRace, selectedClass, finalAbilityScores, racialSpellChoiceContext } = state;

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
  const handleRaceSelect = useCallback((raceId: string, choices?: { spellAbility?: 'Intelligence' | 'Wisdom' | 'Charisma' }) => {
    dispatch({ type: 'SELECT_RACE', payload: RACES_DATA[raceId] });
    // Spell ability choices are now handled inline within the SELECT_RACE action via racialSelections
  }, [dispatch]);
  // Deprecated handlers removed: handleDragonbornAncestrySelect, handleElvenLineageSelect,
  // handleGnomeSubraceSelect, handleGiantAncestrySelect, handleTieflingLegacySelect, handleRacialSpellAbilitySelect
  // These are now handled inline via handleRaceSelect with RacialChoiceData
  const handleCentaurNaturalAffinitySkillSelect = useCallback((skillId: string) => dispatch({ type: 'SELECT_CENTAUR_NATURAL_AFFINITY_SKILL', payload: skillId }), [dispatch]);
  const handleChangelingInstinctsSelect = useCallback((skillIds: string[]) => dispatch({ type: 'SELECT_CHANGELING_INSTINCTS', payload: skillIds }), [dispatch]);
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
        return <RaceSelection races={Object.values(RACES_DATA)} onRaceSelect={handleRaceSelect} />;
      case CreationStep.AgeSelection:
        if (!selectedRace) { dispatch({ type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <AgeSelection selectedRace={selectedRace} currentAge={state.characterAge} onAgeChange={handleAgeChange} onNext={() => dispatch({ type: 'SET_STEP', payload: getNextStep(state) })} onBack={goBack} />;
      case CreationStep.BackgroundSelection:
        if (!selectedRace) { dispatch({ type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <BackgroundSelection selectedRace={selectedRace} characterAge={state.characterAge} currentBackground={state.selectedBackground} onBackgroundChange={(backgroundId) => dispatch({ type: 'SELECT_BACKGROUND', payload: backgroundId })} onNext={() => dispatch({ type: 'SET_STEP', payload: getNextStep(state) })} onBack={goBack} />;
      case CreationStep.Visuals:
        return <VisualsSelection visuals={state.visuals} onVisualsChange={handleVisualsChange} onNext={() => dispatch({ type: 'SET_STEP', payload: CreationStep.Class })} onBack={goBack} />;
      // Deprecated steps removed: DragonbornAncestry, ElvenLineage, GnomeSubrace, GiantAncestry, TieflingLegacy
      // These are now handled inline in RaceDetailPane
      case CreationStep.CentaurNaturalAffinitySkill:
        return <CentaurNaturalAffinitySkillSelection onSkillSelect={handleCentaurNaturalAffinitySkillSelect} onBack={goBack} />;
      case CreationStep.ChangelingInstincts:
        return <ChangelingInstinctsSelection onSkillsSelect={handleChangelingInstinctsSelect} onBack={goBack} />;
      // Deprecated step removed: RacialSpellAbilityChoice - now handled inline in RaceDetailPane
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
          return <NameAndReview characterPreview={characterToPreview} onConfirm={handleNameAndReviewSubmit} initialName={state.characterName} onBack={goBack} featStepSkipped={state.featStepSkipped} />;
        }
      default:
        return <p>Unknown character creation step.</p>;
    }
  };

  return (
    <WindowFrame
      title="Create Your Adventurer"
      onClose={onExitToMainMenu}
      storageKey="character-creator-window"
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
      <div className="flex flex-col h-full bg-gray-900 text-gray-200">
        {/* Global Stepper */}
        <div className="bg-gray-800 border-b border-gray-700">
          <WizardStepper
            steps={SIDEBAR_STEPS.filter(s => s.isVisible(state)).map((config, index, array) => {
               // Determine lock status: Locked if previous step is incomplete AND this step is not active
               // This is a simplification; we might want to allow jumping back always.
               const isPreviousComplete = index === 0 || isStepCompleted(array[index - 1].step, state);
               const isUnlocked = isPreviousComplete || config.step === state.step || isStepCompleted(config.step, state);
               
               return {
                id: config.step,
                label: config.label,
                isCompleted: isStepCompleted(config.step, state),
                isActive: state.step === config.step,
                isLocked: !isUnlocked
              };
            })}
            onStepClick={(stepId) => handleNavigateToStep(stepId as CreationStep)}
          />
        </div>

        <div className="flex flex-1 min-h-0">
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
      </div>
    </WindowFrame>
  );
};

export default CharacterCreator;
