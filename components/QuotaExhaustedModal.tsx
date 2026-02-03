import React from 'react';
import { useTranslation } from 'react-i18next';

interface QuotaExhaustedModalProps {
    isOpen: boolean;
    onClose: () => void;
    total: number;
    resetHours: number;
    onSubscribe: () => void;
    onPayAsYouGo: () => void;
}

const QuotaExhaustedModal: React.FC<QuotaExhaustedModalProps> = ({
    isOpen,
    onClose,
    total,
    resetHours,
    onSubscribe,
    onPayAsYouGo
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="relative p-8 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500">
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
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {t('quotaExhausted')}
                        </h2>
                        <p className="text-white/90 text-base">
                            {t('quotaExhaustedMsg', { hours: resetHours })}
                        </p>
                    </div>
                </div>

                {/* Footer - Simple OK button */}
                <div className="p-6 bg-slate-50">
                    <button
                        onClick={onClose}
                        className="w-full py-3 px-4 rounded-xl font-semibold text-base bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 text-white shadow-lg transition-all"
                    >
                        {t('confirm')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default QuotaExhaustedModal;
