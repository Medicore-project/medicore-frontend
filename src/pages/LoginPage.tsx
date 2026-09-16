import React, { useState, type FormEvent } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const LoginPage: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Invalid email or password');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="login-container">
      <section className="login-card" aria-label="MediCore staff sign in">
        <aside className="login-showcase">
          <Link className="login-brand" to="/" aria-label="Back to MediCore home">
            <span className="login-brand-mark" aria-hidden="true">✦</span>
            <span>MediCore</span>
          </Link>

          <div className="login-showcase-copy">
            <span className="login-eyebrow">CONNECTED CARE</span>
            <h1>Care starts with a confident team.</h1>
            <p>One secure workspace for the people shaping every patient’s journey.</p>
          </div>

          <div className="login-assurance-card">
            <span className="login-assurance-icon" aria-hidden="true">✦</span>
            <div>
              <strong>Care, connected.</strong>
              <span>Secure access for the MediCore clinical team.</span>
            </div>
          </div>
        </aside>

        <div className="login-form-panel">
          <div className="login-mobile-brand">
            <Link className="login-brand" to="/" aria-label="Back to MediCore home">
              <span className="login-brand-mark" aria-hidden="true">✦</span>
              <span>MediCore</span>
            </Link>
          </div>

          <div className="login-header">
            <span className="login-eyebrow">STAFF PORTAL</span>
            <h2>Welcome back</h2>
            <p>Sign in to continue to your clinical workspace.</p>
          </div>

          {error && <div className="error-banner" role="alert">{error}</div>}

          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group login-field">
              <label htmlFor="email">Work email</label>
              <div className="login-input-wrap">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="login-input-icon">
                  <path d="M3.75 6.75h16.5v10.5H3.75V6.75Zm0 .75L12 12.75l8.25-5.25M3.75 17.25l5.75-5.1m10.75 5.1-5.75-5.1" />
                </svg>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@hospital.com"
                  required
                />
              </div>
            </div>

            <div className="form-group login-field">
              <label htmlFor="password">Password</label>
              <div className="login-input-wrap">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="login-input-icon">
                  <rect x="5.25" y="10.25" width="13.5" height="9.25" rx="1.5" />
                  <path d="M8.25 10.25V7.5a3.75 3.75 0 0 1 7.5 0v2.75m-3.75 4v2" />
                </svg>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
            </div>

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              <span>{isSubmitting ? 'Signing in...' : 'Sign in securely'}</span>
              {!isSubmitting && <span aria-hidden="true">→</span>}
            </button>
          </form>

          <p className="login-security-note">
            <span aria-hidden="true">✦</span> Protected access for authorised MediCore staff.
          </p>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
