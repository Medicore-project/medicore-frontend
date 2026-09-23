import React from 'react';
import { Link } from 'react-router-dom';
import BookingFlow from '../components/booking/BookingFlow';

/**
 * The public booking page.
 *
 * Deliberately outside `AppLayout` and outside `ProtectedRoute`: anyone can reach it, so it must
 * not render a staff sidebar or assume a signed-in user. A logged-in Patient reaches the same flow
 * through the authenticated route.
 */
const PublicBookingPage: React.FC = () => (
  <div className="public-booking-page">
    <header className="public-booking-header">
      <Link to="/" className="public-booking-brand">
        MediCore
      </Link>
      <h1>Book an appointment</h1>
      <p className="page-subtitle">
        No account needed. You will need your patient number, or a few details if this is your
        first visit.
      </p>
    </header>

    <main className="public-booking-body">
      <BookingFlow />
    </main>
  </div>
);

export default PublicBookingPage;
