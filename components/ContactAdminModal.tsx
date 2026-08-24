import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../constants';

interface ContactAdminModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ContactAdminModal: React.FC<ContactAdminModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const [contact, setContact] = useState({ phone: '', telegram: '', email: '' });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchContact = async () => {
            setLoading(true);
            try {
                const res = await fetch(`${API_URL}/settings/public`);
                if (res.ok) {
                    const data = await res.json();
                    const get = (key: string) => data.find((s: any) => s.key === key)?.value || '';
                    setContact({
                        phone: get('admin_contact_phone'),
                        telegram: get('admin_contact_telegram'),
                        email: get('admin_contact_email'),
                    });
                }
            } catch (e) {
                console.error('Failed to fetch contact info', e);
            } finally {
                setLoading(false);
            }
        };
        if (isOpen) fetchContact();
    }, [isOpen]);

    if (!isOpen) return null;

    const telegramHref = (v: string) => v.startsWith('http') ? v : `https://t.me/${v.replace(/^@/, '')}`;
    const hasContact = !!(contact.phone || contact.telegram || contact.email);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
                {/* Header */}
                <div className="relative p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                    <div className="absolute top-0 left-0 right-0 h-1 eth-flag-stripe"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 bg-emerald-500"></div>
                    <button aria-label="Close"
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/20 transition-all"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                    <div className="relative text-center">
                        <h2 className="text-xl font-bold text-white mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {t('contactAdmin')}
                        </h2>
                        <p className="text-white/60 text-sm">{t('contactAdminSubtitle')}</p>
                    </div>
                </div>

                {/* Body */}
                <div className="p-5">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : !hasContact ? (
                        <div className="text-center py-8 text-sm text-slate-500">
                            {t('noContactInfo')}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {contact.telegram && (
                                <a href={telegramHref(contact.telegram)} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border-2 border-slate-100 hover:border-sky-300 hover:bg-sky-50 transition-all">
                                    <span className="w-11 h-11 rounded-xl bg-sky-100 flex items-center justify-center text-xl text-sky-600 flex-shrink-0">✈️</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs text-slate-400 font-medium">{t('telegram')}</div>
                                        <div className="text-sm font-semibold text-slate-800 truncate">{contact.telegram}</div>
                                    </div>
                                    <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </a>
                            )}
                            {contact.phone && (
                                <a href={`tel:${contact.phone}`}
                                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border-2 border-slate-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all">
                                    <span className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-xl text-emerald-600 flex-shrink-0">📞</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs text-slate-400 font-medium">{t('phone')}</div>
                                        <div className="text-sm font-semibold text-slate-800 truncate">{contact.phone}</div>
                                    </div>
                                    <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </a>
                            )}
                            {contact.email && (
                                <a href={`mailto:${contact.email}`}
                                    className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border-2 border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                                    <span className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center text-xl text-indigo-600 flex-shrink-0">✉️</span>
                                    <div className="min-w-0 flex-1">
                                        <div className="text-xs text-slate-400 font-medium">{t('email')}</div>
                                        <div className="text-sm font-semibold text-slate-800 truncate">{contact.email}</div>
                                    </div>
                                    <svg className="w-4 h-4 text-slate-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ContactAdminModal;
