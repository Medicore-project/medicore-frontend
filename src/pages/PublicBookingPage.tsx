import React from 'react';
import { Link } from 'react-router-dom';
import BookingFlow from '../components/booking/BookingFlow';
import BookingHero from '../components/booking/BookingHero';
import { HeartPlusIcon } from '../components/icons/LineIcons';
import { useAuth } from '../contexts/AuthContext';

function initials(name: string): string {
  return (
    name
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

/**
 * The public booking page.
 *
 * Deliberately outside `AppLayout` and outside `ProtectedRoute`: anyone can reach it, so it must
 * not render a staff sidebar or assume a signed-in user. When someone *is* signed in — a
 * receptionist at the desk, say — the top bar says so and offers Logout, because a shared clinic
 * browser left signed in is exactly the thing worth making visible.
 */
const PublicBookingPage: React.FC = () => {
  const { user, logout } = useAuth();
  const displayName = user?.name || user?.email || '';

  return (
    <div className="bk-page">
      <header className="bk-topbar">
        <Link to="/" className="bk-brand">
          <HeartPlusIcon className="bk-brand-mark" />
          MediCore
        </Link>

        {user ? (
          <div className="bk-user">
            <span className="bk-user-avatar" aria-hidden="true">
              {initials(displayName)}
            </span>
            <span className="bk-user-text">
              <strong>{displayName}</strong>
              <span className="bk-user-role">{user.role}</span>
            </span>
            <button type="button" className="bk-topbar-btn" onClick={() => void logout()}>
              Logout
            </button>
          </div>
        ) : (
          <Link to="/login" className="bk-topbar-btn">
            Staff login
          </Link>
        )}
      </header>

      <BookingHero />

      <main className="bk-page-body">
        <BookingFlow />
      </main>
    </div>
  );
};

export default PublicBookingPage;
