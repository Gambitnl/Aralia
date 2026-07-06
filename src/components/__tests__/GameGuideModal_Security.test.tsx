
/**
 * @file GameGuideModal_Security.test.tsx
 * 
 * CHANGE LOG:
 * 2026-02-27 09:24:00: [Preservationist] Migrated tests to mock 
 * 'ollamaTextService' instead of 'geminiService' to match the 
 * component's current implementation. Added 'success: true' to mocked 
 * responses to satisfy the internal result validation.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, expect, it } from 'vitest';
import GameGuideModal from '../ui/GameGuideModal';
import * as ollamaService from '../../services/ollamaTextService';

// Mock ollamaService
vi.mock('../../services/ollamaTextService', () => ({
  generateGuideResponse: vi.fn(),
}));
const mockGenerateGuideResponse = ollamaService.generateGuideResponse as unknown as ReturnType<typeof vi.fn>;

// Mock i18n
vi.mock('../../utils/i18n', () => ({
  t: (key: string, _params?: Record<string, unknown>) => key,
}));

// Mock constants
vi.mock('../../constants', () => ({
  RACES_DATA: {
    human: { id: 'human', name: 'Human' }
  },
  AVAILABLE_CLASSES: [
    { id: 'fighter', name: 'Fighter' }
  ]
}));

describe('GameGuideModal Security Tests', () => {
  const mockOnClose = vi.fn();
  const mockOnAction = vi.fn();
  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    gameContext: 'test context',
    devModelOverride: null,
    onAction: mockOnAction
  };

  it('keeps the Oracle prompt controls inside compact modal widths', () => {
    render(<GameGuideModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('game_guide.placeholder_query');
    const submit = screen.getByRole('button', { name: 'game_guide.button_ask' });
    const close = screen.getByRole('button', { name: 'Close guide' });
    const promptRow = input.parentElement;

    expect(promptRow).toHaveClass('flex-col', 'sm:flex-row');
    expect(input).toHaveClass('min-w-0', 'w-full');
    expect(submit).toHaveClass('w-full', 'sm:w-auto', 'sm:flex-shrink-0');
    expect(close).toHaveClass('h-11', 'w-11');
  });

  it('keeps expanded Oracle rites controls large enough for cramped play', () => {
    render(<GameGuideModal {...defaultProps} />);

    const toolsToggle = screen.getByRole('button', { name: 'game_guide.toggle_tools_show' });
    fireEvent.click(toolsToggle);

    const expandedToggle = screen.getByRole('button', { name: 'game_guide.toggle_tools_hide' });
    const [raceSelect, classSelect] = screen.getAllByRole('combobox');
    const generateButton = screen.getByRole('button', { name: 'game_guide.button_generate' });
    const input = screen.getByPlaceholderText('game_guide.placeholder_query');
    const submit = screen.getByRole('button', { name: 'game_guide.button_ask' });

    // Phone players need the same practical target size in the optional rites
    // panel as they get from the core prompt and close controls.
    expect(expandedToggle).toHaveClass('min-h-11');
    expect(raceSelect).toHaveClass('min-h-11');
    expect(classSelect).toHaveClass('min-h-11');
    expect(generateButton).toHaveClass('min-h-11');
    expect(input).toHaveClass('min-h-11');
    expect(submit).toHaveClass('min-h-11');
  });

  it('handles malicious JSON payload gracefully', async () => {
    // Malformed JSON that would crash JSON.parse
    const maliciousPayload = `
      Here is your character:
      \`\`\`json
      { "tool": "create_character", "config": { "name": "Hack" }
      \`\`\`
    `; // Missing closing brace
    mockGenerateGuideResponse.mockResolvedValue({        
      success: true,
      data: { text: maliciousPayload }
    });

    render(<GameGuideModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('game_guide.placeholder_query');
    fireEvent.change(input, { target: { value: 'Make me a character' } });
    fireEvent.submit(input.closest('form')!);

    // Should not crash, but log error and show text
    // Use findByText with exact: false to handle whitespace differences
    await screen.findByText(/Here is your character/, { exact: false });
  });

  it('handles null/undefined tool data gracefully', async () => {
    // Valid JSON but null config
    const nullConfigPayload = `
      \`\`\`json
      { "tool": "create_character", "config": null }
      \`\`\`
    `;
    mockGenerateGuideResponse.mockResolvedValue({        
      success: true,
      data: { text: nullConfigPayload }
    });

    render(<GameGuideModal {...defaultProps} />);

    const input = screen.getByPlaceholderText('game_guide.placeholder_query');
    fireEvent.change(input, { target: { value: 'Make me a character' } });
    fireEvent.submit(input.closest('form')!);

    // Should not crash
    // We expect the raw text to be displayed because the tool validation fails
    await screen.findByText(/"config": null/, { exact: false });
  });
});
