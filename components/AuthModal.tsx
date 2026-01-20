import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loginUser, registerUser, loginWithGoogle, requestVerificationCode, verifyPhoneCode } from '../services/storageService';
import { User } from '../types';
import { APP_NAME } from '../constants';

interface AuthModalProps {
  onLogin: (user: User) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onLogin }) => {
  const { t, i18n } = useTranslation();
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
        user = await registerUser(name, email, phoneNumber, password);
        setPendingUser(user);
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-[#0f172a]">
        {/* Subtle Gradient Mesh */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-900/20 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-slate-800/20 rounded-full blur-[100px]"></div>
        </div>
      </div>

      {/* Main Container - Ensuring vertical center but allowing scroll if needed */}
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">

        {/* Card */}
        <div className="relative transform overflow-hidden rounded-3xl bg-white shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-4xl lg:flex">

          {/* Left Side - Branding Panel (Hidden on mobile) */}
          <div className="hidden lg:flex relative flex-col justify-between overflow-hidden bg-emerald-900 p-8 text-left lg:w-5/12">
            {/* Background Decor */}
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl"></div>
            <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl"></div>

            {/* Content */}
            <div className="relative z-10">
              <div className="mb-8 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
                <img src="/favicon.svg" alt="EthioLex Logo" className="h-9 w-9 object-contain drop-shadow-md" />
              </div>
              <h1 className="mb-2 text-3xl font-bold text-white tracking-tight font-serif">{APP_NAME}</h1>
              <p className="text-emerald-100/80 text-sm leading-relaxed">
                {t('securityDesc')}
              </p>
            </div>

            {/* Bottom Badges */}
            <div className="relative z-10 mt-8 space-y-3">
              <div className="flex items-center gap-3 text-emerald-100/90">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-800/50">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <span className="text-sm font-medium">{t('bankGradeSecurity')}</span>
              </div>
              <div className="flex items-center gap-3 text-emerald-100/90">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-800/50">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <span className="text-sm font-medium">{t('instantAnalysis')}</span>
              </div>
            </div>

            {/* Lang Toggle */}
            <div className="absolute top-8 right-8 z-20">
              <div className="flex overflow-hidden rounded-full bg-black/20 p-1 backdrop-blur-sm">
                <button onClick={() => i18n.changeLanguage('en')} className={`rounded-full px-3 py-1 text-[10px] font-bold transition-all ${i18n.language === 'en' ? 'bg-white text-emerald-900 shadow-sm' : 'text-white/70 hover:text-white'}`}>EN</button>
                <button onClick={() => i18n.changeLanguage('am')} className={`rounded-full px-3 py-1 text-[10px] font-bold transition-all ${i18n.language === 'am' ? 'bg-white text-emerald-900 shadow-sm' : 'text-white/70 hover:text-white'}`}>አማ</button>
              </div>
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="flex flex-1 flex-col justify-center bg-white lg:w-7/12">

            {/* Mobile Header (Only visible on mobile) */}
            <div className="lg:hidden flex items-center justify-between p-6 pb-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-900 text-white shadow-md">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v13M4 7h16M5 7v4c0 2.2 1.8 4 4 4s4-1.8 4-4V7M15 7v4c0 2.2 1.8 4 4 4s4-1.8 4-4V7M8 21h8M12 16l-3 5h6l-3-5" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 font-serif leading-none">{APP_NAME}</h1>
                  <p className="text-[10px] text-emerald-600 font-medium">Digital Lawyer</p>
                </div>
              </div>

              {/* Mobile Lang Toggle */}
              <div className="flex overflow-hidden rounded-full bg-slate-100 p-1">
                <button onClick={() => i18n.changeLanguage('en')} className={`rounded-full px-3 py-1 text-[10px] font-bold transition-all ${i18n.language === 'en' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>EN</button>
                <button onClick={() => i18n.changeLanguage('am')} className={`rounded-full px-3 py-1 text-[10px] font-bold transition-all ${i18n.language === 'am' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>አማ</button>
              </div>
            </div>

            {/* Compact Header Area */}
            <div className="bg-slate-50 px-6 py-5 sm:px-8 border-b-0 sm:border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 sm:mt-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {view === 'login' && t('welcomeBack')}
                  {view === 'signup' && t('createAccount')}
                  {view === 'verify' && t('verification')}
                  {view === 'collect-phone' && t('addPhone')}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {view === 'login' && t('loginSubtitle')}
                  {view === 'signup' && t('signupSubtitle')}
                  {view === 'verify' && t('codeSentTo', { phoneNumber })}
                  {view === 'collect-phone' && t('secureAccount')}
                </p>
              </div>

              {/* View Switcher (Only on login/signup) */}
              {(view === 'login' || view === 'signup') && (
                <div className="flex bg-slate-200/60 p-1 rounded-lg self-start sm:self-center shrink-0">
                  <button onClick={() => view !== 'login' && switchView()} className={`px-4 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${view === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('login')}</button>
                  <button onClick={() => view !== 'signup' && switchView()} className={`px-4 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${view === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('signup')}</button>
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8">
              {view === 'collect-phone' ? (
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  setError('');
                  setIsLoading(true);
                  try {
                    const result = await requestVerificationCode(phoneNumber);
                    if (result.dev_code) setDevCode(result.dev_code);
                    startResendTimer();
                    setView('verify');
                  } catch (err: any) {
                    setError(err.message || 'Failed to send code');
                  } finally {
                    setIsLoading(false);
                  }
                }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{t('phoneNumber')}</label>
                    <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" placeholder={t('phonePlaceholder')} disabled={isLoading} autoFocus />
                  </div>
                  {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">{error}</p>}
                  <button type="submit" disabled={isLoading || !phoneNumber.trim()} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 text-sm">{t('continue')}</button>
                  <button type="button" onClick={() => pendingUser && onLogin(pendingUser)} className="w-full text-xs text-slate-400 hover:text-slate-600 mt-2">{t('skip')}</button>
                </form>
              ) : view === 'verify' ? (
                <form onSubmit={handleVerifyCode} className="space-y-5 text-center">
                  {devCode && <div className="mb-4 inline-block px-3 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700 font-mono">Code: <b>{devCode}</b></div>}

                  <div className="flex gap-2 justify-center">
                    {[0, 1, 2, 3, 4, 5].map((idx) => (
                      <input key={idx} type="text" maxLength={1} value={verificationCode[idx] || ''} onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        const newCode = verificationCode.split('');
                        newCode[idx] = val;
                        setVerificationCode(newCode.join('').slice(0, 6));
                        if (val && idx < 5) ((e.target as HTMLInputElement).nextElementSibling as HTMLInputElement)?.focus();
                      }} onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !verificationCode[idx] && idx > 0) ((e.target as HTMLInputElement).previousElementSibling as HTMLInputElement)?.focus();
                      }} className="w-10 h-12 text-center text-lg font-bold bg-slate-50 border border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all" disabled={isLoading} autoFocus={idx === 0} />
                    ))}
                  </div>
                  {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">{error}</p>}
                  <button type="submit" disabled={isLoading || verificationCode.length !== 6} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 text-sm">{t('verifyAccount')}</button>
                  <div className="flex justify-between text-xs mt-2">
                    <button type="button" onClick={handleResendCode} disabled={resendTimer > 0} className="text-emerald-600 hover:text-emerald-700 font-medium disabled:text-slate-400">{resendTimer > 0 ? t('resendWait', { seconds: resendTimer }) : t('resendCode')}</button>
                    <button type="button" onClick={handleSkipVerification} className="text-slate-400 hover:text-slate-600">{t('skip')}</button>
                  </div>
                </form>
              ) : (
                <>
                  <button onClick={handleGoogleLogin} disabled={isLoading} className="w-full flex items-center justify-center gap-2.5 h-11 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all mb-5 shadow-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                    <span>{t('continueGoogle')}</span>
                  </button>

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    {view === 'signup' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{t('name')}</label>
                          <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" placeholder={t('fullNamePlaceholder')} disabled={isLoading} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{t('phoneNumber')}</label>
                          <input type="tel" required value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" placeholder={t('phonePlaceholder')} disabled={isLoading} />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{t('email')}</label>
                      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" placeholder={t('email')} disabled={isLoading} />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{t('password')}</label>
                      <div className="relative">
                        <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-10 px-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" placeholder="••••••••" disabled={isLoading} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600">
                          {showPassword ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                            : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-600 animate-fade-in">
                        <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                        <span>{error}</span>
                      </div>
                    )}

                    <button type="submit" disabled={isLoading} className="w-full h-11 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-md shadow-emerald-200 transition-all hover:shadow-emerald-300 disabled:opacity-60 disabled:shadow-none text-sm tracking-wide">
                      {isLoading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('processing')}</span> : (view === 'login' ? t('login') : t('signup'))}
                    </button>
                  </form>
                </>
              )}
            </div>

            {/* Footer area */}
            <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
              <p className="text-xs text-slate-500">© {new Date().getFullYear()} EthioLex. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
