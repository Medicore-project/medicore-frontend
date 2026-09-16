import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="landing-page">
      {/* Navigation Bar */}
      <nav className="landing-nav">
        <div className="landing-nav-container">
          <div className="landing-logo">
            <span className="logo-icon">✦</span> MediCore
          </div>
          <ul className="landing-nav-links">
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#services">Services</a></li>
            <li><a href="#contact">Contact</a></li>
          </ul>
          <div className="landing-nav-actions">
            <span className="contact-number">+94 11 234 5678</span>
            {user ? (
              <button className="btn btn-primary btn-pill" onClick={() => navigate('/dashboard')}>
                Dashboard
              </button>
            ) : (
              <button className="btn btn-primary btn-pill" onClick={() => navigate('/login')}>
                Login / Appointment
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero" id="home">
        <div className="hero-content">
          <div className="hero-text-area">
            <div className="hero-badge">
              <span className="badge-avatars">🩺👨‍⚕️👩‍⚕️</span> 1,000+ satisfied Patients
            </div>
            <h1 className="hero-title">MEDICAL</h1>
            <p className="hero-subtitle">
              Together, advancing healthcare through compassion, innovation, and patient-centered excellence.
            </p>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/login')}>Explore more</button>
            
            <div className="hero-trusted-card">
              <div className="trusted-icon">🏅</div>
              <div className="trusted-text">
                <strong>Trusted healthcare</strong>
                <span>services for healthier, happier lives</span>
              </div>
            </div>
          </div>
          
          <div className="hero-image-area">
            <img src="/images/hero_doctor.jpg" alt="Professional Doctor" className="hero-doctor-img" />
            
            <div className="hero-floating-card">
              <p>At our healthcare center, we are committed to delivering advanced medical care that places your health, comfort, and long-term wellbeing at the heart of everything we do.</p>
              <a href="#services" className="explore-link">Explore more →</a>
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="landing-stats" id="about">
        <div className="stats-container">
          <div className="stats-left">
            <div className="stat-big">
              <span className="stat-number">25+</span>
              <span className="stat-label">Years of combined medical experience</span>
            </div>
          </div>
          <div className="stats-right">
            <h2 className="stats-title">Trusted medical professionals united by one purpose — delivering compassionate, quality healthcare.</h2>
            <p className="stats-desc">Working together experienced doctors, skilled nurses, and dedicated healthcare staff to provide accurate diagnosis, personalized treatment, and patient-centered care in a safe modern clinical environment.</p>
            <button className="btn btn-primary btn-outline">Explore more</button>
            
            <div className="stats-grid">
              <div className="stat-item">
                <h3>90%</h3>
                <p>Patient satisfaction rate</p>
              </div>
              <div className="stat-item">
                <h3>135+</h3>
                <p>Patients successfully treated daily</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="landing-services" id="services">
        <div className="services-container">
          <div className="services-header">
            <span className="section-label">Healthcare services</span>
            <div className="services-tabs">
              <button className="tab active">Medicine</button>
              <button className="tab">Diagnostic imaging</button>
              <button className="tab">Specialty consultations</button>
              <button className="tab">Wellness care</button>
            </div>
          </div>
          
          <div className="services-content">
            <div className="services-text">
              <h2>Medicine department doctor availability and schedule</h2>
              <p>Advanced medical imaging services using safe, high-precision technology to support accurate, timely diagnoses and improved clinical decision-making and quality outcomes.</p>
              
              <div className="services-nav-buttons">
                <button className="nav-btn">←</button>
                <button className="nav-btn active">→</button>
              </div>
            </div>
            
            <div className="services-images">
              <div className="service-img-card">
                <img src="/images/diagnostic.jpg" alt="Diagnostic Imaging" />
              </div>
              <div className="service-img-card">
                <img src="/images/surgery.jpg" alt="Surgery" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="landing-contact" id="contact">
        <div className="contact-container">
          <div className="contact-intro">
            <span className="section-label">Here when you need us</span>
            <h2>Let&rsquo;s make your next step in care feel simple.</h2>
            <p>
              Our team is ready to help with general enquiries, visiting information, and guidance on accessing MediCore services.
            </p>
          </div>

          <div className="contact-layout">
            <div className="contact-info-grid">
              <a className="contact-info-card contact-info-card--phone" href="tel:+94112345678">
                <span className="contact-card-icon" aria-hidden="true">⌁</span>
                <span className="contact-card-copy">
                  <span>Call our care team</span>
                  <strong>+94 11 234 5678</strong>
                  <small>Available every day, 7:00 AM – 9:00 PM</small>
                </span>
                <span className="contact-card-arrow" aria-hidden="true">→</span>
              </a>

              <a className="contact-info-card" href="mailto:care@medicore.health">
                <span className="contact-card-icon" aria-hidden="true">✦</span>
                <span className="contact-card-copy">
                  <span>Email MediCore</span>
                  <strong>care@medicore.health</strong>
                  <small>We aim to respond within one business day</small>
                </span>
                <span className="contact-card-arrow" aria-hidden="true">→</span>
              </a>

              <div className="contact-info-card contact-info-card--visit">
                <span className="contact-card-icon" aria-hidden="true">⌖</span>
                <span className="contact-card-copy">
                  <span>Visit our centre</span>
                  <strong>Colombo, Sri Lanka</strong>
                  <small>Patient services desk and clinical reception</small>
                </span>
              </div>
            </div>

            <aside className="contact-care-panel">
              <div className="contact-panel-orbit" aria-hidden="true" />
              <span className="contact-panel-eyebrow">MEDICORE CARE DESK</span>
              <h3>Questions about your care?</h3>
              <p>Start with our team. We will help you find the right department, clinician, or next step.</p>
              <div className="contact-panel-hours">
                <span className="contact-hours-dot" aria-hidden="true" />
                <div>
                  <strong>Open today</strong>
                  <span>7:00 AM – 9:00 PM</span>
                </div>
              </div>
              <a className="contact-panel-link" href="tel:+94112345678">
                Speak to our team <span aria-hidden="true">→</span>
              </a>
            </aside>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-content">
          <div className="landing-logo">
            <span className="logo-icon">✦</span> MediCore
          </div>
          <p>Compassionate, connected healthcare for every moment that matters.</p>
          <span>© 2026 MediCore Health</span>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
