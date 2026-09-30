import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import CommandPalette from './CommandPalette';

const auth = vi.hoisted(() => ({ role: 'Receptionist', logout: vi.fn() }));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'desk@medicore.lk', role: auth.role }, logout: auth.logout }),
}));

function renderPalette(role: string, onClose = vi.fn()) {
  auth.role = role;
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <CommandPalette open onClose={onClose} />
      <Routes>
        <Route path="/dashboard" element={<p>dashboard page</p>} />
        <Route path="/appointments/waitlist" element={<p>waitlist page</p>} />
      </Routes>
    </MemoryRouter>,
  );
  return onClose;
}

describe('CommandPalette', () => {
  it('narrows the pages as you type', () => {
    renderPalette('Receptionist');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'wait' } });

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Waitlist');
    expect(screen.queryByRole('option', { name: /Departments/ })).not.toBeInTheDocument();
  });

  it('opens the highlighted page on Enter and closes', () => {
    const onClose = renderPalette('Receptionist');
    const input = screen.getByRole('combobox');

    fireEvent.change(input, { target: { value: 'wait' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('waitlist page')).toBeInTheDocument();
  });

  it('moves the highlight with the arrow keys', () => {
    renderPalette('Receptionist');
    const input = screen.getByRole('combobox');

    expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true');
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1].id);
  });

  it('never offers a page the role cannot open', () => {
    renderPalette('Nurse');

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'staff' } });

    expect(screen.queryByRole('option', { name: /^Staff/ })).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = renderPalette('Receptionist');

    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });
});
