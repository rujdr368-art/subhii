import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  Sparkles,
  Eye,
  EyeOff,
  Mail,
  User,
  X,
  Search,
  CheckCircle,
  Users,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe,
  LogIn,
  UserPlus,
  Menu,
  Star,
  Send,
  HelpCircle,
  FileText
} from 'lucide-react';
import { Service } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { getApiUrl, safeParseResponse, fetchPublicSettings } from '../lib/api.ts';
import { AnimatedLogo } from './AnimatedLogo.tsx';
import { LoginFaqSection } from './LoginFaqSection.tsx';
import { LoginFooter } from './LoginFooter.tsx';
import { LoginLiveTicker } from './LoginLiveTicker.tsx';
import { LoginStatsSection } from './LoginStatsSection.tsx';
import { LoginPlatformMarquee } from './LoginPlatformMarquee.tsx';
const LoginModals = lazy(() =>
  import('./LoginModals.tsx').then((m) => ({ default: m.LoginModals }))
);
import { updateSeoMetadata, PAGE_SEO_REGISTRY } from '../utils/seo.ts';

interface LoginPageProps {
  onLogin?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const { authError, clearAuthError, loginLocal, registerLocal, loginGoogle, initiateGoogleOAuth } = useAuth();
  const [showServicesModal, setShowServicesModal] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);

  // Footer & FAQ Modals
  const [showAboutModal, setShowAboutModal] = useState(false);
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [showChildPanelsModal, setShowChildPanelsModal] = useState(false);
  const [showAffiliatesModal, setShowAffiliatesModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [publicSettings, setPublicSettings] = useState<any>({});

  const [services, setServices] = useState<Service[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [websiteName, setWebsiteName] = useState('trustysmm');
  const [websiteLogo, setWebsiteLogo] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleLoginStatus, setGoogleLoginStatus] = useState('enabled');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const [authMode, setAuthMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPublicSettings().then((data) => {
      if (data) {
        setPublicSettings(data);
        if (data.websiteName) {
          setWebsiteName(data.websiteName);
        }
        if (data.websiteLogo) {
          setWebsiteLogo(data.websiteLogo);
        }
        if (data.googleClientId) {
          setGoogleClientId(data.googleClientId);
        }
        if (data.googleLoginStatus) {
          setGoogleLoginStatus(data.googleLoginStatus);
        }
      }
    });
  }, []);

  // SEO-friendly deep-linking and modal URL synchronization
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname.toLowerCase().replace(/\/+$/, '');

    if (path === '/services') {
      setShowServicesModal(true);
    } else if (path === '/blog' || path.startsWith('/blog/')) {
      setShowBlogModal(true);
    } else if (path === '/about') {
      setShowAboutModal(true);
    } else if (path === '/terms') {
      setShowTermsModal(true);
    } else if (path === '/privacy') {
      setShowPrivacyModal(true);
    } else if (path === '/contact' || path === '/support') {
      setShowContactModal(true);
    } else if (path === '/api-docs' || path === '/api') {
      setShowApiModal(true);
    } else if (path === '/child-panels') {
      setShowChildPanelsModal(true);
    } else if (path === '/affiliates') {
      setShowAffiliatesModal(true);
    } else if (path === '/faq') {
      setTimeout(() => {
        const el = document.getElementById('faq-section');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
  }, []);

  // Sync browser address bar with open modals for clean SEO navigation
  useEffect(() => {
    if (typeof window === 'undefined' || !window.history) return;
    const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '');

    let targetPath = '/';
    if (showServicesModal) targetPath = '/services';
    else if (showBlogModal) targetPath = currentPath.startsWith('/blog/') ? window.location.pathname : '/blog';
    else if (showAboutModal) targetPath = '/about';
    else if (showTermsModal) targetPath = '/terms';
    else if (showPrivacyModal) targetPath = '/privacy';
    else if (showContactModal) targetPath = '/contact';
    else if (showSupportModal) targetPath = '/support';
    else if (showApiModal) targetPath = '/api-docs';
    else if (showChildPanelsModal) targetPath = '/child-panels';
    else if (showAffiliatesModal) targetPath = '/affiliates';

    const recognizedPaths = ['/services', '/blog', '/about', '/terms', '/privacy', '/contact', '/support', '/api-docs', '/child-panels', '/affiliates'];
    if (targetPath !== '/' && currentPath !== targetPath) {
      window.history.replaceState(null, '', targetPath);
    } else if (targetPath === '/' && (recognizedPaths.includes(currentPath) || currentPath.startsWith('/blog/'))) {
      window.history.replaceState(null, '', '/');
    }
  }, [
    showServicesModal,
    showBlogModal,
    showAboutModal,
    showTermsModal,
    showPrivacyModal,
    showContactModal,
    showSupportModal,
    showApiModal,
    showChildPanelsModal,
    showAffiliatesModal
  ]);

  // Synchronize SEO titles, descriptions, canonical URLs, and robots indexing per route/modal
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentPath = window.location.pathname.toLowerCase().replace(/\/+$/, '');
    const isAuthRoute = ['/login', '/signin', '/register', '/signup'].includes(currentPath);

    if (isAuthRoute || showForgotModal) {
      updateSeoMetadata(PAGE_SEO_REGISTRY.auth);
    } else if (showServicesModal) {
      updateSeoMetadata(PAGE_SEO_REGISTRY.services);
    } else if (showBlogModal) {
      updateSeoMetadata(PAGE_SEO_REGISTRY.blog);
    } else if (showAboutModal) {
      updateSeoMetadata(PAGE_SEO_REGISTRY.about);
    } else if (showTermsModal) {
      updateSeoMetadata(PAGE_SEO_REGISTRY.terms);
    } else if (showPrivacyModal) {
      updateSeoMetadata(PAGE_SEO_REGISTRY.privacy);
    } else if (showContactModal || showSupportModal) {
      updateSeoMetadata(PAGE_SEO_REGISTRY.contact);
    } else if (showApiModal) {
      updateSeoMetadata(PAGE_SEO_REGISTRY['api-docs']);
    } else if (showChildPanelsModal) {
      updateSeoMetadata(PAGE_SEO_REGISTRY['child-panels']);
    } else if (showAffiliatesModal) {
      updateSeoMetadata(PAGE_SEO_REGISTRY.affiliates);
    } else {
      updateSeoMetadata(PAGE_SEO_REGISTRY.home);
    }
  }, [
    showForgotModal,
    showServicesModal,
    showBlogModal,
    showAboutModal,
    showTermsModal,
    showPrivacyModal,
    showContactModal,
    showSupportModal,
    showApiModal,
    showChildPanelsModal,
    showAffiliatesModal
  ]);

  const handleOpenServicesCategory = (category: string) => {
    setFilterCategory(category);
    setSearch('');
    setShowServicesModal(true);
  };

  const handleScrollToFaq = () => {
    const el = document.getElementById('faq-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleSelectAuthModeFromModal = (mode: 'signin' | 'register') => {
    setAuthMode(mode);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoogleSignIn = () => {
    setLocalError(null);
    clearAuthError();
    setIsGoogleLoading(true);
    try {
      initiateGoogleOAuth();
    } catch (err: any) {
      setLocalError(err.message || 'Failed to initiate Google sign in.');
    } finally {
      setTimeout(() => setIsGoogleLoading(false), 2000);
    }
  };

  useEffect(() => {
    if (showServicesModal) {
      fetch(getApiUrl('/api/services/public'))
        .then((res) => safeParseResponse(res))
        .then((data) => setServices(Array.isArray(data) ? data : []))
        .catch((err) => console.error(err));
    }
  }, [showServicesModal]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!email) {
      setLocalError('Please enter your email or username.');
      return;
    }

    if (!password) {
      setLocalError('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    const success = await loginLocal(email, password);
    setIsSubmitting(false);

    if (success && onLogin) {
      onLogin();
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();

    if (!name.trim()) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (!email.trim()) {
      setLocalError('Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    const success = await registerLocal(name.trim(), email.trim(), password);
    setIsSubmitting(false);

    if (success && onLogin) {
      onLogin();
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotMessage(`Password reset link sent to ${forgotEmail}. Please check your inbox or spam folder.`);
  };

  const categories = ['All', ...Array.from(new Set(services.map((s) => s.categoryName || 'General')))];

  const filteredServices = services.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    const cat = s.categoryName || 'General';
    const matchesCategory = filterCategory === 'All' || cat === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const displayError = localError || (authError ? (typeof authError === 'string' ? authError : authError.message) : null);

  return (
    <div className="min-h-screen bg-[#101010] text-[#F5F5F5] flex flex-col justify-between font-sans relative selection:bg-[#FF3030] selection:text-white">
      {/* Subtle Ambient Red Radial Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#FF3030]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[300px] bg-[#FF3030]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Floating Navbar: #1C1C1C with #2A2A2A border */}
      <header className="w-full max-w-6xl mx-auto pt-4 sm:pt-6 px-4 sm:px-6 lg:px-8 z-30">
        <div className="bg-[#1C1C1C]/90 backdrop-blur-md border border-[#2A2A2A] shadow-xl rounded-2xl sm:rounded-3xl px-5 py-3 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center space-x-2.5 cursor-pointer">
            {websiteLogo ? (
              <img src={websiteLogo} alt={websiteName || 'trustysmm'} className="h-8 max-w-[140px] object-contain" referrerPolicy="no-referrer" />
            ) : (
              <AnimatedLogo size="md" showText={true} theme="dark" />
            )}
          </div>

          {/* Header Action Links & Hamburger Menu */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => setShowServicesModal(true)}
              className="hidden sm:inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 border border-[#2A2A2A] transition-all cursor-pointer shadow-xs"
            >
              <Eye className="w-3.5 h-3.5 text-[#FF3030]" />
              <span>Services</span>
            </button>

            <a
              href="https://t.me/securesmmtursted"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-white/5 border border-[#2A2A2A] transition-all shadow-xs"
            >
              <Send className="w-3.5 h-3.5 text-sky-400" />
              <span>Telegram</span>
            </a>

            {/* Hamburger Menu Toggle */}
            <button
              onClick={() => setShowMenuDrawer(!showMenuDrawer)}
              aria-label="Toggle Menu"
              className="p-2 rounded-xl border border-[#2A2A2A] hover:bg-[#252525] text-gray-200 transition-colors cursor-pointer active:scale-95 shadow-sm"
            >
              {showMenuDrawer ? <X className="w-5 h-5 text-gray-200" /> : <Menu className="w-5 h-5 text-gray-200" />}
            </button>
          </div>
        </div>

        {/* Dropdown Navigation Drawer */}
        <AnimatePresence>
          {showMenuDrawer && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-2 bg-[#1C1C1C] border border-[#2A2A2A] rounded-2xl shadow-2xl p-3 flex flex-col space-y-1 text-sm font-medium z-40"
            >
              <button
                onClick={() => {
                  setShowServicesModal(true);
                  setShowMenuDrawer(false);
                }}
                className="flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl hover:bg-[#252525] hover:text-[#FF3030] text-gray-300 transition-all text-left cursor-pointer"
              >
                <Eye className="w-4 h-4 text-[#FF3030]" />
                <span>Browse Services List</span>
              </button>
              <a
                href="https://t.me/securesmmtursted"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl hover:bg-[#252525] hover:text-[#FF3030] text-gray-300 transition-all text-left cursor-pointer"
              >
                <Send className="w-4 h-4 text-sky-400" />
                <span>Telegram Support</span>
              </a>
              <button
                onClick={() => {
                  setShowForgotModal(true);
                  setShowMenuDrawer(false);
                }}
                className="flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl hover:bg-[#252525] hover:text-[#FF3030] text-gray-300 transition-all text-left cursor-pointer"
              >
                <HelpCircle className="w-4 h-4 text-amber-400" />
                <span>Forgot Password?</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main Content Area: 2-Column Responsive Layout */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 z-10 box-border">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center">
          
          {/* ========================================================================= */}
          {/* LEFT SIDE: HERO SECTION */}
          {/* ========================================================================= */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="md:col-span-6 lg:col-span-7 flex flex-col space-y-5 sm:space-y-6 text-left"
          >
            {/* Badge: MAIN SMM PROVIDER */}
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-[#FF3030]/10 border border-[#FF3030]/30 text-[#FF5050] shadow-xs self-start">
              <span className="w-2 h-2 rounded-full bg-[#FF3030] animate-pulse" />
              <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider font-mono">
                MAIN SMM PROVIDER
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-[1.12] font-display">
              Grow Smarter With TrustySMM
              <br />
              <span className="text-[#FF3030]">Powerful Social Media Solutions</span>
            </h1>

            {/* Description */}
            <p className="text-sm sm:text-base text-gray-300 leading-relaxed font-normal max-w-xl">
              Scale your brand with India's #1 most trusted SMM provider. Instant automated delivery, high-retention growth services for Instagram, YouTube, Telegram & Facebook at unbeatable wholesale prices with 24/7 support.
            </p>

            {/* Two Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              {/* Bold Red Button: Create Account */}
              <button
                type="button"
                id="hero-create-account-btn"
                onClick={() => {
                  setAuthMode('register');
                  setLocalError(null);
                  clearAuthError();
                  document.getElementById('auth-form-card')?.scrollIntoView({ behavior: 'smooth' });
                  setTimeout(() => {
                    const el = document.getElementById('register-name-input') as HTMLInputElement | null;
                    el?.focus();
                  }, 200);
                }}
                className="px-6 py-3.5 rounded-2xl bg-[#FF3030] hover:bg-[#E02424] text-white font-bold text-sm shadow-lg shadow-[#FF3030]/25 transition-all cursor-pointer flex items-center justify-center space-x-2 active:scale-[0.99]"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Account</span>
              </button>

              {/* Dark Card Button: Browse all services */}
              <button
                type="button"
                onClick={() => setShowServicesModal(true)}
                className="px-6 py-3.5 rounded-2xl bg-[#1C1C1C] hover:bg-[#252525] border border-[#2A2A2A] text-gray-200 font-bold text-sm shadow-xs transition-all cursor-pointer flex items-center justify-center space-x-2 hover:border-[#FF3030]/40 active:scale-[0.99]"
              >
                <span>Browse all services</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Live-order/service ticker */}
            <div className="pt-2">
              <LoginLiveTicker />
            </div>
          </motion.div>

          {/* ========================================================================= */}
          {/* RIGHT SIDE: AUTHENTICATION FORM + RATING */}
          {/* ========================================================================= */}
          <motion.div
            id="auth-form-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.05 }}
            className="md:col-span-6 lg:col-span-5 w-full flex flex-col items-center space-y-4"
          >
            {/* Form Card: #1C1C1C with #2A2A2A border & red accent glow */}
            <div className="w-full bg-[#1C1C1C] rounded-3xl border border-[#2A2A2A] shadow-2xl shadow-black/80 ring-1 ring-[#FF3030]/15 p-6 sm:p-8 relative">
              {/* Segmented Tab Switcher */}
              <div className="grid grid-cols-2 bg-[#141414] p-1.5 rounded-2xl border border-[#2A2A2A] mb-6 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setLocalError(null);
                    clearAuthError();
                  }}
                  className={`py-2.5 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                    authMode === 'signin'
                      ? 'bg-[#FF3030] text-white shadow-md shadow-[#FF3030]/25 font-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>Sign in</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setLocalError(null);
                    clearAuthError();
                  }}
                  className={`py-2.5 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                    authMode === 'register'
                      ? 'bg-[#FF3030] text-white shadow-md shadow-[#FF3030]/25 font-black'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>Register</span>
                </button>
              </div>

              {/* Card Headings */}
              <div className="text-left mb-6">
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {authMode === 'signin' ? 'Welcome back' : 'Create an account'}
                </h2>
                <p className="text-xs sm:text-sm text-gray-400 mt-1">
                  {authMode === 'signin' ? 'Sign in to manage your orders' : 'Join thousands of active resellers today'}
                </p>
              </div>

              {/* Error Banner */}
              {displayError && (
                <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center space-x-2 text-left">
                  <span className="font-semibold">{displayError}</span>
                </div>
              )}

              {/* Direct Form: Sign In */}
              {authMode === 'signin' ? (
                <form onSubmit={handleSignIn} className="space-y-4 text-left">
                  {/* Username or Email */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                      Username or Email
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500" />
                      <input
                        type="text"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Your username"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white placeholder-gray-500 focus:border-[#FF3030] focus:ring-2 focus:ring-[#FF3030]/20 outline-none text-xs transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white placeholder-gray-500 focus:border-[#FF3030] focus:ring-2 focus:ring-[#FF3030]/20 outline-none text-xs transition-all shadow-inner font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me */}
                  <div className="flex items-center space-x-2 pt-0.5">
                    <input
                      type="checkbox"
                      id="rememberMe"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#FF3030] focus:ring-[#FF3030] border-[#2A2A2A] bg-[#141414] cursor-pointer"
                    />
                    <label htmlFor="rememberMe" className="text-xs text-gray-400 select-none cursor-pointer font-medium">
                      Remember me
                    </label>
                  </div>

                  {/* Bold Red Primary Sign In Action Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#FF3030] hover:bg-[#E02424] text-white font-bold text-sm shadow-lg shadow-[#FF3030]/30 transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-[0.99]"
                  >
                    {isSubmitting ? (
                      <span>Authenticating...</span>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        <span>Sign in</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Direct Form: Sign Up / Register */
                <form onSubmit={handleSignUp} className="space-y-4 text-left">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500" />
                      <input
                        type="text"
                        id="register-name-input"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your Full Name"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white placeholder-gray-500 focus:border-[#FF3030] focus:ring-2 focus:ring-[#FF3030]/20 outline-none text-xs transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Username or Email */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                      Username or Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white placeholder-gray-500 focus:border-[#FF3030] focus:ring-2 focus:ring-[#FF3030]/20 outline-none text-xs transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white placeholder-gray-500 focus:border-[#FF3030] focus:ring-2 focus:ring-[#FF3030]/20 outline-none text-xs transition-all shadow-inner font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-300 uppercase tracking-wider block">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-500" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#141414] border border-[#2A2A2A] text-white placeholder-gray-500 focus:border-[#FF3030] focus:ring-2 focus:ring-[#FF3030]/20 outline-none text-xs transition-all shadow-inner font-mono"
                      />
                    </div>
                  </div>

                  {/* Bold Red Primary Register Action Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#FF3030] hover:bg-[#E02424] text-white font-bold text-sm shadow-lg shadow-[#FF3030]/30 transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-[0.99]"
                  >
                    {isSubmitting ? (
                      <span>Creating Account...</span>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Create Account</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Divider */}
              <div className="my-5 flex items-center space-x-3">
                <div className="flex-1 h-[1px] bg-[#2A2A2A]" />
                <span className="text-xs text-gray-500 font-medium">or</span>
                <div className="flex-1 h-[1px] bg-[#2A2A2A]" />
              </div>

              {/* Google Sign In Button */}
              {googleLoginStatus !== 'disabled' && (
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isSubmitting}
                  className="w-full py-3 px-4 rounded-xl border border-[#2A2A2A] bg-[#141414] hover:bg-[#202020] text-gray-200 font-semibold text-xs shadow-sm transition-all cursor-pointer flex items-center justify-center space-x-2.5 disabled:opacity-50 active:scale-[0.99]"
                >
                  {isGoogleLoading ? (
                    <span className="flex items-center space-x-2">
                      <div className="w-3.5 h-3.5 border-2 border-[#FF3030] border-t-transparent rounded-full animate-spin" />
                      <span>Connecting with Google...</span>
                    </span>
                  ) : (
                    <>
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                        />
                      </svg>
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>
              )}

              {/* Bottom Links */}
              <div className="mt-6 flex items-center justify-center space-x-2 text-xs font-semibold">
                {authMode === 'signin' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-[#FF5050] hover:text-[#FF3030] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                    <span className="text-gray-600">&middot;</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setLocalError(null);
                        clearAuthError();
                      }}
                      className="text-[#FF5050] hover:text-[#FF3030] hover:underline cursor-pointer"
                    >
                      Create account
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-gray-400">Already have an account?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setLocalError(null);
                        clearAuthError();
                      }}
                      className="text-[#FF5050] hover:text-[#FF3030] hover:underline cursor-pointer"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Trustpilot Review Badge: Dark theme */}
            <div className="flex flex-col items-center space-y-2 text-center w-full pt-1">
              <div className="flex items-center space-x-2 bg-[#1C1C1C] border border-[#2A2A2A] shadow-md px-3.5 py-1.5 rounded-xl">
                {/* 5 Green Trustpilot Stars */}
                <div className="flex items-center space-x-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <div key={star} className="w-4 h-4 bg-[#00b67a] flex items-center justify-center rounded-[2px]">
                      <Star className="w-2.5 h-2.5 text-white fill-white" />
                    </div>
                  ))}
                </div>
                <span className="font-bold text-white text-xs">4.8</span>
                <div className="flex items-center text-[#00b67a] text-[11px] font-bold">
                  <span>★ Trustpilot</span>
                </div>
              </div>

              <p className="text-xs text-gray-400 font-medium tracking-tight">
                Trusted by <span className="font-bold text-white">thousands of resellers</span> &nbsp;&middot;&nbsp; 
                <span className="font-bold text-white">2,487</span> services &nbsp;&middot;&nbsp; 
                <span className="font-bold text-white">24/7</span> support
              </p>
            </div>
          </motion.div>
        </div>
      </main>
      
      {/* 1. STATISTICS SECTION */}
      <LoginStatsSection
        stats={{
          ordersDelivered: publicSettings?.statsOrdersDelivered || '25,000',
          registeredUsers: publicSettings?.statsRegisteredUsers || '10,000',
          activeServices: publicSettings?.statsActiveServices || '2,487',
          ordersToday: publicSettings?.statsOrdersToday || '1,188',
        }}
      />

      {/* 2. AUTO-MOVING SOCIAL PLATFORMS MARQUEE */}
      <LoginPlatformMarquee />

      {/* 3. FAQ SECTION */}
      <LoginFaqSection />

      {/* 2. FOOTER */}
      <LoginFooter
        websiteName={websiteName}
        websiteLogo={websiteLogo}
        onOpenCategory={handleOpenServicesCategory}
        onOpenAboutUs={() => setShowAboutModal(true)}
        onOpenBlog={() => setShowBlogModal(true)}
        onOpenApi={() => setShowApiModal(true)}
        onOpenChildPanels={() => setShowChildPanelsModal(true)}
        onOpenAffiliates={() => setShowAffiliatesModal(true)}
        onOpenTerms={() => setShowTermsModal(true)}
        onOpenPrivacy={() => setShowPrivacyModal(true)}
        onOpenSupport={() => setShowSupportModal(true)}
        onOpenContact={() => setShowContactModal(true)}
        onScrollToFaq={handleScrollToFaq}
      />

      {/* Information & Policy Modals */}
      {(showAboutModal ||
        showBlogModal ||
        showApiModal ||
        showChildPanelsModal ||
        showAffiliatesModal ||
        showTermsModal ||
        showPrivacyModal ||
        showContactModal ||
        showSupportModal) && (
        <Suspense fallback={null}>
          <LoginModals
            showAboutModal={showAboutModal}
            setShowAboutModal={setShowAboutModal}
            showBlogModal={showBlogModal}
            setShowBlogModal={setShowBlogModal}
            showApiModal={showApiModal}
            setShowApiModal={setShowApiModal}
            showChildPanelsModal={showChildPanelsModal}
            setShowChildPanelsModal={setShowChildPanelsModal}
            showAffiliatesModal={showAffiliatesModal}
            setShowAffiliatesModal={setShowAffiliatesModal}
            showTermsModal={showTermsModal}
            setShowTermsModal={setShowTermsModal}
            showPrivacyModal={showPrivacyModal}
            setShowPrivacyModal={setShowPrivacyModal}
            showContactModal={showContactModal}
            setShowContactModal={setShowContactModal}
            showSupportModal={showSupportModal}
            setShowSupportModal={setShowSupportModal}
            websiteName={websiteName}
            customTerms={publicSettings?.termsOfService}
            customPrivacy={publicSettings?.privacyPolicy}
            onSelectAuthMode={handleSelectAuthModeFromModal}
          />
        </Suspense>
      )}

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForgotModal(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-2xl relative z-10 p-6 text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <h3 className="text-base font-bold text-gray-900">Reset your password</h3>
                <button
                  onClick={() => setShowForgotModal(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {forgotMessage ? (
                <div className="py-6 text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed font-medium">{forgotMessage}</p>
                  <button
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotMessage(null);
                    }}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                  >
                    Back to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} className="py-4 space-y-4">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Enter the email address registered with your account. We'll send you verification instructions.
                  </p>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-700 uppercase tracking-wider block">
                      Registered Email
                    </label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none text-xs transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 transition-all cursor-pointer"
                  >
                    Send Reset Link
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Interactive Services Inspection Modal */}
      <AnimatePresence>
        {showServicesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowServicesModal(false)}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-4xl bg-white border border-gray-100 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[85vh] z-10 text-left"
            >
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900 font-display">Services catalog</h3>
                  <p className="text-xs text-gray-500">Inspect the complete catalog of active social media marketing services.</p>
                </div>
                <button
                  onClick={() => setShowServicesModal(false)}
                  className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex flex-col md:flex-row gap-3 items-center">
                <div className="w-full md:flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search active services..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-red-500 transition-colors shadow-sm"
                  />
                </div>

                <div className="flex gap-1.5 overflow-x-auto max-w-full pb-1 no-scrollbar self-start md:self-center">
                  {categories.map((cat, idx) => (
                    <button
                      key={idx}
                      onClick={() => setFilterCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        filterCategory === cat
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-white hover:bg-gray-100 text-gray-600 border border-gray-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-gray-600 text-xs font-bold uppercase tracking-wider">
                        <th className="px-4 py-3">ID</th>
                        <th className="px-4 py-3">Service Name</th>
                        <th className="px-4 py-3 text-right">Price per 1k</th>
                        <th className="px-4 py-3 text-center">Min / Max</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {filteredServices.length > 0 ? (
                        filteredServices.map((srv) => (
                          <tr key={srv.id} className="hover:bg-gray-50/80 transition-colors">
                            <td className="px-4 py-3 text-gray-400 font-mono">#{srv.id}</td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-gray-900">{srv.name}</div>
                              {srv.description && (
                                <div className="text-[10px] text-gray-500 mt-0.5">{srv.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                              ${srv.pricePerThousand.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-500 font-mono">
                              {srv.minAmount} / {srv.maxAmount}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-12 text-gray-400 font-mono">
                            No matching services found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-between items-center text-xs">
                <div className="text-gray-500 flex items-center space-x-1">
                  <Users className="w-3.5 h-3.5 text-red-500" />
                  <span>Public Services Explorer</span>
                </div>
                <button
                  onClick={() => setShowServicesModal(false)}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all cursor-pointer shadow-sm"
                >
                  Close Catalog
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
