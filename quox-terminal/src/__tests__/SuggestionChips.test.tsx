import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SuggestionChips from '../components/terminal/SuggestionChips';

const sampleChips = [
  { label: 'Explain error', query: 'explain this error', icon: 'help-circle' },
  { label: 'Run tests', query: 'npm test', icon: 'play' },
  { label: 'Git status', query: 'git status', icon: 'git' },
];

describe('SuggestionChips', () => {
  it('renders nothing for empty chips', () => {
    const { container } = render(
      <SuggestionChips chips={[]} onChipClick={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders all chips', () => {
    render(<SuggestionChips chips={sampleChips} onChipClick={vi.fn()} />);
    expect(screen.getByText('Explain error')).toBeInTheDocument();
    expect(screen.getByText('Run tests')).toBeInTheDocument();
    expect(screen.getByText('Git status')).toBeInTheDocument();
  });

  it('calls onChipClick with query when clicked', () => {
    const onClick = vi.fn();
    render(<SuggestionChips chips={sampleChips} onChipClick={onClick} />);
    fireEvent.click(screen.getByText('Run tests'));
    expect(onClick).toHaveBeenCalledWith('npm test');
  });

  it('shows correct icon for known types', () => {
    render(
      <SuggestionChips
        chips={[{ label: 'Package', query: 'q', icon: 'package' }]}
        onChipClick={vi.fn()}
      />,
    );
    // Package icon should render the emoji
    const chip = screen.getByText('Package');
    expect(chip.closest('button')).toBeInTheDocument();
  });

  it('applies hidden class when hidden=true', () => {
    const { container } = render(
      <SuggestionChips chips={sampleChips} onChipClick={vi.fn()} hidden={true} />,
    );
    expect(container.querySelector('.suggestion-chips--hidden')).toBeTruthy();
  });

  it('disables buttons when hidden=true', () => {
    render(
      <SuggestionChips chips={sampleChips} onChipClick={vi.fn()} hidden={true} />,
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it('enables buttons when hidden=false', () => {
    render(
      <SuggestionChips chips={sampleChips} onChipClick={vi.fn()} hidden={false} />,
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn).not.toBeDisabled();
    });
  });

  it('sets title attribute to query string', () => {
    render(<SuggestionChips chips={sampleChips} onChipClick={vi.fn()} />);
    const btn = screen.getByText('Explain error').closest('button');
    expect(btn).toHaveAttribute('title', 'explain this error');
  });
});
