import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowRightIcon, GlobeIcon, LogoutIcon, SearchIcon } from '../icons/LineIcons';
import { NAV_SECTIONS, visibleItems } from './navigation';

type Command = {
  id: string;
  label: string;
  hint: string;
  icon: React.FC<{ className?: string }>;
  run: () => void;
};

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
};

/** Lower is better: a label that starts with the query beats one that merely contains it. */
function score(command: Command, query: string): number {
  const label = command.label.toLowerCase();
  if (label.startsWith(query)) return 0;
  if (label.split(/\s+/).some((word) => word.startsWith(query))) return 1;
  if (label.includes(query)) return 2;
  if (command.hint.toLowerCase().includes(query)) return 3;
  return Number.POSITIVE_INFINITY;
}

/**
 * Quick jump (Ctrl/⌘ K): every page this role can open, plus a couple of account actions, filtered
 * as you type. Follows the combobox + listbox pattern, so the arrow keys move through the results
 * while focus stays in the search box.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const commands = useMemo<Command[]>(() => {
    const sectionOf = (path: string) =>
      NAV_SECTIONS.find((section) => section.items.some((item) => item.path === path))?.title ?? '';
    const pages = visibleItems(user?.role).map<Command>((item) => ({
      id: item.path,
      label: item.name,
      hint: `${sectionOf(item.path)} · ${item.description}`,
      icon: item.icon,
      run: () => navigate(item.path),
    }));
    return [
      ...pages,
      { id: 'website', label: 'Public website', hint: 'Account · Open the MediCore home page', icon: GlobeIcon, run: () => navigate('/') },
      { id: 'logout', label: 'Log out', hint: 'Account · Sign out of the workspace', icon: LogoutIcon, run: () => void logout() },
    ];
  }, [user?.role, navigate, logout]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands
      .map((command) => ({ command, rank: score(command, q) }))
      .filter((entry) => Number.isFinite(entry.rank))
      .sort((a, b) => a.rank - b.rank)
      .map((entry) => entry.command);
  }, [commands, query]);

  // Focus the search box on open, and hand focus back to whatever opened the palette on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, [open]);

  if (!open) return null;

  const current = Math.min(activeIndex, Math.max(results.length - 1, 0));

  const choose = (command: Command | undefined) => {
    if (!command) return;
    onClose();
    command.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((current + 1) % Math.max(results.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((current - 1 + results.length) % Math.max(results.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[current]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="ws-palette-backdrop" onMouseDown={onClose}>
      <div
        className="ws-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Quick jump"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="ws-palette-search">
          <SearchIcon className="ws-icon" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="ws-palette-results"
            aria-activedescendant={results[current] ? `ws-cmd-${results[current].id}` : undefined}
            aria-autocomplete="list"
            aria-label="Search pages and actions"
            placeholder="Search pages and actions…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
          />
          <kbd>Esc</kbd>
        </div>

        <ul id="ws-palette-results" role="listbox" aria-label="Results" className="ws-palette-results">
          {results.length === 0 && <li className="ws-palette-empty">No page matches “{query}”.</li>}
          {results.map((command, index) => {
            const Icon = command.icon;
            const selected = index === current;
            return (
              <li
                key={command.id}
                id={`ws-cmd-${command.id}`}
                role="option"
                aria-selected={selected}
                className={`ws-palette-item ${selected ? 'is-active' : ''}`}
                style={{ '--i': index } as React.CSSProperties}
                onMouseMove={() => index !== current && setActiveIndex(index)}
                onClick={() => choose(command)}
              >
                <span className="ws-palette-icon" aria-hidden="true">
                  <Icon className="ws-icon" />
                </span>
                <span className="ws-palette-text">
                  <strong>{command.label}</strong>
                  <span>{command.hint}</span>
                </span>
                <ArrowRightIcon className="ws-icon-sm ws-palette-go" />
              </li>
            );
          })}
        </ul>

        <div className="ws-palette-footer" aria-hidden="true">
          <span><kbd>↑</kbd><kbd>↓</kbd> to move</span>
          <span><kbd>Enter</kbd> to open</span>
          <span><kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
