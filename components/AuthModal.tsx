import React, { useState } from 'react';
import { loginUser, registerUser, loginWithGoogle, requestVerificationCode, verifyPhoneCode } from '../services/storageService';
import { User, Language } from '../types';
import { APP_NAME, UI_STRINGS } from '../constants';

interface AuthModalProps {
  onLogin: (user: User) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onLogin, language, onLanguageChange }) => {
  const [view, setView] = useState<'login' | 'signup' | 'verify' | 'collect-phone'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const t = UI_STRINGS[language];

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      let user;
      if (view === 'login') {
        user = await loginUser(email, password);
        onLogin(user);
      } else {
        // Registration - go to verification step
        user = await registerUser(name, email, phoneNumber, password);
        setPendingUser(user);

        // Request verification code
        const result = await requestVerificationCode(phoneNumber);
        if (result.dev_code) {
          setDevCode(result.dev_code);
        }
        startResendTimer();
        setView('verify');
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication failed';
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/user-not-found') || msg.includes('Incorrect email or password')) {
        msg = "Invalid email or password.";
      } else if (msg.includes('auth/email-already-in-use') || msg.includes('Email already registered')) {
        msg = "Email already registered.";
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await verifyPhoneCode(phoneNumber, verificationCode);
      if (pendingUser) {
        onLogin({ ...pendingUser, is_verified: true });
      }
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendTimer > 0) return;
    setError('');
    setIsLoading(true);
    try {
      await requestVerificationCode(phoneNumber);
      startResendTimer();
    } catch (err: any) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipVerification = () => {
    if (pendingUser) {
      onLogin(pendingUser);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const user = await loginWithGoogle();

      // Check if user needs to provide phone number
      if (user.needs_phone_number) {
        setPendingUser(user);
        setView('collect-phone');
      } else {
        onLogin(user);
      }
    } catch (err: any) {
      setError(err.message || 'Google Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const switchView = () => {
    setView(view === 'login' ? 'signup' : 'login');
    setError('');
    setName('');
    setEmail('');
    setPhoneNumber('');
    setPassword('');
    setVerificationCode('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900">
        {/* Floating orbs - hidden on mobile for performance */}
        <div className="hidden sm:block absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="hidden sm:block absolute bottom-1/4 right-1/4 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl"></div>
        <div className="hidden sm:block absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-3xl"></div>
      </div>

      {/* Main Card - Responsive width */}
      <div className="relative w-full max-w-[95%] sm:max-w-md md:max-w-lg animate-fade-in">
        <div className="relative bg-white/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden">

          {/* Ethiopian Stripe */}
          <div className="h-1 eth-flag-stripe"></div>

          {/* Header Section - Responsive padding */}
          <div className="px-5 sm:px-8 md:px-10 pt-6 sm:pt-8 md:pt-10 pb-4 sm:pb-6 text-center">
            {/* Language Toggle */}
            <div className="absolute top-4 sm:top-5 right-4 sm:right-5">
              <div className="flex bg-slate-100/80 p-0.5 sm:p-1 rounded-full">
                <button
                  onClick={() => onLanguageChange('en')}
                  className={`px-2.5 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-full transition-all duration-300 ${language === 'en'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  EN
                </button>
                <button
                  onClick={() => onLanguageChange('am')}
                  className={`px-2.5 sm:px-4 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium rounded-full transition-all duration-300 ${language === 'am'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  አማ
                </button>
              </div>
            </div>

            {/* Logo */}
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 mb-4 sm:mb-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/25">
              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 sm:w-7 sm:h-7" stroke="white" strokeWidth="1.5">
                <path d="M12 3v13M4 7h16M5 7v4c0 2.2 1.8 4 4 4s4-1.8 4-4V7M15 7v4c0 2.2 1.8 4 4 4s4-1.8 4-4V7M8 21h8M12 16l-3 5h6l-3-5" />
              </svg>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
              {APP_NAME}
            </h1>
            <p className="text-slate-500 text-xs sm:text-sm">{t.authSubtitle}</p>
          </div>

          {/* Form Section - Responsive padding */}
          <div className="px-5 sm:px-8 md:px-10 pb-6 sm:pb-8 md:pb-10">

            {/* Phone Collection View (for Google users) */}
            {view === 'collect-phone' ? (
              <div className="animate-fade-in">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-emerald-100">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mb-1">Add Your Phone Number</h2>
                  <p className="text-sm text-slate-500">Please provide your phone number to complete registration</p>
                </div>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setError('');
                  setIsLoading(true);
                  try {
                    const result = await requestVerificationCode(phoneNumber);
                    if (result.dev_code) {
                      setDevCode(result.dev_code);
                    }
                    startResendTimer();
                    setView('verify');
                  } catch (err: any) {
                    setError(err.message || 'Failed to send verification code');
                  } finally {
                    setIsLoading(false);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Phone Number</label>
                    <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm" placeholder="+251 9XX XXX XXX" disabled={isLoading} autoFocus />
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                      <span className="text-sm text-red-700">{error}</span>
                    </div>
                  )}
                  <button type="submit" disabled={isLoading || !phoneNumber.trim()} className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoading ? 'Sending Code...' : 'Continue & Verify'}
                  </button>
                  <button type="button" onClick={() => pendingUser && onLogin(pendingUser)} className="w-full py-2 text-sm text-slate-500 hover:text-slate-700">Skip for now</button>
                </form>
              </div>
            ) : view === 'verify' ? (
              <div className="animate-fade-in">
                <div className="text-center mb-6">
                  <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-full bg-emerald-100">
                    <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mb-1">Verify Your Phone</h2>
                  <p className="text-sm text-slate-500">We sent a verification code to</p>
                  <p className="text-sm font-semibold text-emerald-600">{phoneNumber}</p>

                  {/* Dev Mode Code Display */}
                  {devCode && (
                    <div className="mt-4 p-3 bg-amber-50 border-2 border-amber-200 rounded-xl">
                      <p className="text-xs text-amber-600 font-medium mb-1">🔧 Development Mode</p>
                      <p className="text-2xl font-bold text-amber-700 tracking-widest">{devCode}</p>
                    </div>
                  )}
                </div>

                <form onSubmit={handleVerifyCode} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-600 mb-2">Verification Code</label>
                    <input
                      type="text"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full text-center text-2xl tracking-[0.5em] font-bold py-4 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                      placeholder="000000"
                      maxLength={6}
                      disabled={isLoading}
                      autoFocus
                    />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-red-700">{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading || verificationCode.length !== 6}
                    className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Verifying...' : 'Verify Phone Number'}
                  </button>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendTimer > 0 || isLoading}
                      className="text-emerald-600 hover:text-emerald-700 font-medium disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend Code'}
                    </button>
                    <button
                      type="button"
                      onClick={handleSkipVerification}
                      className="text-slate-500 hover:text-slate-700"
                    >
                      Skip for now
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                {/* View Toggle Tabs */}
                <div className="flex mb-5 sm:mb-8 bg-slate-100/70 p-1 rounded-full">
                  <button
                    onClick={() => view !== 'login' && switchView()}
                    className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-medium rounded-full transition-all duration-300 ${view === 'login'
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    {t.login}
                  </button>
                  <button
                    onClick={() => view !== 'signup' && switchView()}
                    className={`flex-1 py-2.5 sm:py-3 text-xs sm:text-sm font-medium rounded-full transition-all duration-300 ${view === 'signup'
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    {t.signup}
                  </button>
                </div>

                {/* Google Sign In */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 sm:gap-3 py-3 sm:py-3.5 px-4 sm:px-6 bg-white border-2 border-slate-200 rounded-xl sm:rounded-2xl font-medium text-sm text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-300 shadow-sm"
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span className="text-xs sm:text-sm">{t.signInGoogle}</span>
                </button>

                {/* Divider */}
                <div className="relative flex items-center my-4 sm:my-6">
                  <div className="flex-1 h-px bg-slate-200"></div>
                  <span className="px-3 sm:px-4 text-[10px] sm:text-xs font-medium text-slate-400 uppercase">or</span>
                  <div className="flex-1 h-px bg-slate-200"></div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5">
                  {view === 'signup' && (
                    <>
                      {/* Name Field */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1.5 sm:mb-2">{t.name}</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-slate-50 border-2 border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all duration-300 text-sm text-slate-800"
                            placeholder={t.name}
                            disabled={isLoading}
                          />
                        </div>
                      </div>

                      {/* Phone Field */}
                      <div>
                        <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1.5 sm:mb-2">{t.phoneNumber}</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          </div>
                          <input
                            type="tel"
                            required
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-slate-50 border-2 border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all duration-300 text-sm text-slate-800"
                            placeholder="+251 9XX XXX XXX"
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Email Field */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1.5 sm:mb-2">{t.email}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 sm:pl-12 pr-4 py-3 sm:py-3.5 bg-slate-50 border-2 border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all duration-300 text-sm text-slate-800"
                        placeholder="you@example.com"
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-slate-600 mb-1.5 sm:mb-2">{t.password}</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 sm:pl-4 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-3.5 bg-slate-50 border-2 border-slate-200 rounded-lg sm:rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all duration-300 text-sm text-slate-800"
                        placeholder="••••••••"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 sm:pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPassword ? (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-red-50 border border-red-100 rounded-lg sm:rounded-xl animate-fade-in">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-xs sm:text-sm text-red-700">{error}</span>
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 sm:py-4 px-6 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-sm sm:text-base font-semibold rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <span>{view === 'login' ? t.login : t.signup}</span>
                    )}
                  </button>
                </form>

                {/* Footer Link */}
                <p className="mt-5 sm:mt-8 text-center text-xs sm:text-sm text-slate-500">
                  {view === 'login' ? t.noAccount : t.hasAccount}
                  <button
                    onClick={switchView}
                    className="font-semibold text-emerald-600 hover:text-emerald-700 ml-1 transition-colors"
                  >
                    {view === 'login' ? t.signup : t.login}
                  </button>
                </p>
              </>
            )}
          </div>

          {/* Copyright */}
          <p className="text-center text-[10px] sm:text-xs text-white/40 mt-4 sm:mt-6">
            © {new Date().getFullYear()} EthioLex. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
