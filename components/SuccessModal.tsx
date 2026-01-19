import React from 'react';

interface SuccessModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    message?: string;
    amount?: number;
}

const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, title = "Success!", message, amount }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>

            {/* Modal Card */}
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-scale-in">
                {/* Ethiopian Stripe */}
                <div className="h-1.5 eth-flag-stripe"></div>

                <div className="p-8 text-center">
                    {/* Animated Success Icon */}
                    <div className="relative inline-flex items-center justify-center w-24 h-24 mb-6">
                        {/* Glow effect */}
                        <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-xl animate-pulse"></div>

                        {/* Outer ring */}
                        <div className="absolute inset-0 rounded-full border-4 border-emerald-100"></div>

                        {/* Main circle */}
                        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/40">
                            <svg className="w-10 h-10 text-white animate-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" className="animate-draw" />
                            </svg>
                        </div>

                        {/* Celebration particles */}
                        <div className="absolute -top-2 left-1/2 w-2 h-2 bg-amber-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
                        <div className="absolute top-4 -right-2 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
                        <div className="absolute top-4 -left-2 w-1.5 h-1.5 bg-red-400 rounded-full animate-ping" style={{ animationDelay: '0.6s' }}></div>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-slate-900 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                        {title}
                    </h2>

                    {/* Message */}
                    <p className="text-slate-500 mb-6 text-sm">{message}</p>

                    {/* Balance Display */}
                    {amount !== undefined && (
                        <div className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-emerald-50 rounded-2xl p-5 mb-6 border border-emerald-100">
                            {/* Decorative gradient */}
                            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-2xl"></div>

                            <div className="relative">
                                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2">New Balance</div>
                                <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-4xl font-bold text-emerald-600 tracking-tight">
                                        {amount.toLocaleString().split('.')[0]}
                                    </span>
                                    <span className="text-lg text-slate-400 font-medium">
                                        .{((amount % 1).toFixed(2)).slice(2)}
                                    </span>
                                    <span className="text-sm text-slate-500 font-semibold ml-1">ETB</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Continue Button */}
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl font-semibold text-base shadow-lg shadow-emerald-500/30 transition-all hover:-translate-y-0.5 hover:shadow-emerald-500/40"
                    >
                        Continue Consulting
                    </button>
                </div>
            </div>

            <style>{`
                @keyframes check {
                    0% { transform: scale(0); opacity: 0; }
                    50% { transform: scale(1.2); }
                    100% { transform: scale(1); opacity: 1; }
                }
                @keyframes draw {
                    from { stroke-dasharray: 24; stroke-dashoffset: 24; }
                    to { stroke-dasharray: 24; stroke-dashoffset: 0; }
                }
                .animate-check {
                    animation: check 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
                .animate-draw {
                    animation: draw 0.5s ease-out 0.3s forwards;
                    stroke-dasharray: 24;
                    stroke-dashoffset: 24;
                }
            `}</style>
        </div>
    );
};

export default SuccessModal;
