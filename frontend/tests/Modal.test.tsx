import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from '../src/components/ui/Modal.js';

/** A button that opens the dialog, so focus restoration can be observed. */
function OpenerHarness() {
  const [isOpen, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Modal open={isOpen} title="Restock" onClose={() => setOpen(false)}>
        <button type="button">Inside</button>
      </Modal>
    </>
  );
}

function open(overrides: Partial<Parameters<typeof Modal>[0]> = {}) {
  const onClose = vi.fn();

  const utils = render(
    <Modal
      open
      title="Restock"
      description="How many are arriving?"
      onClose={onClose}
      {...overrides}
    >
      <input aria-label="Quantity" defaultValue="1" />
      <button type="button">Add to stock</button>
    </Modal>,
  );

  return { onClose, ...utils };
}

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} title="Restock" onClose={() => undefined}>
        <p>Body</p>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('is announced as a modal dialog labelled by its title', () => {
    open();

    const dialog = screen.getByRole('dialog');

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Restock');
    expect(dialog).toHaveAccessibleDescription('How many are arriving?');
  });

  it('moves focus into the dialog on open', () => {
    open();

    // Otherwise a keyboard user is left tabbing around behind the overlay.
    expect(screen.getByLabelText('Quantity')).toHaveFocus();
  });

  it('closes on Escape', async () => {
    const { onClose } = open();

    await userEvent.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalled();
  });

  it('closes when the backdrop is clicked', async () => {
    const { onClose } = open();

    await userEvent.click(screen.getByTestId('modal-backdrop'));

    expect(onClose).toHaveBeenCalled();
  });

  it('hides the backdrop from assistive technology', () => {
    // It would otherwise be a second control with the same name as the X,
    // for no benefit: Escape is the keyboard way to dismiss.
    open();

    expect(screen.getByTestId('modal-backdrop')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getAllByRole('button', { name: /close dialog/i })).toHaveLength(1);
  });

  it('keeps Tab inside the dialog', async () => {
    open();

    const quantity = screen.getByLabelText('Quantity');
    const addToStock = screen.getByRole('button', { name: /add to stock/i });

    expect(quantity).toHaveFocus();
    await userEvent.tab();
    expect(addToStock).toHaveFocus();

    // From the last control, Tab wraps to the first rather than escaping.
    await userEvent.tab();
    expect(document.body.contains(document.activeElement)).toBe(true);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('wraps backwards from the first control with Shift+Tab', async () => {
    open();

    await userEvent.tab({ shift: true });

    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
  });

  it('restores focus to whatever opened it', async () => {
    render(<OpenerHarness />);

    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);

    expect(screen.getByRole('dialog')).toBeInTheDocument();

    await userEvent.keyboard('{Escape}');

    expect(opener).toHaveFocus();
  });

  it('locks page scrolling while open and restores it after', () => {
    const { unmount } = open();

    expect(document.body.style.overflow).toBe('hidden');

    unmount();

    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
