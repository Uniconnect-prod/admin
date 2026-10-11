import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Eye, EyeOff, Lock, User, Layers, ShieldCheck, AlertCircle, ArrowRight, 
  Zap, Film, Gamepad2, Music, HelpCircle, ChevronLeft, ChevronRight, PlayCircle
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { PlatformLogo, PLATFORM_META } from '../../components/common/PlatformBadge';
import axios from 'axios';
import './LoginPage.scss';

// Fallback platforms showcase data
const DEFAULT_SHOWCASE = [
  {
    code: 'GHSNAPFLIX',
    name: 'GHSnapflix',
    tagline: "Ghana's Premier Video On Demand & African Cinema",
    description: "Stream trending blockbuster movies, Nollywood hits, local Ghallywood cinema, and exclusive daily episodic series anywhere.",
    bgImage: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1200&q=80',
    badge: 'Video Streaming',
    accentColor: '#FFCC00',
    icon: Film,
    stats: [
      { label: 'Active Streamers', value: '190K+' },
      { label: 'Video Catalog', value: '1,450+ Titles' },
      { label: 'Avg Watch Time', value: '42m/day' }
    ]
  },
  {
    code: 'GHGAMEZONE',
    name: 'GHGameZone',
    tagline: 'Ultimate Cloud & Mobile HTML5 Gaming Arena',
    description: 'Compete in daily tournament leaderboards, high-stakes arcade battles, action racing, and multi-player tournaments with instant MoMo rewards.',
    bgImage: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80',
    badge: 'Cloud Gaming',
    accentColor: '#00E5FF',
    icon: Gamepad2,
    stats: [
      { label: 'Daily Gamers', value: '142K+' },
      { label: 'Instant Games', value: '380+ Games' },
      { label: 'Prize Pool Paid', value: 'GHC 240K' }
    ]
  },
  {
    code: 'GHMUSIC',
    name: 'GHMusic',
    tagline: 'Afrobeats, Highlife & Live Gospel Streaming Hub',
    description: "Unlimited high-fidelity streaming, offline downloads, curated DJ playlists, and artist monetization for West Africa's finest talent.",
    bgImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1200&q=80',
    badge: 'Music & Audio',
    accentColor: '#FF6B00',
    icon: Music,
    stats: [
      { label: 'Subscribers', value: '115K+' },
      { label: 'Audio Tracks', value: '250K+ Songs' },
      { label: 'Live Radio', value: '24/7 Airtime' }
    ]
  },
  {
    code: 'GHQUIZ',
    name: 'GHQuiz',
    tagline: 'Daily Trivia, Brain Battles & Instant MoMo Prizes',
    description: 'Interactive SMS and web trivia challenges covering sports, general knowledge, pop culture, and science with real-time cash payouts.',
    bgImage: 'https://images.unsplash.com/photo-1606326608606-aa0b62935f2b?auto=format&fit=crop&w=1200&q=80',
    badge: 'Trivia & Rewards',
    accentColor: '#00E676',
    icon: HelpCircle,
    stats: [
      { label: 'Quiz Masters', value: '78K+' },
      { label: 'Daily Winners', value: '1,200+' },
      { label: 'Win Rate', value: '34.2%' }
    ]
  }
];

export const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [errorDetails, setErrorDetails] = useState(null);

  // Carousel State
  const [slides, setSlides] = useState(DEFAULT_SHOWCASE);
  const [activeSlide, setActiveSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef(null);

  // Fetch showcase from backend API if available
  useEffect(() => {
    const fetchShowcase = async () => {
      try {
        const res = await axios.get('/api/platforms/showcase');
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          const iconMap = {
            GHSNAPFLIX: Film,
            GHGAMEZONE: Gamepad2,
            GHMUSIC: Music,
            GHQUIZ: HelpCircle
          };
          const mapped = res.data.data.map(item => ({
            ...item,
            icon: iconMap[item.code] || PlayCircle
          }));
          setSlides(mapped);
        }
      } catch (err) {
        console.warn('Using fallback showcase data:', err.message);
      }
    };
    fetchShowcase();
  }, []);

  // Automated Slideshow transition timer (every 5 seconds)
  useEffect(() => {
    if (isPaused || slides.length === 0) return;

    timerRef.current = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % slides.length);
    }, 5000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [slides.length, isPaused, activeSlide]);

  const handlePrevSlide = () => {
    setActiveSlide(prev => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const handleNextSlide = () => {
    setActiveSlide(prev => (prev + 1) % slides.length);
  };

  const currentSlide = slides[activeSlide] || DEFAULT_SHOWCASE[0];
  const CurrentIcon = currentSlide.icon || PlayCircle;

  // Single Sign-In Submission (NO platform sent from frontend)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setErrorDetails(null);
    setLoading(true);

    const result = await login(username, password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setErrorMessage(result.message);
      setErrorDetails(result.code);
    }
  };



  return (
    <div className="login-container">
      {/* Left side automated slideshow carousel with black gradient layer */}
      <div 
        className="login-hero-carousel"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Background Slides */}
        {slides.map((slide, idx) => (
          <div
            key={slide.code || idx}
            className={`carousel-bg-slide ${idx === activeSlide ? 'active' : ''}`}
            style={{ backgroundImage: `url(${slide.bgImage})` }}
          />
        ))}

        {/* Heavy Black Gradient Overlay */}
        <div className="carousel-black-gradient" />

        {/* Ambient Platform Accent Glow */}
        <div className="carousel-glow-accent" />

        {/* Carousel Content */}
        <div className="hero-carousel-content">
          {/* Top Brand Bar */}
          <div className="hero-brand">
            <PlatformLogo platformCode={currentSlide.code} size="md" />
            <div className="brand-titles">
              <h2>{currentSlide.name}</h2>
              <p>Multi-Platform Report Management System</p>
            </div>
          </div>

          {/* Center Platform Feature Showcase */}
          <div className="carousel-platform-body" key={currentSlide.code}>
            <div className="platform-meta-pill">
              <CurrentIcon size={15} className="pill-icon" />
              <span>{currentSlide.badge}</span>
              <span className="pill-separator">•</span>
              <span className="pill-status">Active Platform</span>
            </div>

            <h1 className="platform-title">
              {currentSlide.name}
            </h1>

            <p className="platform-tagline">
              {currentSlide.tagline}
            </p>

            <p className="platform-description">
              {currentSlide.description}
            </p>

            {/* Platform Stats Pills */}
            {currentSlide.stats && currentSlide.stats.length > 0 && (
              <div className="platform-stats-grid">
                {currentSlide.stats.map((st, i) => (
                  <div className="stat-card" key={i}>
                    <span className="stat-value">{st.value}</span>
                    <span className="stat-label">{st.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Carousel Footer Controls */}
          <div className="carousel-controls-bar">
            {/* Progress dots */}
            <div className="carousel-dots">
              {slides.map((s, idx) => (
                <button
                  key={s.code || idx}
                  type="button"
                  className={`dot ${idx === activeSlide ? 'active' : ''}`}
                  onClick={() => setActiveSlide(idx)}
                  title={s.name}
                >
                  <span className="dot-inner" />
                </button>
              ))}
            </div>

            {/* Arrows */}
            <div className="carousel-nav-arrows">
              <button
                type="button"
                className="nav-arrow-btn"
                onClick={handlePrevSlide}
                aria-label="Previous Slide"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="slide-counter">
                {activeSlide + 1} / {slides.length}
              </span>
              <button
                type="button"
                className="nav-arrow-btn"
                onClick={handleNextSlide}
                aria-label="Next Slide"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right side login form */}
      <div className="login-form-wrapper">
        <div className="login-box card">
          <div className="login-header">
            <div className="login-logo-mobile">
              <PlatformLogo platformCode="ALL" size="lg" />
            </div>
            <h2>Sign In to Portal</h2>
            <p>Single sign-in access. Authorized platforms and active dates are verified dynamically.</p>
          </div>

          {errorMessage && (
            <div className={`login-alert-error ${errorDetails ? `error-${errorDetails.toLowerCase()}` : ''}`}>
              <AlertCircle size={18} className="alert-icon" />
              <div className="alert-text">
                <strong>{errorMessage}</strong>
                {errorDetails === 'PLATFORM_ACCESS_EXPIRED' && (
                  <p className="error-subtext">Your authorization period has ended. Contact your system administrator to renew access.</p>
                )}
                {errorDetails === 'PLATFORM_ACCESS_UPCOMING' && (
                  <p className="error-subtext">Your authorization has not started yet. Please wait until the start date.</p>
                )}
                {errorDetails === 'PLATFORM_ACCESS_REVOKED' && (
                  <p className="error-subtext">Your platform authorization has been revoked by an administrator.</p>
                )}
                {errorDetails === 'NO_ASSIGNED_PLATFORMS' && (
                  <p className="error-subtext">No active platforms are assigned to this user account.</p>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            {/* Username or Email */}
            <div className="form-group">
              <label>Username or Email</label>
              <div className="input-icon-wrapper">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="Enter username or email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-control with-icon"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group">
              <label>Password</label>
              <div className="input-icon-wrapper">
                <Lock size={16} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="form-control with-icon password-input"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="form-options">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>

              <a href="#forgot" className="forgot-link" onClick={(e) => { e.preventDefault(); alert('Password recovery: Please contact system administrator.'); }}>
                Forgot password?
              </a>
            </div>

            {/* Login Button */}
            <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
              {loading ? 'Authenticating...' : (
                <>
                  Sign In to Platform
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
