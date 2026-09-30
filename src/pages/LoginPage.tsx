import React, { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { homePathFor } from '../utils/permissions';
import BrandMark from '../components/landing/BrandMark';
import CountUp from '../components/motion/CountUp';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  EyeIcon,
  EyeOffIcon,
  HeartIcon,
  InfoIcon,
  LockIcon,
  MailIcon,
  ShieldIcon,
  UsersIcon,
} from '../components/icons/LineIcons';

const SHOWCASE_STATS = [
  { to: 1000, suffix: '+', label: 'Satisfied patients', icon: UsersIcon },
  { to: 25, suffix: '+', label: 'Years of experience', icon: ShieldIcon },
  { to: 90, suffix: '%', label: 'Patient satisfaction', icon: HeartIcon },
];

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [showResetHelp, setShowResetHelp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped on every failed attempt so the banner re-mounts and shakes again, even with the same text.
  const [errorCount, setErrorCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Also the post-login redirect: a successful login flips isAuthenticated and sets the user in
  // the same render, so this picks the destination from the role that just signed in.
  if (isAuthenticated) {
    return <Navigate to={homePathFor(user?.role)} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Invalid email or password');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
      setErrorCount((count) => count + 1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const checkCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLockOn(e.getModifierState?.('CapsLock') ?? false);
  };

  return (
    <main className="lg-page">
      <div className="lg-bg" aria-hidden="true">
        <span className="lg-bg-blob lg-bg-blob--1" />
        <span className="lg-bg-blob lg-bg-blob--2" />
        <span className="lg-bg-ring" />
      </div>

      <section className="lg-card" aria-label="MediCore staff sign in">
        <aside className="lg-showcase">
          <Link className="lg-showcase-brand" to="/" aria-label="Back to MediCore home">
            <BrandMark tagline="Hospital Management System" />
          </Link>

          <div className="lg-showcase-copy">
            <span className="lg-showcase-rule" aria-hidden="true" />
            <span className="lg-eyebrow lg-eyebrow--spaced">Connected care</span>
            <h1>
              Better healthcare,
              <br />
              <span className="lg-gradient-word">together.</span>
            </h1>
            <p>A secure, efficient workspace for the professionals delivering exceptional patient care.</p>
          </div>

          <div className="lg-showcase-photo" aria-hidden="true">
            <span className="lg-photo-ring" />
            <img src="/images/hero_doctor.jpg" alt="" />
          </div>

          <ul className="lg-showcase-stats">
            {SHOWCASE_STATS.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <li key={stat.label} style={{ '--i': index } as React.CSSProperties}>
                  <span className="lg-stat-icon"><Icon className="lg-icon" /></span>
                  <CountUp to={stat.to} suffix={stat.suffix} className="lg-stat-number" />
                  <span className="lg-stat-label">{stat.label}</span>
                </li>
              );
            })}
          </ul>

          <p className="lg-showcase-footer">
            <strong>MediCore</strong>
            Compassionate care. Smarter healthcare.
          </p>
        </aside>

        <div className="lg-form-panel">
          <div className="lg-form-top">
            <Link className="lg-mobile-brand" to="/" aria-label="Back to MediCore home">
              <BrandMark />
            </Link>
            <Link className="lg-back" to="/">
              <ArrowLeftIcon className="lg-icon-sm" /> Back to home
            </Link>
          </div>

          <div className="lg-form-body">
            <div className="lg-header lg-step" style={{ '--s': 0 } as React.CSSProperties}>
              <span className="lg-eyebrow">Staff portal</span>
              <h2>Welcome back</h2>
              <p>Sign in to continue to your clinical workspace.</p>
            </div>

            {error && (
              <div key={errorCount} className="lg-error" role="alert">
                <InfoIcon className="lg-icon-sm" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="lg-form">
              <div className="lg-field lg-step" style={{ '--s': 1 } as React.CSSProperties}>
                <label htmlFor="email">Work email</label>
                <div className="lg-input-wrap">
                  <MailIcon className="lg-input-icon" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@hospital.com"
                    required
                  />
                </div>
              </div>

              <div className="lg-field lg-step" style={{ '--s': 2 } as React.CSSProperties}>
                <label htmlFor="password">Password</label>
                <div className="lg-input-wrap">
                  <LockIcon className="lg-input-icon" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={checkCapsLock}
                    onKeyUp={checkCapsLock}
                    onBlur={() => setCapsLockOn(false)}
                    placeholder="Enter your password"
                    className="lg-input-with-toggle"
                    aria-describedby={capsLockOn ? 'caps-lock-note' : undefined}
                    required
                  />
                  <button
                    type="button"
                    className="lg-password-toggle"
                    onClick={() => setShowPassword((shown) => !shown)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    aria-controls="password"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {/* Both icons stay mounted so the swap can cross-fade. */}
                    <EyeIcon className={`lg-toggle-icon ${showPassword ? '' : 'is-shown'}`} />
                    <EyeOffIcon className={`lg-toggle-icon ${showPassword ? 'is-shown' : ''}`} />
                  </button>
                </div>
                {capsLockOn && (
                  <span id="caps-lock-note" className="lg-caps-note" role="status">
                    Caps Lock is on
                  </span>
                )}
              </div>

              <div className="lg-form-row lg-step" style={{ '--s': 3 } as React.CSSProperties}>
                <button
                  type="button"
                  className="lg-link-button"
                  aria-expanded={showResetHelp}
                  aria-controls="reset-help"
                  onClick={() => setShowResetHelp((shown) => !shown)}
                >
                  Forgot password?
                </button>
              </div>

              <div
                id="reset-help"
                className={`lg-reset-help ${showResetHelp ? 'is-open' : ''}`}
                inert={!showResetHelp}
              >
                <div>
                  <p>
                    <InfoIcon className="lg-icon-sm" />
                    Password resets are handled by your MediCore administrator. Ask them to reset your access, then
                    sign in with the new password.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="lg-submit lg-step"
                style={{ '--s': 4 } as React.CSSProperties}
                disabled={isSubmitting}
              >
                <span>{isSubmitting ? 'Signing in...' : 'Sign in securely'}</span>
                {isSubmitting ? (
                  <span className="lg-spinner" aria-hidden="true" />
                ) : (
                  <ArrowRightIcon className="lg-icon-sm lg-submit-arrow" />
                )}
              </button>
            </form>

            <div className="lg-divider lg-step" style={{ '--s': 5 } as React.CSSProperties}>
              <span>Here to see a doctor?</span>
            </div>

            <Link
              to="/book"
              className="lg-secondary lg-step"
              style={{ '--s': 6 } as React.CSSProperties}
              data-testid="login-book-link"
            >
              <CalendarIcon className="lg-icon-sm" />
              Book an appointment — no account needed
            </Link>

            <p className="lg-security-note lg-step" style={{ '--s': 7 } as React.CSSProperties}>
              <ShieldIcon className="lg-icon-sm" />
              Protected access for authorised MediCore staff.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
