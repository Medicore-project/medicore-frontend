import React, { useState } from 'react';
import { PlusIcon } from '../icons/LineIcons';

const FAQS = [
  {
    q: 'Do I need an account to book an appointment?',
    a: 'No. Book online with your patient number and date of birth. On your first visit you can register in a minute as part of booking.',
  },
  {
    q: 'What if the doctor I want is fully booked?',
    a: 'Join the waitlist for that day. If someone cancels, the time is offered to the first person waiting.',
  },
  {
    q: 'Can I reschedule or cancel my appointment?',
    a: 'Yes. Identify yourself on the booking page to see your upcoming appointments, then reschedule or cancel within the clinic’s cancellation window.',
  },
  {
    q: 'Who can see my medical information?',
    a: 'Only authorised MediCore staff, and each role sees only what it needs to care for you.',
  },
  {
    q: 'When is MediCore open?',
    a: 'Our centre in Colombo is open every day from 7:00 AM to 9:00 PM. Call +94 11 234 5678 for help at any time during those hours.',
  },
];

/** One question open at a time; the answer slides open with a grid-template-rows transition. */
export const FaqAccordion: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="lp-faq-list">
      {FAQS.map((item, index) => {
        const open = openIndex === index;
        const answerId = `lp-faq-answer-${index}`;
        return (
          <div key={item.q} className={`lp-faq-item ${open ? 'is-open' : ''}`}>
            <h3>
              <button
                type="button"
                id={`${answerId}-q`}
                aria-expanded={open}
                aria-controls={answerId}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <span>{item.q}</span>
                <span className="lp-faq-icon" aria-hidden="true">
                  <PlusIcon className="lp-icon-sm" />
                </span>
              </button>
            </h3>
            {/* Collapsed by height rather than unmounted, so it can slide; `inert` keeps a closed
                answer out of the accessibility tree meanwhile. */}
            <div
              id={answerId}
              className="lp-faq-answer"
              role="region"
              aria-labelledby={`${answerId}-q`}
              inert={!open}
            >
              <div>
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FaqAccordion;
