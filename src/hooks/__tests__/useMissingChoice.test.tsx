
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useMissingChoice } from '../useMissingChoice';
import { PlayerCharacter, MissingChoice, AppAction } from '../../types';

describe('useMissingChoice', () => {
  const mockDispatch = vi.fn();
  const mockAddMessage = vi.fn();

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useMissingChoice(mockDispatch, mockAddMessage));
    expect(result.current.missingChoiceModal).toEqual({
      isOpen: false,
      character: null,
      missingChoice: null,
    });
  });

  it('should open modal when handleFixMissingChoice is called', () => {
    const { result } = renderHook(() => useMissingChoice(mockDispatch, mockAddMessage));
    const mockCharacter = { id: 'char1', name: 'Test Char' } as PlayerCharacter;
    const mockMissingChoice = { id: 'missing1', label: 'Missing Trait', options: [] } as MissingChoice;

    act(() => {
      result.current.handleFixMissingChoice(mockCharacter, mockMissingChoice);
    });

    expect(result.current.missingChoiceModal).toEqual({
      isOpen: true,
      character: mockCharacter,
      missingChoice: mockMissingChoice,
    });
  });

  it('should dispatch action and add message on confirm', () => {
    const { result } = renderHook(() => useMissingChoice(mockDispatch, mockAddMessage));
    const mockCharacter = { id: 'char1', name: 'Test Char' } as PlayerCharacter;
    const mockMissingChoice = { id: 'missing1', label: 'Missing Trait', options: [] } as MissingChoice;

    act(() => {
      result.current.handleFixMissingChoice(mockCharacter, mockMissingChoice);
    });

    act(() => {
      result.current.handleConfirmMissingChoice('option1', { some: 'data' });
    });

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_CHARACTER_CHOICE',
      payload: {
        characterId: 'char1',
        choiceType: 'missing1',
        choiceId: 'option1',
        secondaryValue: { some: 'data' },
      },
    });

    expect(mockAddMessage).toHaveBeenCalledWith(
      'Updated Test Char: Selected option1.',
      'system'
    );
  });
});
