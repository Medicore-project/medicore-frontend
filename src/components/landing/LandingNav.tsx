import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { homePathFor } from '../../utils/permissions';
import { CalendarIcon, CloseIcon, MenuIcon, PhoneIcon } from '../icons/LineIcons';
import BrandMark from './BrandMark';
import { LANDING_SECTIONS } from './landingSections';
import { scrollToSection } from './scrollToSection';

type LandingNavProps = {
  /** The section currently on screen, underlined in the nav. */
  activeSection: string;
  /** The page has scrolled past the top: the bar tightens and gains a shadow. */
  scrolled: boolean;
};

export const LandingNav: React.FC<LandingNavProps> = ({ activeSection, scrolled }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  // Escape closes the mobile menu, as it would any other overlay.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const goTo = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setMenuOpen(false);
    scrollToSection(id);
  };

  return (
    <header className={`lp-nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="lp-nav-inner">
        <a href="#home" className="lp-nav-brand" onClick={(e) => goTo(e, 'home')} aria-label="MediCore home">
          <BrandMark />
        </a>

        <nav aria-label="Page sections" className="lp-nav-links-wrap">
          <ul className="lp-nav-links">
            {LANDING_SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className={activeSection === section.id ? 'is-active' : undefined}
                  aria-current={activeSection === section.id ? 'true' : undefined}
                  onClick={(e) => goTo(e, section.id)}
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="lp-nav-actions">
          <a className="lp-nav-phone" href="tel:+94112345678">
            <PhoneIcon className="lp-icon-sm" />
            <span>+94 11 234 5678</span>
          </a>
          {/* Booking needs no account, so it is the first thing offered, not hidden behind the
              staff login. The login button is for staff (and a signed-in Patient's shortcut). */}
          {user ? (
            <button type="button" className="lp-btn lp-btn-ghost" onClick={() => navigate(homePathFor(user.role))}>
              {user.role === 'Patient' ? 'My booking' : 'Dashboard'}
            </button>
          ) : (
            <button type="button" className="lp-btn lp-btn-ghost" onClick={() => navigate('/login')}>
              Staff login
            </button>
          )}
          <button
            type="button"
            className="lp-btn lp-btn-primary lp-nav-book"
            onClick={() => navigate('/book')}
            data-testid="landing-book"
          >
            <CalendarIcon className="lp-icon-sm" />
            <span>Book appointment</span>
          </button>
          <button
            type="button"
            className="lp-nav-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="lp-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <CloseIcon className="lp-icon" /> : <MenuIcon className="lp-icon" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav id="lp-mobile-menu" className="lp-mobile-menu" aria-label="Page sections (mobile)">
          {LANDING_SECTIONS.map((section, index) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className={activeSection === section.id ? 'is-active' : undefined}
              style={{ '--i': index } as React.CSSProperties}
              onClick={(e) => goTo(e, section.id)}
            >
              {section.label}
            </a>
          ))}
          {/* On a phone the bar hides the staff button for room, so the menu carries it. */}
          <Link className="lp-mobile-staff" to={user ? homePathFor(user.role) : '/login'}>
            {user ? (user.role === 'Patient' ? 'My booking' : 'Dashboard') : 'Staff login'}
          </Link>
          <a className="lp-mobile-phone" href="tel:+94112345678">
            <PhoneIcon className="lp-icon-sm" /> +94 11 234 5678
          </a>
        </nav>
      )}
    </header>
  );
};

export default LandingNav;
