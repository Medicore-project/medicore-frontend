import React from 'react';
import BookingFlow from '../components/booking/BookingFlow';
import BookingHero from '../components/booking/BookingHero';

/**
 * The booking flow inside the app shell, for a signed-in Receptionist, Admin or Patient. The same
 * banner and flow as the public page; the shell supplies the header and sidebar.
 */
const InAppBookingPage: React.FC = () => (
  <div className="bk-page bk-page--in-app">
    <BookingHero />
    <BookingFlow />
  </div>
);

export default InAppBookingPage;
