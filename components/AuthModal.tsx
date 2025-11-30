
import React, { useState } from 'react';
import { loginUser, registerUser, loginWithGoogle } from '../services/storageService';
import { User, Language } from '../types';
import { APP_NAME, UI_STRINGS } from '../constants';

interface AuthModalProps {
  onLogin: (user: User) => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ onLogin, language, onLanguageChange }) => {
  const [view, setView] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const t = UI_STRINGS[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      let user;
      if (view === 'login') {
        user = await loginUser(username, password);
      } else {
        user = await registerUser(username, password);
      }
      onLogin(user);
    } catch (err: any) {
      // Improve Firebase error messages
      let msg = err.message || 'Authentication failed';
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/user-not-found')) {
        msg = "Invalid username or password.";
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = "Username already taken.";
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setIsLoading(true);
    try {
      const user = await loginWithGoogle();
      onLogin(user);
    } catch (err: any) {
      setError(err.message || 'Google Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900 bg-opacity-90 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 p-6 text-center relative overflow-hidden">
           <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-600 via-yellow-400 to-red-600"></div>
           
           {/* Language Toggle */}
           <div className="absolute top-4 right-4 z-10">
              <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700">
                  <button onClick={() => onLanguageChange('en')} className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${language === 'en' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>EN</button>
                  <button onClick={() => onLanguageChange('am')} className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-all ${language === 'am' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}>አማ</button>
              </div>
           </div>

           <h2 className="text-2xl font-serif font-bold text-white mb-1 mt-2">{APP_NAME}</h2>
           <p className="text-slate-400 text-xs">{t.authSubtitle}</p>
        </div>

        <div className="p-8">
          <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">
            {view === 'login' ? t.welcomeBack : t.createAccount}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors shadow-sm mb-4"
            >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span className="font-medium text-sm">{t.signInGoogle}</span>
            </button>

            <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 text-xs">OR</span>
                <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.username}</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                placeholder={t.username}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t.password}</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition-all"
                placeholder={t.password}
                disabled={isLoading}
              />
            </div>

            {error && (
              <p className="text-red-600 text-xs text-center bg-red-50 p-2 rounded">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg shadow-md transition-colors flex items-center justify-center disabled:opacity-70"
            >
              {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                  view === 'login' ? t.login : t.signup
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500">
              {view === 'login' ? t.noAccount : t.hasAccount}
              <button
                onClick={() => {
                    setView(view === 'login' ? 'signup' : 'login');
                    setError('');
                }}
                className="font-medium text-green-700 hover:text-green-800"
              >
                {view === 'login' ? t.signup : t.login}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
