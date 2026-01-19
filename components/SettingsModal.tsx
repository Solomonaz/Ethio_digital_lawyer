import React, { useState } from 'react';
import { Language, User } from '../types';
import { UI_STRINGS } from '../constants';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    language: Language;
    onLanguageChange: (lang: Language) => void;
    onAddFunds: () => void;
    onLogout: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    user,
    language,
    onLanguageChange,
    onAddFunds,
    onLogout
}) => {
    const [activeTab, setActiveTab] = useState<'account' | 'billing' | 'preferences'>('account');
    const t = UI_STRINGS[language];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
                {/* Ethiopian Stripe */}
                <div className="h-1 eth-flag-stripe"></div>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">{t.settings}</h2>
                            <p className="text-sm text-slate-500">Manage your account and preferences</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 px-6">
                    {[
                        { id: 'account', label: 'Account', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
                        { id: 'billing', label: 'Billing', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
                        { id: 'preferences', label: 'Preferences', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${activeTab === tab.id
                                ? 'border-emerald-500 text-emerald-600'
                                : 'border-transparent text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={tab.icon} />
                            </svg>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[60vh]">
                    {/* Account Tab */}
                    {activeTab === 'account' && user && (
                        <div className="space-y-6">
                            {/* Profile Section */}
                            <div className="p-5 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200">
                                <div className="flex items-center gap-4">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-emerald-500/25">
                                            {user.username?.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-3 border-white rounded-full flex items-center justify-center">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold text-slate-900">{user.username}</h3>
                                        <p className="text-sm text-slate-500">{user.email || 'No email set'}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                                                {user.authProvider === 'google' ? 'Google Account' : 'Email Account'}
                                            </span>
                                            {user.is_admin && (
                                                <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">
                                                    Admin
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Account Info */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Account Information</h4>
                                <div className="grid gap-4">
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">Username</p>
                                                <p className="text-sm text-slate-500">{user.username}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                                <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-900">Member Since</p>
                                                <p className="text-sm text-slate-500">{user.createdAt?.toLocaleDateString() || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Logout Button */}
                            <button
                                onClick={onLogout}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-all"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                {t.logout}
                            </button>
                        </div>
                    )}

                    {/* Billing Tab */}
                    {activeTab === 'billing' && user && (
                        <div className="space-y-6">
                            {/* Balance Card */}
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-xl shadow-emerald-500/25">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-sm font-medium text-emerald-100 uppercase tracking-wider">{t.balance}</span>
                                    <div className="w-3 h-3 rounded-full bg-white/30 animate-pulse"></div>
                                </div>
                                <div className="flex items-baseline gap-2 mb-6">
                                    <span className="text-4xl font-bold">{user.balance?.toLocaleString() || '0'}</span>
                                    <span className="text-lg text-emerald-100">ETB</span>
                                </div>
                                <button
                                    onClick={() => {
                                        onAddFunds();
                                        onClose();
                                    }}
                                    className="w-full py-3 px-4 rounded-xl bg-white text-emerald-600 font-semibold hover:bg-emerald-50 transition-all shadow-lg"
                                >
                                    + {t.addFunds}
                                </button>
                            </div>

                            {/* Pricing Info */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Pricing</h4>
                                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-amber-800">100 ETB per query</p>
                                            <p className="text-sm text-amber-700 mt-1">Each legal consultation message costs 100 Ethiopian Birr. Make sure you have sufficient balance before asking questions.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Quick Add Options */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Quick Add</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { amount: 500, queries: 5 },
                                        { amount: 1000, queries: 10 },
                                        { amount: 2000, queries: 20 }
                                    ].map((option) => (
                                        <button
                                            key={option.amount}
                                            onClick={() => {
                                                onAddFunds();
                                                onClose();
                                            }}
                                            className="p-4 rounded-xl bg-white border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 transition-all text-center group"
                                        >
                                            <p className="text-lg font-bold text-slate-900 group-hover:text-emerald-600">{option.amount}</p>
                                            <p className="text-xs text-slate-500">ETB</p>
                                            <p className="text-[10px] text-emerald-600 mt-1">{option.queries} queries</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Preferences Tab */}
                    {activeTab === 'preferences' && (
                        <div className="space-y-6">
                            {/* Language */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">{t.language}</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => onLanguageChange('en')}
                                        className={`p-4 rounded-xl border-2 transition-all ${language === 'en'
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">🇺🇸</span>
                                            <div className="text-left">
                                                <p className={`text-sm font-medium ${language === 'en' ? 'text-emerald-700' : 'text-slate-900'}`}>English</p>
                                                <p className="text-xs text-slate-500">English</p>
                                            </div>
                                        </div>
                                        {language === 'en' && (
                                            <div className="flex justify-end mt-2">
                                                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => onLanguageChange('am')}
                                        className={`p-4 rounded-xl border-2 transition-all ${language === 'am'
                                            ? 'border-emerald-500 bg-emerald-50'
                                            : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">🇪🇹</span>
                                            <div className="text-left">
                                                <p className={`text-sm font-medium ${language === 'am' ? 'text-emerald-700' : 'text-slate-900'}`}>አማርኛ</p>
                                                <p className="text-xs text-slate-500">Amharic</p>
                                            </div>
                                        </div>
                                        {language === 'am' && (
                                            <div className="flex justify-end mt-2">
                                                <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* About */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">About</h4>
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                                            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="white" strokeWidth="1.5">
                                                <path d="M12 3v13M4 7h16M5 7v4c0 2.2 1.8 4 4 4s4-1.8 4-4V7M15 7v4c0 2.2 1.8 4 4 4s4-1.8 4-4V7M8 21h8M12 16l-3 5h6l-3-5" />
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">EthioLex</p>
                                            <p className="text-xs text-slate-500">Version 1.0.0</p>
                                        </div>
                                    </div>
                                    <p className="text-sm text-slate-600">
                                        Your AI-powered Ethiopian legal assistant. Get expert guidance on Ethiopian law, legal procedures, and regulations.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
