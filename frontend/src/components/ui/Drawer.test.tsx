import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Drawer } from './Drawer';

/**
 * Regression test for the admin review-note bug: the page held the note in its
 * own state and rebuilt `onClose` on every render, which re-ran the drawer's
 * focus effect on each keystroke. Focus jumped to the panel, so a single
 * character landed and typing stopped.
 */
function Host({ onClose }: { onClose: () => void }) {
  const [note, setNote] = useState('');
  return (
    <Drawer open onClose={onClose} title="Review">
      <textarea aria-label="Review note" value={note} onChange={(event) => setNote(event.target.value)} />
    </Drawer>
  );
}

describe('Drawer focus management', () => {
  it('keeps focus in a textarea across keystrokes when the parent re-renders', () => {
    const { rerender } = render(<Host onClose={() => undefined} />);

    const textarea = screen.getByLabelText('Review note');
    textarea.focus();

    for (const char of 'abc') {
      fireEvent.change(textarea, { target: { value: (textarea as HTMLTextAreaElement).value + char } });
      // An unstable onClose identity is the trigger; force one per keystroke.
      rerender(<Host onClose={() => undefined} />);
    }

    expect(textarea).toHaveValue('abc');
    expect(document.activeElement).toBe(textarea);
  });

  it('restores focus to the trigger when it closes', () => {
    function ClosableHost() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <Drawer open={open} onClose={() => setOpen(false)} title="Review">
            <textarea aria-label="Review note" />
          </Drawer>
        </>
      );
    }

    render(<ClosableHost />);
    const trigger = screen.getByRole('button', { name: 'Open' });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.activeElement).toBe(trigger);
  });
});
