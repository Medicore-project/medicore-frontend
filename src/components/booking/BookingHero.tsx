import React from 'react';

/**
 * The booking page's banner. Shared by the public `/book` page and the in-app booking route, so a
 * receptionist booking for someone sees the same screen the patient would.
 */
const BookingHero: React.FC = () => (
  <section className="bk-hero">
    <div className="bk-hero-text">
      <h1>
        Book an <span>Appointment</span>
      </h1>
      <p>Schedule your consultation with our doctors in a few simple steps.</p>
    </div>

    <div className="bk-hero-art" aria-hidden="true">
      <svg viewBox="0 0 170 130" className="bk-hero-illustration" focusable="false">
        <circle cx="96" cy="80" r="64" fill="#dbeafe" opacity="0.55" />
        {/* Calendar */}
        <rect x="20" y="22" width="96" height="84" rx="14" fill="#ffffff" />
        <path d="M20 36a14 14 0 0 1 14-14h68a14 14 0 0 1 14 14v8H20v-8Z" fill="#1856f3" />
        <rect x="38" y="12" width="7" height="22" rx="3.5" fill="#1144d4" />
        <rect x="91" y="12" width="7" height="22" rx="3.5" fill="#1144d4" />
        {[0, 1, 2, 3].map((col) =>
          [0, 1, 2].map((row) =>
            col === 1 && row === 1 ? null : (
              <rect
                key={`${col}-${row}`}
                x={32 + col * 20}
                y={54 + row * 16}
                width="12"
                height="9"
                rx="2.5"
                fill="#dbeafe"
              />
            ),
          ),
        )}
        {/* The cross */}
        <path d="M58 68h12M64 62v12" stroke="#1856f3" strokeWidth="5" strokeLinecap="round" />
        {/* Clock */}
        <circle cx="122" cy="96" r="24" fill="#1856f3" />
        <circle cx="122" cy="96" r="18" fill="#3b82f6" />
        <path d="M122 84v13l7 5" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
      <p className="bk-hero-tagline">
        Quality Care
        <br />
        for a Healthier
        <br />
        <span>Tomorrow</span>
      </p>
    </div>
  </section>
);

export default BookingHero;
