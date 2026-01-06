
import React from 'react';
// TODO(lint-intent): 'waitFor' is unused in this test; use it in the assertion path or remove it.
import { render, screen, fireEvent, waitFor as _waitFor } from '@testing-library/react';
// TODO(lint-intent): 'expect' is unused in this test; use it in the assertion path or remove it.
import { vi, describe, it, expect as _expect } from 'vitest';
import GameGuideModal from '../ui/GameGuideModal';
import * as geminiService from '../../services/geminiService';
// TODO(lint-intent): 't' is unused in this test; use it in the assertion path or remove it.
import { t as _t } from '../../utils/i18n';

// Mock geminiService
vi.mock('../../services/geminiService', () => ({
  generateGuideResponse: vi.fn(),
}));
const mockGenerateGuideResponse = geminiService.generateGuideResponse as unknown as ReturnType<typeof vi.fn>;

// Mock i18n
vi.mock('../../utils/i18n', () => ({
  // TODO(lint-intent): 'params' is unused in this test; use it in the assertion path or remove it.
  // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
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

  it('handles malicious JSON payload gracefully', async () => {
    // Malformed JSON that would crash JSON.parse
    const maliciousPayload = `
      Here is your character:
      \`\`\`json
      { "tool": "create_character", "config": { "name": "Hack" }
      \`\`\`
    `; // Missing closing brace
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    mockGenerateGuideResponse.mockResolvedValue({        
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
    // TODO(lint-intent): Replace any with the minimal test shape so the behavior stays explicit.
    mockGenerateGuideResponse.mockResolvedValue({        
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
