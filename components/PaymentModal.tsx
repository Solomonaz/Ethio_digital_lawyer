import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, userEmail }) => {
    const { t } = useTranslation();
    const [amount, setAmount] = useState('50');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<'recharge' | 'subscription'>('recharge');
    const [subPrice, setSubPrice] = useState('100'); // Default fall back
    const [agreedToFairUsage, setAgreedToFairUsage] = useState(false); // Fair usage policy agreement

    // Fetch subscription price on mount
    React.useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('http://127.0.0.1:8000/settings/public'); // Public endpoint
                if (res.ok) {
                    const data = await res.json();
                    const price = data.find((s: any) => s.key === 'subscription_24h_price');
                    if (price) setSubPrice(price.value);
                }
            } catch (e) {
                console.error("Failed to fetch settings", e);
            }
        };
        if (isOpen) fetchSettings();
    }, [isOpen]);

    if (!isOpen) return null;

    const handlePayment = async () => {
        setError('');
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const finalAmount = mode === 'subscription' ? subPrice : amount;

            const response = await fetch('http://127.0.0.1:8000/payment/initialize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    amount: finalAmount,
                    email: userEmail,
                    first_name: "EthioLex",
                    last_name: "User",
                    payment_type: mode === 'subscription' ? 'subscription_24h' : 'recharge'
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.detail || 'Payment failed');
            }

            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            }
        } catch (err: any) {
            setError(err.message || 'Error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const quickAmounts = [
        { value: '50', label: '50', queries: 'ብር' },
        { value: '100', label: '100', queries: 'ብር' },
        { value: '200', label: '200', queries: 'ብር' },
        { value: '500', label: '500', queries: 'ብር' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">

                {/* Header */}
                <div className={`relative p-6 transition-colors duration-500 ${mode === 'subscription' ? 'bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900' : 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900'}`}>
                    {/* Ethiopian Stripe */}
                    <div className="absolute top-0 left-0 right-0 h-1 eth-flag-stripe"></div>

                    {/* Decorative orbs */}
                    <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 ${mode === 'subscription' ? 'bg-purple-500' : 'bg-emerald-500'}`}></div>
                    <div className={`absolute bottom-0 left-0 w-24 h-24 rounded-full blur-2xl opacity-15 ${mode === 'subscription' ? 'bg-pink-500' : 'bg-amber-500'}`}></div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/20 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="relative">
                        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg mb-4 ${mode === 'subscription' ? 'bg-gradient-to-br from-purple-400 to-indigo-500 shadow-indigo-500/30' : 'bg-gradient-to-br from-amber-400 to-amber-500 shadow-amber-500/30'}`}>
                            {mode === 'subscription' ? (
                                <span className="text-2xl">♾️</span>
                            ) : (
                                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            )}
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {mode === 'subscription' ? '24-Hour Pass' : t('addFunds')}
                        </h2>
                        <p className="text-white/60 text-sm">{mode === 'subscription' ? 'Unlimited access for 24 hours' : t('rechargeParams')}</p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Mode Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
                        <button
                            onClick={() => setMode('recharge')}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'recharge' ? 'bg-white text-emerald-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Pay-as-you-go
                        </button>
                        <button
                            onClick={() => { setMode('subscription'); setAgreedToFairUsage(false); }}
                            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'subscription' ? 'bg-white text-indigo-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            {t('24hPass')}
                        </button>
                    </div>

                    {mode === 'recharge' ? (
                        <>
                            {/* Amount Input */}
                            <div className="mb-5">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('amountETB')}</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">ETB</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-14 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 text-2xl font-bold text-slate-900 transition-all outline-none"
                                        placeholder="50"
                                        min="5"
                                    />
                                </div>
                            </div>

                            {/* Quick Amounts */}
                            <div className="grid grid-cols-4 gap-2 mb-5">
                                {quickAmounts.map((item) => (
                                    <button
                                        key={item.value}
                                        onClick={() => setAmount(item.value)}
                                        className={`relative py-3 rounded-xl text-center transition-all ${amount === item.value
                                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        <span className="text-sm font-bold">{item.label}</span>
                                        <span className={`block text-[9px] mt-0.5 ${amount === item.value ? 'text-emerald-100' : 'text-slate-400'}`}>
                                            {item.queries}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="mb-4 animate-fade-in">
                            {/* Premium Price Card */}
                            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-2xl p-4 text-white shadow-xl shadow-indigo-500/25 overflow-hidden relative">
                                {/* Background glow */}
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.15),transparent_50%)]"></div>

                                <div className="relative flex items-center justify-between">
                                    {/* Left: Price */}
                                    <div>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-4xl font-black">{subPrice}</span>
                                            <span className="text-lg font-medium text-white/70">ETB</span>
                                        </div>
                                        <p className="text-white/60 text-xs mt-0.5">one-time • 24 hours</p>
                                    </div>

                                    {/* Right: Features */}
                                    <div className="text-right space-y-1">
                                        <div className="flex items-center justify-end gap-1.5 text-xs text-white/90">
                                            <span>Unlimited questions</span>
                                            <svg className="w-3.5 h-3.5 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div className="flex items-center justify-end gap-1.5 text-xs text-white/90">
                                            <span>No token deduction</span>
                                            <svg className="w-3.5 h-3.5 text-emerald-300" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Checkbox with inline fair usage */}
                            <label className="flex items-start gap-3 cursor-pointer group mt-4">
                                <div className="relative flex-shrink-0 mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={agreedToFairUsage}
                                        onChange={(e) => setAgreedToFairUsage(e.target.checked)}
                                        className="w-4.5 h-4.5 rounded border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-2 focus:ring-offset-0 cursor-pointer appearance-none checked:bg-indigo-600 checked:border-indigo-600 transition-all"
                                        style={{ width: '18px', height: '18px' }}
                                    />
                                    {agreedToFairUsage && (
                                        <svg className="absolute inset-0 text-white pointer-events-none p-0.5" style={{ width: '18px', height: '18px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-xs text-slate-500 leading-relaxed">
                                    {t('fairUsageAgree')} <span className="text-amber-600">•</span> <span className="text-slate-400">Subject to daily question limits</span>
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 flex items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-xl animate-slide-up">
                            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                                <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <span className="text-sm text-red-700">{error}</span>
                        </div>
                    )}

                    <button
                        onClick={handlePayment}
                        disabled={isLoading || (mode === 'recharge' && Number(amount) < 5) || (mode === 'subscription' && !agreedToFairUsage)}
                        className={`w-full py-4 rounded-2xl font-bold text-base shadow-lg transition-all transform active:scale-[0.98] ${isLoading || (mode === 'recharge' && Number(amount) < 5) || (mode === 'subscription' && !agreedToFairUsage)
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : mode === 'subscription'
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5'
                                : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:-translate-y-0.5'
                            }`}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                {t('processing')}
                            </div>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                {mode === 'subscription' ? t('activate24hPass', { price: subPrice }) : t('payWithChapa', { amount })}
                            </span>
                        )}
                    </button>

                    {/* Security Badge */}
                    <div className="mt-5 flex items-center justify-center gap-2">
                        <svg className={`w-4 h-4 ${mode === 'subscription' ? 'text-indigo-400' : 'text-emerald-500'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{t('securedByChapa')}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
