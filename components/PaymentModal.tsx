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
                // Redirect to Chapa checkout
                window.location.href = data.checkout_url;
            }
        } catch (err: any) {
            setError(err.message || 'Error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 via-yellow-500 to-red-500 p-6 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <h2 className="text-xl font-bold text-white mb-1">Add Funds</h2>
                    <p className="text-white/80 text-sm">Recharge your account to continue consulting.</p>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Amount (ETB)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">ETB</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full pl-14 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-lg font-bold text-slate-900"
                                placeholder="50"
                                min="30"
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-2">Minimum recharge: 30 ETB (1 consultation)</p>
                    </div>

                    {/* Quick amounts */}
                    <div className="flex gap-2 mb-6">
                        {['50', '100', '200', '500'].map((val) => (
                            <button
                                key={val}
                                onClick={() => setAmount(val)}
                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${amount === val
                                        ? 'bg-green-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {val}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center">
                            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handlePayment}
                        disabled={isLoading || Number(amount) < 30}
                        className={`w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-all transform active:scale-95 ${isLoading || Number(amount) < 30
                                ? 'bg-slate-400 cursor-not-allowed'
                                : 'bg-green-600 hover:bg-green-700 hover:shadow-green-500/30'
                            }`}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center">
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Processing...
                            </div>
                        ) : (
                            `Pay ${amount} ETB with Chapa`
                        )}
                    </button>

                    <div className="mt-4 flex justify-center">
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Secured by Chapa</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
