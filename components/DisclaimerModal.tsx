import React from 'react';
import { Language } from '../types';
import { UI_STRINGS } from '../constants';

interface DisclaimerModalProps {
  isOpen: boolean;
  onAccept: () => void;
  language: Language;
}

const DisclaimerModal: React.FC<DisclaimerModalProps> = ({ isOpen, onAccept, language }) => {
  if (!isOpen) return null;
  const t = UI_STRINGS[language];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-8 text-center border-t-4 border-yellow-500">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-50 mb-6">
          <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2 serif">{t.disclaimerTitle}</h3>
        <p className="text-gray-600 mb-6 text-sm leading-relaxed">
          {t.disclaimerText}
        </p>
        <button
          onClick={onAccept}
          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-3 bg-slate-900 text-base font-medium text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 sm:text-sm transition-colors"
        >
          {t.acceptDisclaimer}
        </button>
      </div>
    </div>
  );
};

export default DisclaimerModal;