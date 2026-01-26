import React from 'react';
import { useTranslation } from 'react-i18next';

interface QuotaExhaustedModalProps {
    isOpen: boolean;
    onClose: () => void;
    total: number;
    onSubscribe: () => void;
    onPayAsYouGo: () => void;
}

const QuotaExhaustedModal: React.FC<QuotaExhaustedModalProps> = ({
    isOpen,
    onClose,
    total,
    onSubscribe,
    onPayAsYouGo
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="relative p-6 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500">
                    <div className="absolute top-0 left-0 right-0 h-1 eth-flag-stripe"></div>

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/20 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="relative text-center">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {t('quotaExhausted')}
                        </h2>
                        <p className="text-white/80 text-sm">
                            {t('quotaExhaustedMsg', { total })}
                        </p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-slate-600 text-sm mb-6 text-center">
                        {t('quotaExhaustedOptions')}
                    </p>

                    <div className="space-y-3">
                        {/* Subscribe Option */}
                        <button
                            onClick={onSubscribe}
                            className="w-full py-4 px-4 rounded-2xl font-bold text-base bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            <span className="text-xl">♾️</span>
                            {t('quotaOptionSubscribe')}
                        </button>

                        {/* Pay As You Go Option */}
                        <button
                            onClick={onPayAsYouGo}
                            className="w-full py-4 px-4 rounded-2xl font-bold text-base bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/30 transition-all transform active:scale-[0.98] flex items-center justify-center gap-3"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {t('quotaOptionPayAsYouGo')}
                        </button>
                    </div>

                    {/* Info Text */}
                    <p className="text-xs text-slate-400 text-center mt-5">
                        {t('fairUsageText')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default QuotaExhaustedModal;
