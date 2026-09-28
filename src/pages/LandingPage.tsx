import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BrandMark from '../components/landing/BrandMark';
import FaqAccordion from '../components/landing/FaqAccordion';
import HowItWorks from '../components/landing/HowItWorks';
import LandingNav from '../components/landing/LandingNav';
import { LANDING_SECTIONS } from '../components/landing/landingSections';
import ServiceExplorer from '../components/landing/ServiceExplorer';
import { scrollToSection } from '../components/landing/scrollToSection';
import {
  ArrowRightIcon,
  ArrowUpIcon,
  BuildingIcon,
  CalendarIcon,
  ClockIcon,
  HeartIcon,
  MailIcon,
  PhoneIcon,
  PinIcon,
  ShieldIcon,
  StarIcon,
  StethoscopeIcon,
  TrendUpIcon,
  UserIcon,
  UsersIcon,
} from '../components/icons/LineIcons';
import CountUp from '../components/motion/CountUp';
import Reveal from '../components/motion/Reveal';
import { prefersReducedMotion } from '../hooks/useInView';

const STATS = [
  { to: 25, suffix: '+', label: 'Years of combined experience', icon: UsersIcon, tone: 'blue' },
  { to: 90, suffix: '%', label: 'Patient satisfaction rate', icon: HeartIcon, tone: 'rose' },
  { to: 1000, suffix: '+', label: 'Patients treated annually', icon: UserIcon, tone: 'teal' },
  { to: 135, suffix: '+', label: 'Successful treatments daily', icon: BuildingIcon, tone: 'violet' },
];

const WHY_US = [
  { title: 'Experienced team', text: 'Skilled, compassionate medical professionals.', icon: UsersIcon },
  { title: 'Modern technology', text: 'State-of-the-art facilities and equipment.', icon: ShieldIcon },
  { title: 'Patient-centred', text: 'Your comfort and well-being come first.', icon: HeartIcon },
  { title: 'Trusted by many', text: '1,000+ patients cared for every year.', icon: StarIcon },
];

/**
 * The public home page. Long and scrollable by design: a sticky nav that follows the section on
 * screen, content that animates in as it arrives, and a booking call to action at every turn —
 * booking needs no account, so it never sits behind the staff login.
 */
export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('home');

  // One passive scroll listener, throttled to a frame, drives the progress bar (written straight to
  // the DOM so scrolling does not re-render the page) and the two scroll-dependent flags.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      const progress = max > 0 ? window.scrollY / max : 0;
      if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress})`;
      setScrolled(window.scrollY > 12);
      setShowBackToTop(window.scrollY > 700);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Scroll-spy: the section crossing the middle band of the screen is the one the nav underlines.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    LANDING_SECTIONS.forEach(({ id }) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  // The hero's floating cards drift a little with the pointer. CSS reads --mx/--my (-1 to 1).
  const onHeroPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse' || prefersReducedMotion() || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    heroRef.current.style.setProperty('--mx', (((e.clientX - rect.left) / rect.width) * 2 - 1).toFixed(3));
    heroRef.current.style.setProperty('--my', (((e.clientY - rect.top) / rect.height) * 2 - 1).toFixed(3));
  };
  const onHeroPointerLeave = () => {
    heroRef.current?.style.setProperty('--mx', '0');
    heroRef.current?.style.setProperty('--my', '0');
  };

  const backToTop = () => {
    window.scrollTo?.({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  return (
    <div className="lp-page">
      <div className="lp-progress" aria-hidden="true">
        <div ref={progressRef} className="lp-progress-bar" />
      </div>

      <LandingNav activeSection={activeSection} scrolled={scrolled} />

      <main>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section
          id="home"
          ref={heroRef}
          className="lp-hero lp-section-anchor"
          onPointerMove={onHeroPointerMove}
          onPointerLeave={onHeroPointerLeave}
        >
          <div className="lp-hero-bg" aria-hidden="true">
            <span className="lp-blob lp-blob--1" />
            <span className="lp-blob lp-blob--2" />
            <span className="lp-blob lp-blob--3" />
            <span className="lp-hero-grid" />
          </div>

          <div className="lp-container lp-hero-inner">
            <div className="lp-hero-copy">
              <span className="lp-pill lp-enter" style={{ '--enter': 0 } as React.CSSProperties}>
                <HeartIcon className="lp-icon-xs" /> Trusted healthcare partner
              </span>
              <h1 className="lp-hero-title lp-enter" style={{ '--enter': 1 } as React.CSSProperties}>
                Your health,
                <br />
                our <span className="lp-underline lp-text-gradient">priority</span>
              </h1>
              <p className="lp-hero-lead lp-enter" style={{ '--enter': 2 } as React.CSSProperties}>
                Compassionate, modern and patient-centred healthcare for a healthier tomorrow — book in minutes,
                no account needed.
              </p>

              <div className="lp-hero-actions lp-enter" style={{ '--enter': 3 } as React.CSSProperties}>
                <button
                  type="button"
                  className="lp-btn lp-btn-primary lp-btn-lg lp-btn-shine"
                  onClick={() => navigate('/book')}
                  data-testid="hero-book"
                >
                  <CalendarIcon className="lp-icon-sm" />
                  Book an appointment
                </button>
                <button type="button" className="lp-btn lp-btn-outline lp-btn-lg" onClick={() => scrollToSection('services')}>
                  View our services <ArrowRightIcon className="lp-icon-sm lp-arrow" />
                </button>
              </div>

              <ul className="lp-hero-points lp-enter" style={{ '--enter': 4 } as React.CSSProperties}>
                <li>
                  <span className="lp-hero-point-icon"><UserIcon className="lp-icon-sm" /></span>
                  <span><strong>No account needed</strong>Book with your patient number</span>
                </li>
                <li>
                  <span className="lp-hero-point-icon"><StethoscopeIcon className="lp-icon-sm" /></span>
                  <span><strong>Experienced doctors</strong>Trusted professionals</span>
                </li>
                <li>
                  <span className="lp-hero-point-icon"><BuildingIcon className="lp-icon-sm" /></span>
                  <span><strong>Modern facilities</strong>Advanced technology</span>
                </li>
              </ul>
            </div>

            <div className="lp-hero-visual lp-enter" style={{ '--enter': 2 } as React.CSSProperties}>
              <div className="lp-hero-orbit" aria-hidden="true" />
              <div className="lp-hero-portrait">
                <img src="/images/hero_doctor.jpg" alt="A smiling MediCore doctor in a white coat" />
              </div>

              <div className="lp-float lp-float--patients" style={{ '--depth': 18 } as React.CSSProperties}>
                <div className="lp-float-inner">
                  <div className="lp-float-row">
                    <strong><CountUp to={1000} suffix="+" /></strong>
                    <TrendUpIcon className="lp-icon lp-float-trend" />
                  </div>
                  <span>Satisfied patients</span>
                  <div className="lp-avatars" aria-hidden="true">
                    {['AP', 'NS', 'KR', 'MF', '+'].map((initials, i) => (
                      <span key={initials} style={{ '--i': i } as React.CSSProperties}>{initials}</span>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="lp-float lp-float--book"
                style={{ '--depth': -22 } as React.CSSProperties}
                onClick={() => navigate('/book')}
              >
                <span className="lp-float-inner">
                  <span className="lp-float-icon"><CalendarIcon className="lp-icon" /></span>
                  <span className="lp-float-text">
                    <strong>Book in minutes</strong>
                    <span>Quick, simple and hassle-free.</span>
                  </span>
                  <span className="lp-float-go" aria-hidden="true"><ArrowRightIcon className="lp-icon-sm" /></span>
                </span>
              </button>

              <div className="lp-float lp-float--open" style={{ '--depth': 12 } as React.CSSProperties}>
                <span className="lp-float-inner">
                  <span className="lp-live-dot" aria-hidden="true" />
                  <span><strong>Open today</strong> 7:00 AM – 9:00 PM</span>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="lp-scroll-cue"
            onClick={() => scrollToSection('services')}
            aria-label="Scroll to services"
          >
            <span aria-hidden="true" />
          </button>
        </section>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <section className="lp-stats-wrap" aria-label="MediCore in numbers">
          <div className="lp-container">
            <Reveal className="lp-stats">
              {STATS.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="lp-stat">
                    <span className={`lp-stat-icon lp-tone-${stat.tone}`}><Icon className="lp-icon" /></span>
                    <span className="lp-stat-copy">
                      <CountUp to={stat.to} suffix={stat.suffix} className="lp-stat-number" />
                      <span className="lp-stat-label">{stat.label}</span>
                    </span>
                  </div>
                );
              })}
            </Reveal>
          </div>
        </section>

        {/* ── Services ─────────────────────────────────────────────────────── */}
        <section id="services" className="lp-section lp-section-anchor">
          <div className="lp-container">
            <ServiceExplorer />
          </div>
        </section>

        {/* ── Why MediCore ─────────────────────────────────────────────────── */}
        <section id="about" className="lp-section lp-why lp-section-anchor">
          <div className="lp-container lp-why-grid">
            <Reveal variant="left" className="lp-why-media">
              <div className="lp-why-photo">
                <img src="/images/surgery.jpg" alt="A MediCore surgical team at work in a modern theatre" loading="lazy" />
              </div>
              <div className="lp-why-badge">
                <span className="lp-why-badge-icon"><ShieldIcon className="lp-icon" /></span>
                <span>
                  <strong><CountUp to={25} suffix="+" /> years</strong>
                  of combined clinical experience
                </span>
              </div>
              <div className="lp-why-chip">
                <span className="lp-live-dot" aria-hidden="true" /> Care team on site today
              </div>
            </Reveal>

            <div className="lp-why-copy">
              <Reveal>
                <span className="lp-eyebrow">Why choose MediCore</span>
                <h2 className="lp-h2">
                  Trusted care for a <span className="lp-text-gradient">healthier tomorrow</span>
                </h2>
                <p className="lp-lead">
                  We combine experienced medical professionals, modern technology and a patient-first approach to
                  deliver care you can count on — from your first booking to your last follow-up.
                </p>
              </Reveal>
              <div className="lp-why-list">
                {WHY_US.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <Reveal key={item.title} delay={index * 100}>
                      <div className="lp-why-item">
                        <span className="lp-why-icon"><Icon className="lp-icon" /></span>
                        <span>
                          <strong>{item.title}</strong>
                          <span>{item.text}</span>
                        </span>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section id="how" className="lp-section lp-how lp-section-anchor">
          <div className="lp-container">
            <Reveal className="lp-section-head">
              <span className="lp-eyebrow">How it works</span>
              <h2 className="lp-h2">
                Get the care you need in <span className="lp-text-gradient">four simple steps</span>
              </h2>
            </Reveal>
            <HowItWorks />
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section id="faq" className="lp-section lp-faq lp-section-anchor">
          <div className="lp-container lp-faq-grid">
            <Reveal variant="left" className="lp-faq-intro">
              <span className="lp-eyebrow">Questions</span>
              <h2 className="lp-h2">
                Everything you need to <span className="lp-text-gradient">know</span>
              </h2>
              <p className="lp-lead">Can&rsquo;t find your answer? Our care team is one call away.</p>
              <a className="lp-btn lp-btn-outline" href="tel:+94112345678">
                <PhoneIcon className="lp-icon-sm" /> Call +94 11 234 5678
              </a>
            </Reveal>
            <Reveal variant="right">
              <FaqAccordion />
            </Reveal>
          </div>
        </section>

        {/* ── Call to action ───────────────────────────────────────────────── */}
        <section className="lp-cta-wrap" aria-label="Book your appointment">
          <div className="lp-container">
            <Reveal variant="zoom" className="lp-cta">
              <span className="lp-cta-ring lp-cta-ring--1" aria-hidden="true" />
              <span className="lp-cta-ring lp-cta-ring--2" aria-hidden="true" />
              <div className="lp-cta-copy">
                <span className="lp-cta-kicker">Ready to get started?</span>
                <h2>Book your appointment today</h2>
                <p>Take the first step towards better health. Quick, easy and convenient.</p>
              </div>
              <div className="lp-cta-actions">
                <button type="button" className="lp-btn lp-btn-light lp-btn-lg lp-btn-shine" onClick={() => navigate('/book')}>
                  <CalendarIcon className="lp-icon-sm" /> Book an appointment
                </button>
                <a className="lp-btn lp-btn-glass lp-btn-lg" href="tel:+94112345678">
                  <PhoneIcon className="lp-icon-sm" /> +94 11 234 5678
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── Contact ──────────────────────────────────────────────────────── */}
        <section id="contact" className="lp-section lp-contact lp-section-anchor">
          <div className="lp-container">
            <Reveal className="lp-section-head">
              <span className="lp-eyebrow">Here when you need us</span>
              <h2 className="lp-h2">
                Let&rsquo;s make your next step in care <span className="lp-text-gradient">feel simple</span>
              </h2>
            </Reveal>

            <div className="lp-contact-grid">
              <div className="lp-contact-cards">
                <Reveal delay={0}>
                  <a className="lp-contact-card lp-contact-card--primary" href="tel:+94112345678">
                    <span className="lp-contact-icon"><PhoneIcon className="lp-icon" /></span>
                    <span className="lp-contact-copy">
                      <span>Call our care team</span>
                      <strong>+94 11 234 5678</strong>
                      <small>Available every day, 7:00 AM – 9:00 PM</small>
                    </span>
                    <ArrowRightIcon className="lp-icon-sm lp-contact-arrow" />
                  </a>
                </Reveal>
                <Reveal delay={90}>
                  <a className="lp-contact-card" href="mailto:care@medicore.health">
                    <span className="lp-contact-icon"><MailIcon className="lp-icon" /></span>
                    <span className="lp-contact-copy">
                      <span>Email MediCore</span>
                      <strong>care@medicore.health</strong>
                      <small>We aim to respond within one business day</small>
                    </span>
                    <ArrowRightIcon className="lp-icon-sm lp-contact-arrow" />
                  </a>
                </Reveal>
                <Reveal delay={180}>
                  <div className="lp-contact-card lp-contact-card--visit">
                    <span className="lp-contact-icon"><PinIcon className="lp-icon" /></span>
                    <span className="lp-contact-copy">
                      <span>Visit our centre</span>
                      <strong>Colombo, Sri Lanka</strong>
                      <small>Patient services desk and clinical reception</small>
                    </span>
                  </div>
                </Reveal>
              </div>

              <Reveal variant="right" className="lp-care-panel">
                <span className="lp-care-orbit" aria-hidden="true" />
                <span className="lp-care-eyebrow">MediCore care desk</span>
                <h3>Questions about your care?</h3>
                <p>Start with our team. We will help you find the right department, clinician, or next step.</p>
                <div className="lp-care-hours">
                  <ClockIcon className="lp-icon" />
                  <span>
                    <strong>Open today</strong>
                    <span>7:00 AM – 9:00 PM</span>
                  </span>
                  <span className="lp-live-dot" aria-hidden="true" />
                </div>
                <a className="lp-care-link" href="tel:+94112345678">
                  Speak to our team <ArrowRightIcon className="lp-icon-sm lp-arrow" />
                </a>
              </Reveal>
            </div>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <div className="lp-container lp-footer-grid">
          <div className="lp-footer-brand">
            <BrandMark tagline="Compassionate care. Smarter healthcare." className="mc-brand--light" />
            <p>Compassionate, connected healthcare for every moment that matters.</p>
          </div>
          <nav aria-label="Footer">
            <h4>Quick links</h4>
            <ul>
              {LANDING_SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      scrollToSection(section.id);
                    }}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <h4>Services</h4>
            <ul>
              <li>General Medicine</li>
              <li>Diagnostic Imaging</li>
              <li>Specialty Consultations</li>
              <li>Wellness Care</li>
            </ul>
          </div>
          <div>
            <h4>Contact</h4>
            <ul className="lp-footer-contact">
              <li><PinIcon className="lp-icon-xs" /> Colombo, Sri Lanka</li>
              <li><PhoneIcon className="lp-icon-xs" /> <a href="tel:+94112345678">+94 11 234 5678</a></li>
              <li><MailIcon className="lp-icon-xs" /> <a href="mailto:care@medicore.health">care@medicore.health</a></li>
            </ul>
          </div>
        </div>
        <div className="lp-container lp-footer-bottom">
          <span>© {new Date().getFullYear()} MediCore Health. All rights reserved.</span>
          <span>Built for patients, run by people who care.</span>
        </div>
      </footer>

      <button
        type="button"
        className={`lp-back-to-top ${showBackToTop ? 'is-shown' : ''}`}
        onClick={backToTop}
        aria-label="Back to top"
        aria-hidden={!showBackToTop}
        tabIndex={showBackToTop ? 0 : -1}
      >
        <ArrowUpIcon className="lp-icon" />
      </button>
    </div>
  );
};

export default LandingPage;
