
/**
 * @file CharacterCreator.tsx
 * This is the main component for the character creation process in Aralia RPG.
 * It guides the user through several steps: Race Selection, Class Selection,
 * Ability Score Allocation, Skill Selection, Class-Specific Feature Selection (e.g., Fighting Style, Divine Domain, Spells),
 * Weapon Mastery selection, and finally Naming and Reviewing the character.
 * It manages the state for each step using a useReducer hook.
 */
import React, { useReducer, useCallback, useContext, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PlayerCharacter,
  AbilityScores,
  Skill,
  Spell,
  FightingStyle,
  AbilityScoreName,
  DraconicAncestryInfo,
  ElvenLineageType,
  GnomeSubraceType,
  GiantAncestryType,
  FiendishLegacyType,
  Item,
  Class as CharClass,
  DraconicAncestorType,
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
import ClassSelection from './ClassSelection';
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
import DragonbornAncestrySelection from './Race/DragonbornAncestrySelection';
import ElfLineageSelection from './Race/ElvenLineageSelection';
import GnomeSubraceSelection from './Race/GnomeSubraceSelection';
import GiantAncestrySelection from './Race/GiantAncestrySelection';
import TieflingLegacySelection from './Race/TieflingLegacySelection';
import CentaurNaturalAffinitySkillSelection from './Race/CentaurNaturalAffinitySkillSelection';
import ChangelingInstinctsSelection from './Race/ChangelingInstinctsSelection';
import RacialSpellAbilitySelection from './Race/RacialSpellAbilitySelection';
import NameAndReview from './NameAndReview';
import {
  CreationStep,
  characterCreatorReducer,
  initialCharacterCreatorState,
} from './state/characterCreatorState';

// Helper function to determine the next step based on current step and state
const getNextStep = (state: any, selectedRace: any, racialSelections: any): CreationStep => {
  switch (state.step) {
    case CreationStep.AgeSelection:
      return CreationStep.BackgroundSelection;
    case CreationStep.BackgroundSelection:
      // Logic based on determineNextStepAfterBackground from state file
      if (selectedRace.id === 'dragonborn') return CreationStep.DragonbornAncestry;
      if (selectedRace.id === 'elf') return CreationStep.ElvenLineage;
      if (selectedRace.id === 'gnome') return CreationStep.GnomeSubrace;
      if (selectedRace.id === 'goliath') return CreationStep.GiantAncestry;
      if (selectedRace.id === 'tiefling') return CreationStep.TieflingLegacy;
      if (selectedRace.id === 'centaur') return CreationStep.CentaurNaturalAffinitySkill;
      if (selectedRace.id === 'changeling') return CreationStep.ChangelingInstincts;
      return CreationStep.Class;
    default:
      return CreationStep.Class; // fallback
  }
};
import { useCharacterAssembly } from './hooks/useCharacterAssembly';
import SpellContext from '../../context/SpellContext';
import LoadingSpinner from '../LoadingSpinner';


interface CharacterCreatorProps {
  onCharacterCreate: (character: PlayerCharacter, startingInventory: Item[]) => void;
  onExitToMainMenu: () => void;
  dispatch: React.Dispatch<any>;
}

// Main CharacterCreator component.
const CharacterCreator: React.FC<CharacterCreatorProps> = ({ onCharacterCreate, onExitToMainMenu, dispatch: appDispatch }) => {
  const [state, dispatch] = useReducer(characterCreatorReducer, initialCharacterCreatorState);
  const allSpells = useContext(SpellContext);

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
        // Do not pass the in-progress selection as "known"—that would mark it as already learned and
        // erroneously disable confirmation. We only want to block feats for unmet prerequisites.
        knownFeats: [],
        hasFightingStyle: !!(selectedClass?.fightingStyles && selectedClass.fightingStyles.length > 0),
      });

      return { ...feat, isEligible: eligibility.isEligible, unmet: eligibility.unmet };
    });
  }, [finalAbilityScores, selectedRace, selectedClass, state.baseAbilityScores, state.selectedFeat]);

  // A quick availability check lets us skip the feat screen when no picks are valid and helps the UI explain why skipping is fine.
  const hasEligibleFeats = useMemo(() => featOptions.some(option => option.isEligible), [featOptions]);

  const handleRaceSelect = useCallback((raceId: string) => {
    dispatch({ type: 'SELECT_RACE', payload: RACES_DATA[raceId] });
  }, [dispatch]);

  const handleDragonbornAncestrySelect = useCallback((ancestry: DraconicAncestorType) => {
    dispatch({ type: 'SELECT_DRAGONBORN_ANCESTRY', payload: ancestry });
  }, [dispatch]);

  const handleElvenLineageSelect = useCallback((lineageId: ElvenLineageType, spellAbility: AbilityScoreName) => {
    dispatch({ type: 'SELECT_ELVEN_LINEAGE', payload: { lineageId, spellAbility } });
  }, [dispatch]);

  const handleGnomeSubraceSelect = useCallback((subraceId: GnomeSubraceType, spellAbility: AbilityScoreName) => {
    dispatch({ type: 'SELECT_GNOME_SUBRACE', payload: { subraceId, spellAbility } });
  }, [dispatch]);

  const handleGiantAncestrySelect = useCallback((benefitId: GiantAncestryType) => {
    dispatch({ type: 'SELECT_GIANT_ANCESTRY', payload: benefitId });
  }, [dispatch]);

  const handleTieflingLegacySelect = useCallback((legacyId: FiendishLegacyType, spellAbility: AbilityScoreName) => {
    dispatch({ type: 'SELECT_TIEFLING_LEGACY', payload: { legacyId, spellAbility } });
  }, [dispatch]);
  
  const handleRacialSpellAbilitySelect = useCallback((ability: AbilityScoreName) => {
    dispatch({ type: 'SELECT_RACIAL_SPELL_ABILITY', payload: ability });
  }, [dispatch]);

  const handleCentaurNaturalAffinitySkillSelect = useCallback((skillId: string) => {
    dispatch({ type: 'SELECT_CENTAUR_NATURAL_AFFINITY_SKILL', payload: skillId });
  }, [dispatch]);

  const handleChangelingInstinctsSelect = useCallback((skillIds: string[]) => {
    dispatch({ type: 'SELECT_CHANGELING_INSTINCTS', payload: skillIds });
  }, [dispatch]);

  const handleClassSelect = useCallback((classId: string) => {
    dispatch({ type: 'SELECT_CLASS', payload: CLASSES_DATA[classId] });
  }, [dispatch]);

  const handleAbilityScoresSet = useCallback((scores: AbilityScores) => {
    dispatch({ type: 'SET_ABILITY_SCORES', payload: { baseScores: scores } });
  }, [dispatch]);

  const handleHumanSkillSelect = useCallback((skillId: string) => {
    dispatch({ type: 'SELECT_HUMAN_SKILL', payload: skillId });
  }, [dispatch]);

  const handleSkillsSelect = useCallback((skills: Skill[]) => {
    dispatch({ type: 'SELECT_SKILLS', payload: skills });
  }, [dispatch]);

  const handleFighterFeaturesSelect = useCallback((style: FightingStyle) => {
    dispatch({ type: 'SELECT_FIGHTER_FEATURES', payload: style });
  }, [dispatch]);

  const handleClericFeaturesSelect = useCallback((order: 'Protector' | 'Thaumaturge', cantrips: Spell[], spellsL1: Spell[]) => {
    dispatch({ type: 'SELECT_CLERIC_FEATURES', payload: { order, cantrips, spellsL1 } });
  }, [dispatch]);

  const handleDruidFeaturesSelect = useCallback((order: 'Magician' | 'Warden', cantrips: Spell[], spellsL1: Spell[]) => {
    dispatch({ type: 'SELECT_DRUID_FEATURES', payload: { order, cantrips, spellsL1 } });
  }, [dispatch]);
  
  const handleWizardFeaturesSelect = useCallback((cantripsSpells: Spell[], spellsL1Spells: Spell[]) => {
    dispatch({ type: 'SELECT_WIZARD_FEATURES', payload: { cantrips: cantripsSpells, spellsL1: spellsL1Spells } });
  }, [dispatch]);
  
  const handleSorcererFeaturesSelect = useCallback((cantrips: Spell[], spellsL1: Spell[]) => {
    dispatch({ type: 'SELECT_SORCERER_FEATURES', payload: { cantrips, spellsL1 } });
  }, [dispatch]);
  
  const handleRangerFeaturesSelect = useCallback((spellsL1: Spell[]) => {
    dispatch({ type: 'SELECT_RANGER_FEATURES', payload: { spellsL1 } });
  }, [dispatch]);

  const handlePaladinFeaturesSelect = useCallback((spellsL1: Spell[]) => {
    dispatch({ type: 'SELECT_PALADIN_FEATURES', payload: { spellsL1 } });
  }, [dispatch]);

  const handleArtificerFeaturesSelect = useCallback((cantripsSpells: Spell[], spellsL1Spells: Spell[]) => {
    dispatch({ type: 'SELECT_ARTIFICER_FEATURES', payload: { cantrips: cantripsSpells, spellsL1: spellsL1Spells } });
  }, [dispatch]);

  const handleBardFeaturesSelect = useCallback((cantripsSpells: Spell[], spellsL1Spells: Spell[]) => {
    dispatch({ type: 'SELECT_BARD_FEATURES', payload: { cantrips: cantripsSpells, spellsL1: spellsL1Spells } });
  }, [dispatch]);

  const handleWarlockFeaturesSelect = useCallback((cantripsSpells: Spell[], spellsL1Spells: Spell[]) => {
    dispatch({ type: 'SELECT_WARLOCK_FEATURES', payload: { cantrips: cantripsSpells, spellsL1: spellsL1Spells } });
  }, [dispatch]);
  
  const handleWeaponMasteriesSelect = useCallback((weaponIds: string[]) => {
    dispatch({ type: 'SELECT_WEAPON_MASTERIES', payload: weaponIds });
  }, [dispatch]);

  const handleFeatSelect = useCallback((featId: string) => {
    // Only record the selection here; advancing now happens via an explicit confirmation button so players can compare options.
    dispatch({ type: 'SELECT_FEAT', payload: featId });
  }, [dispatch]);

  const handleFeatConfirm = useCallback(() => {
    // Guard against stale/ineligible selections: if the chosen feat is no longer valid, clear it before advancing.
    const chosenFeat = state.selectedFeat ? featOptions.find(f => f.id === state.selectedFeat) : null;
    const shouldClear = chosenFeat && !chosenFeat.isEligible;
    if (shouldClear) {
      dispatch({ type: 'SELECT_FEAT', payload: '' });
    }
    dispatch({ type: 'CONFIRM_FEAT_STEP' });
  }, [featOptions, state.selectedFeat, dispatch]);

  const handleNameAndReviewSubmit = useCallback((name: string) => {
    dispatch({type: 'SET_CHARACTER_NAME', payload: name});
    assembleAndSubmitCharacter(state, name);
  }, [state, assembleAndSubmitCharacter, dispatch]);

  const handleAgeChange = useCallback((age: number) => {
    // Clamp the input locally so the reducer only ever receives valid, displayable values and the UI stays in sync.
    const sanitizedAge = Math.max(1, Math.min(999, age || 0));
    dispatch({ type: 'SET_CHARACTER_AGE', payload: sanitizedAge });
  }, [dispatch]);

  const goBack = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, [dispatch]);


  const renderStep = (): React.ReactElement | null => {
    if (!allSpells) {
        return <LoadingSpinner message="Loading spell data..." />;
    }
    switch (state.step) {
      case CreationStep.Race:
        return <RaceSelection races={Object.values(RACES_DATA)} onRaceSelect={handleRaceSelect} />;
      case CreationStep.AgeSelection:
        if (!selectedRace) { dispatch({type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <AgeSelection
          selectedRace={selectedRace}
          currentAge={state.characterAge}
          onAgeChange={(age) => dispatch({ type: 'SET_CHARACTER_AGE', payload: age })}
          onNext={() => dispatch({ type: 'SET_STEP', payload: getNextStep(state, selectedRace, state.racialSelections) })}
          onBack={goBack}
        />;
      case CreationStep.BackgroundSelection:
        if (!selectedRace) { dispatch({type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <BackgroundSelection
          selectedRace={selectedRace}
          characterAge={state.characterAge}
          currentBackground={state.selectedBackground}
          onBackgroundChange={(backgroundId) => dispatch({ type: 'SELECT_BACKGROUND', payload: backgroundId })}
          onNext={() => dispatch({ type: 'SET_STEP', payload: getNextStep(state, selectedRace, state.racialSelections) })}
          onBack={goBack}
        />;
      case CreationStep.DragonbornAncestry:
        return <DragonbornAncestrySelection onAncestrySelect={handleDragonbornAncestrySelect} onBack={goBack} />;
      case CreationStep.ElvenLineage:
        if (!selectedRace?.elvenLineages) { dispatch({type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <ElfLineageSelection lineages={selectedRace.elvenLineages} onLineageSelect={handleElvenLineageSelect} onBack={goBack} />;
      case CreationStep.GnomeSubrace:
        if (!selectedRace?.gnomeSubraces) { dispatch({type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <GnomeSubraceSelection subraces={selectedRace.gnomeSubraces} onSubraceSelect={handleGnomeSubraceSelect} onBack={goBack} />;
      case CreationStep.GiantAncestry:
        if (!selectedRace?.giantAncestryChoices) { dispatch({type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <GiantAncestrySelection onAncestrySelect={handleGiantAncestrySelect} onBack={goBack} />;
      case CreationStep.TieflingLegacy:
        if (!selectedRace?.fiendishLegacies) { dispatch({type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <TieflingLegacySelection onLegacySelect={handleTieflingLegacySelect} onBack={goBack} />;
      case CreationStep.CentaurNaturalAffinitySkill:
        return <CentaurNaturalAffinitySkillSelection onSkillSelect={handleCentaurNaturalAffinitySkillSelect} onBack={goBack} />;
      case CreationStep.ChangelingInstincts:
        return <ChangelingInstinctsSelection onSkillsSelect={handleChangelingInstinctsSelect} onBack={goBack} />;
      case CreationStep.RacialSpellAbilityChoice:
        if (!racialSpellChoiceContext || !finalAbilityScores || !selectedClass) { dispatch({ type: 'SET_STEP', payload: CreationStep.AbilityScores }); return null; }
        return <RacialSpellAbilitySelection
          raceName={racialSpellChoiceContext.raceName}
          traitName={racialSpellChoiceContext.traitName}
          traitDescription={racialSpellChoiceContext.traitDescription}
          onAbilitySelect={handleRacialSpellAbilitySelect}
          onBack={goBack}
          abilityScores={finalAbilityScores}
          selectedClass={selectedClass}
        />;
      case CreationStep.Class:
        return <ClassSelection classes={Object.values(CLASSES_DATA)} onClassSelect={handleClassSelect} onBack={goBack} />;
      case CreationStep.AbilityScores:
        if (!selectedRace || !selectedClass) { dispatch({type: 'SET_STEP', payload: CreationStep.Race }); return null; }
        return <AbilityScoreAllocation race={selectedRace} selectedClass={selectedClass} onAbilityScoresSet={handleAbilityScoresSet} onBack={goBack} />;
      case CreationStep.HumanSkillChoice:
        if (!finalAbilityScores) { dispatch({type: 'SET_STEP', payload: CreationStep.AbilityScores }); return null; } 
        return <HumanSkillSelection abilityScores={finalAbilityScores} onSkillSelect={handleHumanSkillSelect} onBack={goBack} />;
      case CreationStep.Skills:
        if (!selectedClass || !finalAbilityScores || !selectedRace) { dispatch({type: 'SET_STEP', payload: CreationStep.AbilityScores }); return null; }
        return <SkillSelection charClass={selectedClass} abilityScores={finalAbilityScores} race={selectedRace} racialSelections={state.racialSelections} onSkillsSelect={handleSkillsSelect} onBack={goBack} />;
      case CreationStep.ClassFeatures:
        if (!selectedClass || !finalAbilityScores) { dispatch({type: 'SET_STEP', payload: CreationStep.Skills }); return null; }
        if (selectedClass.id === 'fighter' && selectedClass.fightingStyles) {
          return <FighterFeatureSelection styles={selectedClass.fightingStyles} onStyleSelect={handleFighterFeaturesSelect} onBack={goBack} />;
        }
        if (selectedClass.id === 'cleric' && selectedClass.divineOrders && selectedClass.spellcasting) {
          return <ClericFeatureSelection divineOrders={selectedClass.divineOrders} spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onClericFeaturesSelect={handleClericFeaturesSelect} onBack={goBack} />;
        }
        if (selectedClass.id === 'druid' && selectedClass.primalOrders && selectedClass.spellcasting) {
            return <DruidFeatureSelection primalOrders={selectedClass.primalOrders} spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onDruidFeaturesSelect={handleDruidFeaturesSelect} onBack={goBack} />;
        }
        if (selectedClass.id === 'wizard' && selectedClass.spellcasting) {
          return <WizardFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onWizardFeaturesSelect={handleWizardFeaturesSelect} onBack={goBack} />;
        }
        if (selectedClass.id === 'sorcerer' && selectedClass.spellcasting) {
          return <SorcererFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onSorcererFeaturesSelect={handleSorcererFeaturesSelect} onBack={goBack} />;
        }
         if (selectedClass.id === 'bard' && selectedClass.spellcasting) {
          return <BardFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onBardFeaturesSelect={handleBardFeaturesSelect} onBack={goBack} />;
        }
         if (selectedClass.id === 'warlock' && selectedClass.spellcasting) {
          return <WarlockFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onWarlockFeaturesSelect={handleWarlockFeaturesSelect} onBack={goBack} />;
        }
        if (selectedClass.id === 'ranger' && selectedClass.spellcasting) {
          return <RangerFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onRangerFeaturesSelect={handleRangerFeaturesSelect} onBack={goBack} />;
        }
         if (selectedClass.id === 'paladin' && selectedClass.spellcasting) {
          return <PaladinFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} onPaladinFeaturesSelect={handlePaladinFeaturesSelect} onBack={goBack} />;
        }
        if (selectedClass.id === 'artificer' && selectedClass.spellcasting) {
          return <ArtificerFeatureSelection spellcastingInfo={selectedClass.spellcasting} allSpells={allSpells} abilityScores={finalAbilityScores} onArtificerFeaturesSelect={handleArtificerFeaturesSelect} onBack={goBack} />;
        }
        if ((selectedClass.weaponMasterySlots ?? 0) > 0) {
            dispatch({ type: 'SET_STEP', payload: CreationStep.WeaponMastery });
        } else {
            dispatch({ type: 'SET_STEP', payload: CreationStep.NameAndReview });
        }
        return null;
      case CreationStep.WeaponMastery:
         if (!selectedClass) { dispatch({type: 'SET_STEP', payload: CreationStep.Class }); return null; }
         return <WeaponMasterySelection charClass={selectedClass} onMasteriesSelect={handleWeaponMasteriesSelect} onBack={goBack} />
      case CreationStep.FeatSelection:
         return (
          <FeatSelection
            availableFeats={featOptions}
            selectedFeatId={state.selectedFeat || undefined}
            featChoices={state.featChoices}
            onSelectFeat={handleFeatSelect}
            onSetFeatChoice={(featId, choiceType, value) => {
              dispatch({ type: 'SET_FEAT_CHOICE', payload: { featId, choiceType, value } });
            }}
            onConfirm={handleFeatConfirm}
            onBack={goBack}
            hasEligibleFeats={hasEligibleFeats}
            dispatch={appDispatch}
          />
        );
      case CreationStep.NameAndReview:
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
                onBack={goBack}
                featStepSkipped={state.featStepSkipped}
            />
        );
      default:
        return <p>Unknown character creation step.</p>;
    }
  };

  const isFullScreenStep = state.step === CreationStep.Race || state.step === CreationStep.Class;

  return (
    <div 
      className={
        isFullScreenStep 
          ? "h-screen bg-gray-900 text-gray-200" 
          : "min-h-screen bg-gray-900 text-gray-200 p-4 flex flex-col items-center justify-center"
      }
    >
      <div 
        className={
          isFullScreenStep
            ? "bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full h-full flex flex-col" 
            : "bg-gray-800 p-6 md:p-10 rounded-xl shadow-2xl border border-gray-700 w-full max-w-4xl relative" 
        }
      >
        <h1 
          className={`text-3xl md:text-4xl font-bold text-amber-400 text-center font-cinzel 
            ${isFullScreenStep ? 'p-4 sm:p-6 md:p-8 flex-shrink-0' : 'mb-8'}`
          }
        >
          Create Your Adventurer
        </h1>
        <div 
          className={
            isFullScreenStep 
              ? 'flex-grow overflow-y-auto scrollable-content px-4 sm:px-6 md:px-8 pb-4 sm:pb-6 md:pb-8' 
              : ''
          }
        >
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>
        <div 
          className={`border-t border-gray-700 
            ${isFullScreenStep ? 'p-4 sm:p-6 md:p-8 mt-auto flex-shrink-0' : 'mt-8 pt-6'}`
          }
        >
          <button
            onClick={onExitToMainMenu}
            className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md transition-colors duration-150"
            aria-label="Exit character creation and return to main menu"
          >
            Back to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default CharacterCreator;
