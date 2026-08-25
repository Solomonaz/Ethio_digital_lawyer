import React from 'react';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '../constants';

interface LandingPageProps {
    onGetStarted: () => void;
    onLogin: () => void;
}

// Brand logo mark used across the app.
const Logo: React.FC<{ className?: string }> = ({ className }) => (
    <img src="/logo.png" alt="Logo" className={`object-contain ${className || ''}`} />
);

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
    const { t, i18n } = useTranslation();

    const features = [
        {
            key: 'Grounded',
            path: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
        },
        {
            key: 'Bilingual',
            path: 'M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129',
        },
        {
            key: 'Citations',
            path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        },
        {
            key: 'Docs',
            path: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
        },
        {
            key: 'Instant',
            path: 'M13 10V3L4 14h7v7l9-11h-7z',
        },
        {
            key: 'Secure',
            path: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
        },
    ];

    const steps = ['1', '2', '3'];

    return (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-white text-slate-800">
            {/* Nav */}
            <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100">
                <div className="absolute bottom-0 inset-x-0 h-0.5 eth-flag-stripe" />
                <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <Logo className="w-10 h-10" />
                        <span className="text-lg font-bold text-slate-900" style={{ fontFamily: "'Playfair Display', serif" }}>{APP_NAME}</span>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button onClick={() => i18n.changeLanguage('en')} className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${i18n.language === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>EN</button>
                            <button onClick={() => i18n.changeLanguage('am')} className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${i18n.language === 'am' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>አማ</button>
                        </div>
                        <button onClick={onLogin} className="hidden sm:inline-flex px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">{t('login')}</button>
                        <button onClick={onGetStarted} className="px-4 py-2 text-sm font-bold text-white rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/25 transition-all">{t('lpGetStarted')}</button>
                    </div>
                </div>
            </nav>

            {/* Hero */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 pattern-grid opacity-60 pointer-events-none" />
                <div className="absolute -top-24 -right-24 w-[420px] h-[420px] bg-emerald-400/20 rounded-full blur-[110px] pointer-events-none" />
                <div className="absolute -bottom-32 -left-24 w-[420px] h-[420px] bg-amber-300/10 rounded-full blur-[110px] pointer-events-none" />

                <div className="relative max-w-6xl mx-auto px-5 pt-14 pb-20 grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
                    {/* Left copy */}
                    <div className="text-center lg:text-left animate-fade-in">
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold mb-6">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {t('lpHeroBadge')}
                        </span>
                        <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 leading-[1.1] tracking-tight" style={{ fontFamily: "'Playfair Display', 'Noto Sans Ethiopic', serif" }}>
                            {t('lpHeroTitle')}
                        </h1>
                        <p className="mt-5 text-base sm:text-lg text-slate-500 leading-relaxed max-w-xl mx-auto lg:mx-0">
                            {t('lpHeroSubtitle')}
                        </p>
                        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                            <button onClick={onGetStarted} className="px-7 py-3.5 rounded-2xl font-bold text-white bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 shadow-lg shadow-emerald-500/30 transition-all text-base">
                                {t('lpStartFree')}
                            </button>
                            <button onClick={onLogin} className="px-7 py-3.5 rounded-2xl font-semibold text-slate-700 bg-white border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-base">
                                {t('login')}
                            </button>
                        </div>
                        {/* Trust row */}
                        <div className="mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs font-medium text-slate-500">
                            {[t('lpTrustBilingual'), t('legalSources'), t('lpTrustSecure')].map((label, i) => (
                                <span key={i} className="inline-flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    {label}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Right: product preview */}
                    <div className="relative animate-scale-in">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-amber-400/10 rounded-[2rem] blur-2xl" />
                        <div className="relative bg-white rounded-3xl border border-slate-100 shadow-premium overflow-hidden">
                            {/* window bar */}
                            <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                                <span className="ml-2 text-[11px] font-semibold text-slate-400">{APP_NAME}</span>
                            </div>
                            <div className="p-5 space-y-4">
                                {/* user bubble */}
                                <div className="flex justify-end">
                                    <div className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm bg-gradient-to-br from-emerald-600 to-emerald-500 text-white text-sm shadow-md shadow-emerald-500/20">
                                        {t('lpPreviewQ')}
                                    </div>
                                </div>
                                {/* bot bubble */}
                                <div className="flex justify-start gap-2.5">
                                    <span className="flex-shrink-0 w-8 h-8 rounded-xl overflow-hidden flex flex-col shadow-sm">
                                        <span className="flex-1 bg-emerald-500" />
                                        <span className="flex-1 bg-amber-400" />
                                        <span className="flex-1 bg-red-500" />
                                    </span>
                                    <div className="max-w-[85%] space-y-2.5">
                                        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white border border-slate-100 text-slate-600 text-sm leading-relaxed shadow-sm">
                                            {t('lpPreviewA')}
                                        </div>
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-[11px] font-semibold">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {t('lpPreviewSource')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="bg-slate-50/70 border-y border-slate-100 py-20">
                <div className="max-w-6xl mx-auto px-5">
                    <div className="text-center max-w-2xl mx-auto mb-14">
                        <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight" style={{ fontFamily: "'Playfair Display', 'Noto Sans Ethiopic', serif" }}>
                            {t('lpFeaturesTitle')}
                        </h2>
                        <p className="mt-4 text-slate-500 text-base">{t('lpFeaturesSubtitle')}</p>
                    </div>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {features.map(f => (
                            <div key={f.key} className="group bg-white rounded-2xl border border-slate-100 p-6 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5 transition-all">
                                <div className="w-12 h-12 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center text-emerald-600 mb-4 transition-colors">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d={f.path} /></svg>
                                </div>
                                <h3 className="text-base font-bold text-slate-900 mb-1.5">{t(`lpFeat${f.key}Title`)}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{t(`lpFeat${f.key}Desc`)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section className="py-20">
                <div className="max-w-5xl mx-auto px-5">
                    <h2 className="text-center text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mb-14" style={{ fontFamily: "'Playfair Display', 'Noto Sans Ethiopic', serif" }}>
                        {t('lpHowTitle')}
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8 md:gap-6">
                        {steps.map((n, i) => (
                            <div key={n} className="relative text-center md:text-left">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-500 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
                                    {n}
                                </div>
                                {i < steps.length - 1 && (
                                    <div className="hidden md:block absolute top-6 left-16 right-0 h-px bg-gradient-to-r from-emerald-200 to-transparent" />
                                )}
                                <h3 className="text-lg font-bold text-slate-900 mb-1.5">{t(`lpStep${n}Title`)}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{t(`lpStep${n}Desc`)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA band */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900">
                <div className="absolute top-0 inset-x-0 h-1 eth-flag-stripe" />
                <div className="absolute -top-16 right-1/4 w-72 h-72 bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="relative max-w-3xl mx-auto px-5 py-20 text-center">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight" style={{ fontFamily: "'Playfair Display', 'Noto Sans Ethiopic', serif" }}>
                        {t('lpCtaTitle')}
                    </h2>
                    <p className="mt-4 text-emerald-100/70 text-base max-w-lg mx-auto">{t('lpCtaSubtitle')}</p>
                    <button onClick={onGetStarted} className="mt-8 px-8 py-3.5 rounded-2xl font-bold text-emerald-900 bg-white hover:bg-emerald-50 shadow-xl transition-all text-base">
                        {t('lpStartFree')}
                    </button>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400">
                <div className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2.5">
                        <Logo className="w-10 h-10" />
                        <div>
                            <div className="text-white font-bold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>{APP_NAME}</div>
                            <div className="text-[11px] text-slate-500">{t('appTagline')}</div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 text-center sm:text-right max-w-md leading-relaxed">
                        {t('lpFooterDisclaimer')}
                        <br />
                        <span className="text-slate-600">© {new Date().getFullYear()} {APP_NAME}. {t('lpFooterRights')}</span>
                    </p>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
