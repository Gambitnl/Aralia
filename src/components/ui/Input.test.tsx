import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input, Select, TextArea } from './Input';

describe('Input primitives accessibility feedback', () => {
  it('links text input labels and errors to the native control', () => {
    render(<Input label="Character name" error="Name is required" />);

    const input = screen.getByLabelText('Character name');
    const feedback = screen.getByText(/Name is required/);

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', feedback.id);
  });

  it('links helper text without marking the field invalid', () => {
    render(<Input label="Campaign code" helperText="Optional table identifier" />);

    const input = screen.getByLabelText('Campaign code');
    const feedback = screen.getByText('Optional table identifier');

    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAttribute('aria-describedby', feedback.id);
  });

  it('preserves caller-provided described-by ids when adding generated feedback', () => {
    render(<TextArea label="Backstory" helperText="Keep it concise." aria-describedby="external-note" />);

    const textarea = screen.getByLabelText('Backstory');
    const feedback = screen.getByText('Keep it concise.');

    expect(textarea).toHaveAttribute('aria-describedby', `external-note ${feedback.id}`);
  });

  it('applies the same validation relationship to select controls', () => {
    render(
      <Select
        label="Class"
        error="Choose a class"
        options={[
          { value: '', label: 'Choose...' },
          { value: 'fighter', label: 'Fighter' },
        ]}
      />
    );

    const select = screen.getByLabelText('Class');
    const feedback = screen.getByText(/Choose a class/);

    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-describedby', feedback.id);
  });
});
