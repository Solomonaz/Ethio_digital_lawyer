import React, { useEffect } from 'react';

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
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

            {/* Modal Card */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center transform transition-all scale-100 animate-bounce-in">
                {/* Animated Checkmark */}
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-green-600 animate-check" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" strokeDasharray="24" strokeDashoffset="0" className="animate-draw" />
                    </svg>
                </div>

                <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
                <p className="text-slate-500 mb-6">{message}</p>

                {amount !== undefined && (
                    <div className="bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100">
                        <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">New Balance</div>
                        <div className="text-3xl font-bold text-slate-900">
                            {amount.toLocaleString()} <span className="text-lg text-slate-500 font-medium">ETB</span>
                        </div>
                    </div>
                )}

                <button
                    onClick={onClose}
                    className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold transition-colors shadow-lg shadow-slate-200"
                >
                    Continue
                </button>
            </div>

            <style>{`
            @keyframes check {
                0% { transform: scale(0); opacity: 0; }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); opacity: 1; }
            }
            @keyframes draw {
                to { stroke-dashoffset: 0; }
            }
            @keyframes bounce-in {
                0% { opacity: 0; transform: scale(0.3); }
                50% { opacity: 1; transform: scale(1.05); }
                70% { transform: scale(0.9); }
                100% { transform: scale(1); }
            }
            .animate-check {
                animation: check 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            .animate-draw {
                stroke-dasharray: 24;
                stroke-dashoffset: 24;
                animation: draw 0.5s ease-out 0.2s forwards;
            }
            .animate-bounce-in {
                animation: bounce-in 0.5s cubic-bezier(0.215, 0.610, 0.355, 1.000) both;
            }
        `}</style>
        </div>
    );
};

export default SuccessModal;
