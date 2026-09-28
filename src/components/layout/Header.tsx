import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ChevronDownIcon, ClockIcon, GlobeIcon, LogoutIcon, MenuIcon, SearchIcon } from '../icons/LineIcons';
import { initialsOf } from '../../utils/initials';
import { pageTitleFor } from './navigation';

type HeaderProps = {
  onOpenNavigation?: () => void;
  onOpenSearch?: () => void;
};

/** "Mon 28 Sep · 14:05" in Colombo, the clinic's clock whatever the browser's timezone. */
function colomboClock(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Colombo',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')} · ${part('hour')}:${part('minute')}`;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform ?? '');

export const Header: React.FC<HeaderProps> = ({ onOpenNavigation, onOpenSearch }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const { section, title } = pageTitleFor(pathname);
  const [now, setNow] = useState(() => new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const displayName = user?.name || user?.email || 'User';

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  // The account menu closes on a click anywhere else, or on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <header className="ws-header">
      {onOpenNavigation && (
        <button type="button" className="ws-icon-btn ws-header-menu" onClick={onOpenNavigation} aria-label="Open navigation">
          <MenuIcon className="ws-icon" />
        </button>
      )}

      <div className="ws-header-title">
        <span className="ws-header-section">{section}</span>
        {/* Keyed so the title slides in fresh on every page change. */}
        <span key={title} className="ws-header-page">{title}</span>
      </div>

      {onOpenSearch && (
        <button type="button" className="ws-search-trigger" onClick={onOpenSearch} aria-label="Search pages (Ctrl K)">
          <SearchIcon className="ws-icon-sm" />
          <span className="ws-search-label">Jump to a page…</span>
          <kbd aria-hidden="true">{isMac ? '⌘' : 'Ctrl'} K</kbd>
        </button>
      )}

      <span className="ws-clock" title="Colombo time">
        <ClockIcon className="ws-icon-sm" />
        <span>{colomboClock(now)}</span>
      </span>

      <div className="ws-user" ref={menuRef}>
        <button
          type="button"
          className={`ws-user-trigger ${menuOpen ? 'is-open' : ''}`}
          aria-expanded={menuOpen}
          aria-controls="ws-user-menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="ws-avatar" aria-hidden="true">{initialsOf(displayName)}</span>
          <span className="ws-user-text">
            <strong>{displayName}</strong>
            <span>{user?.role || 'Staff'}</span>
          </span>
          <ChevronDownIcon className="ws-icon-sm ws-user-caret" />
        </button>

        {menuOpen && (
          <div id="ws-user-menu" className="ws-user-menu">
            <div className="ws-user-menu-head">
              <span className="ws-avatar ws-avatar--lg" aria-hidden="true">{initialsOf(displayName)}</span>
              <span>
                <strong>{displayName}</strong>
                {user?.email && user.email !== displayName && <span>{user.email}</span>}
                <span className="ws-role-pill">{user?.role || 'Staff'}</span>
              </span>
            </div>
            <Link to="/" className="ws-user-menu-item" onClick={() => setMenuOpen(false)}>
              <GlobeIcon className="ws-icon-sm" /> Public website
            </Link>
            <button type="button" className="ws-user-menu-item ws-user-menu-item--danger" onClick={() => void logout()}>
              <LogoutIcon className="ws-icon-sm" /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
