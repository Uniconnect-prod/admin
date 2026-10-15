import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, ShieldCheck, AlertCircle, ArrowRight, ChevronLeft, ChevronRight, Loader2, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import './LoginPage.scss';

const DEFAULT_SHOWCASE = [
  {
    code: 'UNISOLUTION_CORE',
    name: 'Mobile Technology',
    highlight: 'Solution',
    badge: 'Telecom & Digital Solutions',
    description: 'Pioneering innovative mobile solutions and high-performance telecom technologies for leading operators worldwide.',
    bgImage: '/brand/unisolution_hero.jpg',
    stats: []
  }
];

const ACCESS_HINTS = {
  PLATFORM_ACCESS_EXPIRED: 'Your authorisation period has ended. Contact your administrator to renew access.',
  PLATFORM_ACCESS_UPCOMING: 'Your authorisation has not started yet. You can sign in from the start date.',
  PLATFORM_ACCESS_REVOKED: 'Your platform authorisation has been revoked by an administrator.',
  NO_PLATFORMS_ASSIGNED: 'No platforms are assigned to this account yet.',
  RATE_LIMITED: 'Too many sign-in attempts. Please wait a few minutes before trying again.'
};

export const LoginPage = () => {
  const { login, isAuthenticated, loading: sessionLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showHelp, setShowHelp] = useState(false);

  const [slides, setSlides] = useState(DEFAULT_SHOWCASE);
  const [activeSlide, setActiveSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    api.get('/platforms/showcase')
      .then(res => { if (Array.isArray(res.data?.data) && res.data.data.length) setSlides(res.data.data); })
      .catch(() => { /* keep the built-in slide */ });
  }, []);

  useEffect(() => {
    if (paused || slides.length < 2) return undefined;
    timerRef.current = setInterval(() => setActiveSlide(p => (p + 1) % slides.length), 6500);
    return () => clearInterval(timerRef.current);
  }, [slides.length, paused, activeSlide]);

  if (!sessionLoading && isAuthenticated) return <Navigate to="/overview" replace />;

  const current = slides[activeSlide] || DEFAULT_SHOWCASE[0];
  const from = location.state?.from && !location.state.from.startsWith('/login') ? location.state.from : '/overview';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await login(username.trim(), password);
    setSubmitting(false);
    if (result.success) navigate(from, { replace: true });
    else setError(result);
  };

  return (
    <div className="login">
      <section className="login__hero" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-label="UNI.SOLUTION">
        {slides.map((s, i) => (
          <div key={s.code || i} className={`login__bg ${i === activeSlide ? 'is-active' : ''}`} style={{ backgroundImage: `url(${s.bgImage || '/brand/unisolution_hero.jpg'})` }} />
        ))}
        <div className="login__overlay" />
        <div className="login__hero-inner">
          <div className="login__brand">
            <img src="/brand/unisolution_logo_dark.png" alt="UNI.SOLUTION" />
          </div>

          <div className="login__slide" key={current.code}>
            <span className="login__pill"><span className="login__pulse" />{current.badge}</span>
            <h1>
              {current.name}{' '}
              {current.highlight && <span>{current.highlight}</span>}
            </h1>
            <p>{current.description}</p>
            {current.stats?.length > 0 && (
              <div className="login__stats">
                {current.stats.map(st => (
                  <div key={st.label}><strong>{st.value}</strong><span>{st.label}</span></div>
                ))}
              </div>
            )}
          </div>

          {slides.length > 1 && (
            <div className="login__controls">
              <div className="login__dots">
                {slides.map((s, i) => (
                  <button key={s.code || i} type="button" className={i === activeSlide ? 'is-active' : ''} onClick={() => setActiveSlide(i)} aria-label={`Show slide ${i + 1}`} />
                ))}
              </div>
              <div className="login__arrows">
                <button type="button" onClick={() => setActiveSlide(p => (p === 0 ? slides.length - 1 : p - 1))} aria-label="Previous slide"><ChevronLeft size={18} /></button>
                <span>{activeSlide + 1} / {slides.length}</span>
                <button type="button" onClick={() => setActiveSlide(p => (p + 1) % slides.length)} aria-label="Next slide"><ChevronRight size={18} /></button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="login__panel">
        <div className="login__card">
          <img className="login__mobile-logo" src="/brand/unisolution_logo.png" alt="UNI.SOLUTION" />
          <div className="login__heading">
            <span className="eyebrow">Reporting Platform</span>
            <h2>Sign in to your account</h2>
            <p>Multi-platform subscription, billing and revenue reporting.</p>
          </div>

          {params.get('expired') && !error && (
            <div className="alert alert--warning"><Info size={17} /><div className="alert__body">Your session ended. Please sign in again.</div></div>
          )}

          {error && (
            <div className="alert alert--danger" role="alert">
              <AlertCircle size={17} />
              <div className="alert__body">
                <div className="alert__title">{error.message}</div>
                {ACCESS_HINTS[error.code] && <span>{ACCESS_HINTS[error.code]}</span>}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login__form" noValidate>
            <div className="field">
              <label className="field__label" htmlFor="login-username">Username or email</label>
              <div className="input-group">
                <User size={16} />
                <input id="login-username" className="input input--lg" autoComplete="username" placeholder="you@company.com" value={username} onChange={e => setUsername(e.target.value)} required autoFocus />
              </div>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="login-password">Password</label>
              <div className="input-group">
                <Lock size={16} />
                <input id="login-password" className="input input--lg" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={e => setPassword(e.target.value)} required />
                <button type="button" className="input-group__suffix btn btn--ghost btn--icon btn--sm" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={submitting || !username.trim() || !password}>
              {submitting ? <><Loader2 size={17} className="spin" /> Signing in…</> : <>Sign in <ArrowRight size={17} /></>}
            </button>
          </form>

          <button type="button" className="login__help" onClick={() => setShowHelp(s => !s)} aria-expanded={showHelp}>Trouble signing in?</button>
          {showHelp && (
            <p className="login__help-text">Passwords are reset by a Super Admin from <em>Users &amp; Access Control</em>. Contact your administrator if you've forgotten your password or your access has expired.</p>
          )}

          <div className="login__secure"><ShieldCheck size={14} /> Secured access · UNI.SOLUTION</div>
        </div>
      </section>
    </div>
  );
};

export default LoginPage;
