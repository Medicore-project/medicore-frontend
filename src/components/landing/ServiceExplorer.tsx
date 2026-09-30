import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightIcon,
  BrainIcon,
  CheckIcon,
  LeafIcon,
  ScanIcon,
  StethoscopeIcon,
} from '../icons/LineIcons';
import Reveal from '../motion/Reveal';

type Service = {
  id: string;
  title: string;
  blurb: string;
  detail: string;
  points: string[];
  icon: React.FC<{ className?: string }>;
  tone: 'blue' | 'teal' | 'violet' | 'amber';
  image?: string;
};

const SERVICES: Service[] = [
  {
    id: 'general',
    title: 'General Medicine',
    blurb: 'Comprehensive primary care for every age.',
    detail:
      'Your first stop for everyday health — check-ups, new symptoms and long-term conditions, with a doctor who sees the whole picture.',
    points: ['Routine check-ups and screenings', 'Chronic condition follow-ups', 'Referrals to the right specialist'],
    icon: StethoscopeIcon,
    tone: 'blue',
    image: '/images/hero_doctor.jpg',
  },
  {
    id: 'imaging',
    title: 'Diagnostic Imaging',
    blurb: 'Precise imaging for accurate diagnosis.',
    detail:
      'High-precision imaging read by experienced clinicians, so your care team decides with the clearest possible view.',
    points: ['CT and MRI scanning', 'Results shared with your doctor', 'Calm, guided scan appointments'],
    icon: ScanIcon,
    tone: 'teal',
    image: '/images/diagnostic.jpg',
  },
  {
    id: 'specialty',
    title: 'Specialty Consultations',
    blurb: 'Expert care across many specialties.',
    detail:
      'See a specialist who focuses on exactly what you need, backed by modern theatres and a coordinated clinical team.',
    points: ['Cardiology, neurology and more', 'Surgical assessment and planning', 'One record across every visit'],
    icon: BrainIcon,
    tone: 'violet',
    image: '/images/surgery.jpg',
  },
  {
    id: 'wellness',
    title: 'Wellness & Preventive Care',
    blurb: 'Stay healthy with preventive programmes.',
    detail:
      'Catch things early and stay well — preventive plans, lifestyle guidance and vaccinations, shaped around you.',
    points: ['Personal preventive plans', 'Vaccinations and health screening', 'Nutrition and lifestyle guidance'],
    icon: LeafIcon,
    tone: 'amber',
  },
];

/**
 * The services section: four cards that work as tabs, and a panel that swaps in the chosen
 * service's details. Arrow keys move between tabs, as the ARIA tabs pattern expects.
 */
export const ServiceExplorer: React.FC = () => {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState(SERVICES[0].id);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const active = SERVICES.find((service) => service.id === activeId) ?? SERVICES[0];

  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + SERVICES.length) % SERVICES.length;
    setActiveId(SERVICES[next].id);
    tabRefs.current[next]?.focus();
  };

  const ActiveIcon = active.icon;

  return (
    <div className="lp-services-grid">
      <Reveal variant="left" className="lp-services-intro">
        <span className="lp-eyebrow">Our services</span>
        <h2 className="lp-h2">
          Comprehensive <span className="lp-text-gradient">healthcare</span> services
        </h2>
        <p className="lp-lead">
          From preventive care to advanced treatment, MediCore brings the right people and technology together
          around every patient.
        </p>
        <button type="button" className="lp-btn lp-btn-outline" onClick={() => navigate('/book')}>
          Book a visit <ArrowRightIcon className="lp-icon-sm lp-arrow" />
        </button>
      </Reveal>

      <div className="lp-service-tabs" role="tablist" aria-label="Healthcare services">
        {SERVICES.map((service, index) => {
          const Icon = service.icon;
          const selected = service.id === activeId;
          return (
            <Reveal key={service.id} delay={index * 90} className="lp-service-tab-wrap">
              <button
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`lp-service-tab-${service.id}`}
                aria-selected={selected}
                aria-controls="lp-service-panel"
                tabIndex={selected ? 0 : -1}
                className={`lp-service-card lp-tone-${service.tone} ${selected ? 'is-active' : ''}`}
                onClick={() => setActiveId(service.id)}
                onKeyDown={(e) => onTabKeyDown(e, index)}
              >
                <span className="lp-service-icon">
                  <Icon className="lp-icon" />
                </span>
                <strong>{service.title}</strong>
                <span className="lp-service-blurb">{service.blurb}</span>
                <span className="lp-service-go" aria-hidden="true">
                  <ArrowRightIcon className="lp-icon-sm" />
                </span>
              </button>
            </Reveal>
          );
        })}
      </div>

      <Reveal variant="zoom" className="lp-service-panel-wrap">
        {/* Keyed by service so the panel re-mounts and plays its entrance on every switch. */}
        <div
          key={active.id}
          id="lp-service-panel"
          role="tabpanel"
          aria-labelledby={`lp-service-tab-${active.id}`}
          className={`lp-service-panel lp-tone-${active.tone}`}
        >
          <div className="lp-service-panel-media">
            {active.image ? (
              <img src={active.image} alt="" loading="lazy" />
            ) : (
              <div className="lp-service-panel-art" aria-hidden="true">
                <ActiveIcon className="lp-service-panel-art-icon" />
              </div>
            )}
          </div>
          <div className="lp-service-panel-body">
            <span className="lp-service-icon">
              <ActiveIcon className="lp-icon" />
            </span>
            <h3>{active.title}</h3>
            <p>{active.detail}</p>
            <ul>
              {active.points.map((point, index) => (
                <li key={point} style={{ '--i': index } as React.CSSProperties}>
                  <CheckIcon className="lp-icon-sm" />
                  {point}
                </li>
              ))}
            </ul>
            <button type="button" className="lp-btn lp-btn-primary" onClick={() => navigate('/book')}>
              Book this service <ArrowRightIcon className="lp-icon-sm lp-arrow" />
            </button>
          </div>
        </div>
      </Reveal>
    </div>
  );
};

export default ServiceExplorer;
