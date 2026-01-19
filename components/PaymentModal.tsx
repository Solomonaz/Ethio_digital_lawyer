import React, { useState } from 'react';
import { Language } from '../types';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    language: Language;
    userEmail: string;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, language, userEmail }) => {
    const [amount, setAmount] = useState('50');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handlePayment = async () => {
        setError('');
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://127.0.0.1:8000/payment/initialize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    amount: amount,
                    email: userEmail,
                    first_name: "EthioLex",
                    last_name: "User"
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
        { value: '50', label: '50', queries: '~1-2' },
        { value: '100', label: '100', queries: '~3-4' },
        { value: '200', label: '200', queries: '~6-7' },
        { value: '500', label: '500', queries: '~16+' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">

                {/* Header */}
                <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6">
                    {/* Ethiopian Stripe */}
                    <div className="absolute top-0 left-0 right-0 h-1 eth-flag-stripe"></div>

                    {/* Decorative orbs */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-amber-500/15 rounded-full blur-2xl"></div>

                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="relative">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 shadow-lg shadow-amber-500/30 mb-4">
                            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                            Add Funds
                        </h2>
                        <p className="text-white/60 text-sm">Recharge your account to continue consulting</p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    {/* Amount Input */}
                    <div className="mb-5">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Amount (ETB)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">ETB</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full pl-14 pr-4 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 text-2xl font-bold text-slate-900 transition-all outline-none"
                                placeholder="50"
                                min="30"
                            />
                        </div>
                        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            Minimum recharge: 30 ETB (~1 consultation)
                        </p>
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
                                    {item.queries} queries
                                </span>
                            </button>
                        ))}
                    </div>

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

                    {/* Pay Button */}
                    <button
                        onClick={handlePayment}
                        disabled={isLoading || Number(amount) < 30}
                        className={`w-full py-4 rounded-2xl font-bold text-base shadow-lg transition-all transform active:scale-[0.98] ${isLoading || Number(amount) < 30
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:-translate-y-0.5'
                            }`}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Processing...
                            </div>
                        ) : (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Pay {amount} ETB with Chapa
                            </span>
                        )}
                    </button>

                    {/* Security Badge */}
                    <div className="mt-5 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">Secured by Chapa Payment Gateway</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
