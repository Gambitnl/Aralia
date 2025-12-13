import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Button } from './Button';
import { BTN_PRIMARY, BTN_SIZE_LG } from '../../styles/buttonStyles';

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Default Button</Button>);
    const button = screen.getByRole('button', { name: /default button/i });
    expect(button).toBeInTheDocument();
  });

  it('applies variant classes correctly', () => {
    render(<Button variant="primary">Primary Button</Button>);
    const button = screen.getByRole('button', { name: /primary button/i });
    expect(button.className).toContain(BTN_PRIMARY);
  });

  it('applies size classes correctly', () => {
    render(<Button size="lg">Large Button</Button>);
    const button = screen.getByRole('button', { name: /large button/i });
    expect(button.className).toContain(BTN_SIZE_LG);
  });

  it('displays spinner and maintains accessible text when isLoading is true', () => {
    render(<Button isLoading>Submit</Button>);

    // Button should still be accessible by name "Submit" even if visually hidden (opacity: 0)
    // getByRole('button', { name: ... }) will find it if it's in the A11y tree.
    const button = screen.getByRole('button', { name: /submit/i });

    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();

    // Check that spinner is present
    const spinner = screen.getByRole('status', { hidden: true });
    expect(spinner).toBeInTheDocument();

    // Verify text container has opacity-0 class but NOT invisible
    // getByText returns the element containing the text (the span)
    const textElement = screen.getByText('Submit');
    expect(textElement).toHaveClass('opacity-0');
    expect(textElement).not.toHaveClass('invisible');
  });

  it('is disabled when isLoading is true', () => {
    render(<Button isLoading>Submit</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('forwards refs', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref Button</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
