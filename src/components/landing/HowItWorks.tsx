import React from 'react';
import { useInView } from '../../hooks/useInView';
import { CalendarIcon, HeartIcon, StethoscopeIcon, UserIcon } from '../icons/LineIcons';

const STEPS = [
  {
    title: 'Book an appointment',
    text: 'Pick a doctor and a time online — your patient number is all you need.',
    icon: CalendarIcon,
  },
  {
    title: 'Visit our centre',
    text: 'Check in at reception. We will have your details ready.',
    icon: UserIcon,
  },
  {
    title: 'Consult a specialist',
    text: 'Get expert care from a doctor focused on what you need.',
    icon: StethoscopeIcon,
  },
  {
    title: 'Follow up',
    text: 'Continue your treatment, with every visit on one record.',
    icon: HeartIcon,
  },
];

/**
 * "How it works": four steps joined by a line that draws itself across once the section is in
 * view, lighting each step in turn.
 */
export const HowItWorks: React.FC = () => {
  const { ref, inView } = useInView<HTMLOListElement>({ threshold: 0.3 });

  return (
    <ol ref={ref} className={`lp-steps ${inView ? 'is-drawn' : ''}`}>
      <span className="lp-steps-line" aria-hidden="true">
        <span className="lp-steps-line-fill" />
      </span>
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        return (
          <li key={step.title} className="lp-step" style={{ '--i': index } as React.CSSProperties}>
            <span className="lp-step-marker" aria-hidden="true">
              <Icon className="lp-icon" />
              <span className="lp-step-number">{String(index + 1).padStart(2, '0')}</span>
            </span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        );
      })}
    </ol>
  );
};

export default HowItWorks;
