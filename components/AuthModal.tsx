import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  loginUser, registerUser, loginWithGoogle, loginWithTelegram,
  requestPasswordReset, updatePassword, finishPasswordRecovery,
  TelegramAuthUser,
} from '../services/storageService';
import { User } from '../types';
import { APP_NAME } from '../constants';
import TelegramLoginButton from './TelegramLoginButton';

type AuthView = 'login' | 'signup' | 'forgot' | 'reset';

interface AuthModalProps {
  onLogin: (user: User) => void;
  initialView?: AuthView;
  onBack?: () => void;
  // Called after a password-reset (recovery) flow completes, so the app can
  // leave recovery mode and strip the recovery token from the URL.
  onRecoveryComplete?: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onLogin, initialView = 'login', onBack, onRecoveryComplete }) => {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<AuthView>(initialView);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Client-side password policy for signup/reset: at least 8 chars, with a letter and a number.
  const isStrongPassword = (pw: string) => pw.length >= 8 && /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if ((view === 'signup' || view === 'reset') && !isStrongPassword(password)) {
      setError(t('passwordPolicy'));
      return;
    }
    if (view === 'reset' && password !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);

    try {
      if (view === 'login') {
        const user = await loginUser(email, password);
        onLogin(user);
      } else if (view === 'forgot') {
        await requestPasswordReset(email);
        // Neutral message either way — never reveal whether the email is registered.
        setSuccessMessage(t('resetLinkSent'));
      } else if (view === 'reset') {
        await updatePassword(password);
        // Drop the recovery session so the user signs in with the new password.
        await finishPasswordRecovery();
        onRecoveryComplete?.();
        setSuccessMessage(t('passwordResetSuccess'));
        setView('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        const { needsConfirmation } = await registerUser(name, email, phoneNumber, password);
        // Always return to the login screen — the user signs in with the
        // credentials they just created (no auto-login).
        setSuccessMessage(needsConfirmation ? t('confirmEmailSent') : t('accountCreatedLogin'));
        setView('login');
        setName('');
        setPhoneNumber('');
        setPassword('');
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication failed';
      if (/invalid login credentials/i.test(msg)) msg = t('invalidCredentials') || 'Invalid email or password.';
      else if (/already registered|already exists/i.test(msg)) msg = t('emailAlreadyRegistered') || 'Email already registered.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Move to a specific view, clearing any transient state/messages.
  const goToView = (next: AuthView) => {
    setView(next);
    setError('');
    setSuccessMessage('');
    setPassword('');
    setConfirmPassword('');
  };

  const isPasswordFlow = view === 'forgot' || view === 'reset';

  const headings: Record<AuthView, { title: string; subtitle: string }> = {
    login: { title: t('welcomeBack'), subtitle: t('loginSubtitle') },
    signup: { title: t('createAccount'), subtitle: t('signupSubtitle') },
    forgot: { title: t('forgotPasswordTitle'), subtitle: t('forgotPasswordSubtitle') },
    reset: { title: t('resetPasswordTitle'), subtitle: t('resetPasswordSubtitle') },
  };

  const submitLabel: Record<AuthView, string> = {
    login: t('login'),
    signup: t('signup'),
    forgot: t('sendResetLink'),
    reset: t('updatePasswordBtn'),
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      // Redirects the page to Google; the session is picked up on return.
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google Sign in failed');
      setIsLoading(false);
    }
  };

  const handleTelegramAuth = async (tgUser: TelegramAuthUser) => {
    setError('');
    setIsLoading(true);
    try {
      const user = await loginWithTelegram(tgUser);
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Telegram sign-in failed');
      setIsLoading(false);
    }
  };

  const switchView = () => {
    setView(view === 'login' ? 'signup' : 'login');
    setError('');
    setSuccessMessage('');
    setName('');
    setEmail('');
    setPhoneNumber('');
    setPassword('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Animated Background */}
      <div className="fixed inset-0 bg-[#0f172a]">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-900/20 rounded-full blur-[100px]"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-slate-800/20 rounded-full blur-[100px]"></div>
        </div>
      </div>

      <div className="flex min-h-full items-stretch justify-center p-0 text-center sm:items-center sm:p-0">
        {/* Mobile: full-screen, edge-to-edge (w-full, stretched height, no rounding).
            sm+ : a centered, rounded card with a max width. lg: two-panel split. */}
        <div className="relative transform overflow-hidden bg-white shadow-2xl transition-all w-full rounded-none sm:my-8 sm:w-full sm:max-w-4xl sm:rounded-3xl lg:flex">

          {/* Left Side - Branding Panel */}
          <div className="hidden lg:flex relative flex-col justify-between overflow-hidden bg-emerald-900 p-8 text-left lg:w-5/12">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl"></div>
            <div className="absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl"></div>

            <div className="relative z-10">
              <img src="/logo.png" alt="EthioLex Logo" className="mb-8 h-16 w-16 object-contain drop-shadow-lg" />
              <h1 className="mb-2 text-3xl font-bold text-white tracking-tight font-serif">{APP_NAME}</h1>
              <p className="text-emerald-100/80 text-sm leading-relaxed">{t('securityDesc')}</p>
            </div>

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

            <div className="absolute top-8 right-8 z-20">
              <div className="flex overflow-hidden rounded-full bg-black/20 p-1 backdrop-blur-sm">
                <button onClick={() => i18n.changeLanguage('en')} className={`rounded-full px-3 py-1 text-[10px] font-bold transition-all ${i18n.language === 'en' ? 'bg-white text-emerald-900 shadow-sm' : 'text-white/70 hover:text-white'}`}>EN</button>
                <button onClick={() => i18n.changeLanguage('am')} className={`rounded-full px-3 py-1 text-[10px] font-bold transition-all ${i18n.language === 'am' ? 'bg-white text-emerald-900 shadow-sm' : 'text-white/70 hover:text-white'}`}>አማ</button>
              </div>
            </div>
          </div>

          {/* Right Side - Form */}
          <div className="flex flex-1 flex-col justify-center bg-white lg:w-7/12">

            {/* Mobile Header */}
            <div className="lg:hidden flex items-center justify-between p-6 pb-0">
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="EthioLex Logo" className="h-12 w-12 object-contain" />
                <div>
                  <h1 className="text-xl font-bold text-slate-900 font-serif leading-none">{APP_NAME}</h1>
                  <p className="text-[10px] text-emerald-600 font-medium">Digital Lawyer</p>
                </div>
              </div>
              <div className="flex overflow-hidden rounded-full bg-slate-100 p-1">
                <button onClick={() => i18n.changeLanguage('en')} className={`rounded-full px-3 py-1 text-[10px] font-bold transition-all ${i18n.language === 'en' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>EN</button>
                <button onClick={() => i18n.changeLanguage('am')} className={`rounded-full px-3 py-1 text-[10px] font-bold transition-all ${i18n.language === 'am' ? 'bg-white text-emerald-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>አማ</button>
              </div>
            </div>

            {/* Header Area */}
            <div className="bg-slate-50 px-6 py-5 sm:px-8 border-b-0 sm:border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 sm:mt-0">
              <div>
                <h2 className="text-xl font-bold text-slate-800">
                  {headings[view].title}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {headings[view].subtitle}
                </p>
              </div>

              {!isPasswordFlow && (
                <div className="flex bg-slate-200/60 p-1 rounded-lg self-start sm:self-center shrink-0">
                  <button onClick={() => view !== 'login' && switchView()} className={`px-4 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${view === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('login')}</button>
                  <button onClick={() => view !== 'signup' && switchView()} className={`px-4 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${view === 'signup' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{t('signup')}</button>
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8">
              {!isPasswordFlow && (
                <>
                  {/* Social sign-in: Google + Telegram side by side (stacks on very
                      small screens). The Telegram widget is a fixed-width iframe, so
                      it takes its natural size while Google fills the rest. */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
                    <button onClick={handleGoogleLogin} disabled={isLoading} className="flex-1 flex items-center justify-center gap-2.5 h-11 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm disabled:opacity-60">
                      <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                      <span>{t('continueGoogle')}</span>
                    </button>

                    {/* Renders only when Telegram login is configured server-side. */}
                    <div className="shrink-0 flex justify-center">
                      <TelegramLoginButton onAuth={handleTelegramAuth} disabled={isLoading} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-px flex-1 bg-slate-200"></div>
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider">{t('orContinueWith') || 'or'}</span>
                    <div className="h-px flex-1 bg-slate-200"></div>
                  </div>
                </>
              )}

              {successMessage && (
                <div className="mb-5 p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3">
                  <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm font-medium text-emerald-800">{successMessage}</p>
                  <button aria-label="Close" onClick={() => setSuccessMessage('')} className="ml-auto flex-shrink-0 text-emerald-600 hover:text-emerald-800">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5">
                {view === 'signup' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{t('name')}</label>
                      <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" placeholder={t('fullNamePlaceholder')} disabled={isLoading} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{t('phoneNumber')} <span className="text-slate-400 normal-case">({t('optional')})</span></label>
                      <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" placeholder="09..." disabled={isLoading} />
                    </div>
                  </div>
                )}

                {view !== 'reset' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{t('email')}</label>
                    <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" placeholder={t('email')} disabled={isLoading} />
                  </div>
                )}

                {view !== 'forgot' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">{view === 'reset' ? t('newPassword') : t('password')}</label>
                      {view === 'login' && (
                        <button type="button" onClick={() => goToView('forgot')} className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 normal-case tracking-normal">{t('forgotPassword')}</button>
                      )}
                    </div>
                    <div className="relative">
                      <input type={showPassword ? "text" : "password"} required minLength={(view === 'signup' || view === 'reset') ? 8 : undefined} autoComplete={(view === 'signup' || view === 'reset') ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full h-10 px-3 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" placeholder="••••••••" disabled={isLoading} />
                      <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-600">
                        {showPassword ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                          : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>}
                      </button>
                    </div>
                    {(view === 'signup' || view === 'reset') && <p className="text-[11px] text-slate-400 mt-1">{t('passwordPolicy')}</p>}
                  </div>
                )}

                {view === 'reset' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">{t('confirmPassword')}</label>
                    <input type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all" placeholder="••••••••" disabled={isLoading} />
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-600 animate-fade-in">
                    <svg className="w-4 h-4 text-red-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={isLoading} className="w-full h-11 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-md shadow-emerald-200 transition-all hover:shadow-emerald-300 disabled:opacity-60 disabled:shadow-none text-sm tracking-wide">
                  {isLoading ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('processing')}</span> : submitLabel[view]}
                </button>

                {isPasswordFlow && (
                  <button type="button" onClick={() => goToView('login')} className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    {t('backToLogin')}
                  </button>
                )}
              </form>
            </div>

            <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
              {onBack && (
                <button onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-emerald-700 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  {t('backToHome')}
                </button>
              )}
              <p className="text-xs text-slate-500">© {new Date().getFullYear()} EthioLex. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
