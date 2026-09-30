import React from 'react';

const STEPS = [
  { title: 'Select Details', hint: 'Choose specialization & doctor' },
  { title: 'Pick Date & Time', hint: 'Choose a convenient slot' },
  { title: 'Confirm', hint: 'Review your appointment' },
  { title: 'Done', hint: 'Appointment booked' },
] as const;

interface BookingStepperProps {
  /** 1-based: which step the patient is on. */
  current: 1 | 2 | 3 | 4;
}

/**
 * Where the patient is in the booking. Purely a signpost — the flow decides the step, this only
 * draws it, so it can never disagree with what is actually on screen.
 */
const BookingStepper: React.FC<BookingStepperProps> = ({ current }) => (
  <ol className="bk-stepper" aria-label="Booking progress">
    {STEPS.map((step, index) => {
      const number = index + 1;
      const state = number < current ? 'done' : number === current ? 'active' : 'upcoming';
      return (
        <li
          key={step.title}
          className={`bk-stepper-item bk-stepper-item--${state}`}
          aria-current={state === 'active' ? 'step' : undefined}
        >
          <span className="bk-stepper-number">{number}</span>
          <span className="bk-stepper-text">
            <strong>{step.title}</strong>
            <span>{step.hint}</span>
          </span>
        </li>
      );
    })}
  </ol>
);

export default BookingStepper;
