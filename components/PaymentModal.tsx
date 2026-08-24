import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../constants';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    userEmail: string;
    has24hSubscription?: boolean;
    hasMonthlySubscription?: boolean;
}

type ManualChannel = 'telebirr' | 'safaricom' | 'bank';
const ALL_CHANNELS: ManualChannel[] = ['telebirr', 'safaricom', 'bank'];

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, userEmail, has24hSubscription = false, hasMonthlySubscription = false }) => {
    const { t } = useTranslation();
    const [amount, setAmount] = useState('50');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [mode, setMode] = useState<'recharge' | 'subscription' | 'monthly'>('recharge');
    const [subPrice, setSubPrice] = useState('100');
    const [dailyQuota, setDailyQuota] = useState('100');
    const [monthlyPrice, setMonthlyPrice] = useState('500');
    const [monthlyQuota, setMonthlyQuota] = useState('100');
    const [quotaResetHours, setQuotaResetHours] = useState('24');
    const [agreedToFairUsage, setAgreedToFairUsage] = useState(false);

    // Payment method + manual payment configuration
    const [chapaEnabled, setChapaEnabled] = useState(true);
    const [channelEnabled, setChannelEnabled] = useState<Record<ManualChannel, boolean>>({
        telebirr: false, safaricom: false, bank: false,
    });
    const [payMethod, setPayMethod] = useState<'chapa' | 'manual'>('chapa');
    const [manualInstructions, setManualInstructions] = useState('');
    const [accounts, setAccounts] = useState<Record<ManualChannel, { number: string; name: string }>>({
        telebirr: { number: '', name: '' },
        safaricom: { number: '', name: '' },
        bank: { number: '', name: '' },
    });
    const [bankName, setBankName] = useState('');
    const [contact, setContact] = useState({ phone: '', telegram: '', email: '' });
    const [manualChannel, setManualChannel] = useState<ManualChannel>('telebirr');
    const [reference, setReference] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [copiedKey, setCopiedKey] = useState('');
    const [submitted, setSubmitted] = useState(false);

    // Fetch subscription price/quota + payment method config on mount
    React.useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch(`${API_URL}/settings/public`);
                if (res.ok) {
                    const data = await res.json();
                    const get = (key: string) => data.find((s: any) => s.key === key)?.value;

                    if (get('subscription_24h_price')) setSubPrice(get('subscription_24h_price'));
                    if (get('subscription_daily_quota')) setDailyQuota(get('subscription_daily_quota'));
                    if (get('subscription_monthly_price')) setMonthlyPrice(get('subscription_monthly_price'));
                    if (get('subscription_monthly_quota')) setMonthlyQuota(get('subscription_monthly_quota'));
                    if (get('quota_reset_hours')) setQuotaResetHours(get('quota_reset_hours'));

                    const isTrue = (v: any) => String(v).toLowerCase() === 'true';
                    const cEnabled = get('chapa_enabled') === undefined ? true : isTrue(get('chapa_enabled'));
                    setChapaEnabled(cEnabled);

                    const enabled = {
                        telebirr: isTrue(get('telebirr_enabled')),
                        safaricom: isTrue(get('safaricom_enabled')),
                        bank: isTrue(get('bank_enabled')),
                    };
                    setChannelEnabled(enabled);

                    setManualInstructions(get('manual_payment_instructions') || '');
                    const nextAccounts = {
                        telebirr: { number: get('telebirr_number') || '', name: get('telebirr_name') || '' },
                        safaricom: { number: get('safaricom_number') || '', name: get('safaricom_name') || '' },
                        bank: { number: get('bank_account') || '', name: get('bank_holder') || '' },
                    };
                    setAccounts(nextAccounts);
                    setBankName(get('bank_name') || '');

                    // A channel is available only if enabled AND has an account number set
                    const available = ALL_CHANNELS.filter(c => enabled[c] && nextAccounts[c].number.trim() !== '');
                    const manualAvailable = available.length > 0;
                    // Default to whichever method is available (prefer Chapa)
                    setPayMethod(cEnabled ? 'chapa' : (manualAvailable ? 'manual' : 'chapa'));
                    if (available.length > 0) setManualChannel(available[0]);

                    setContact({
                        phone: get('admin_contact_phone') || '',
                        telegram: get('admin_contact_telegram') || '',
                        email: get('admin_contact_email') || '',
                    });
                }
            } catch (e) {
                console.error("Failed to fetch settings", e);
            }
        };
        if (isOpen) {
            fetchSettings();
            // Reset transient state each time the modal opens
            setSubmitted(false);
            setError('');
            setReference('');
            setReceiptFile(null);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const finalAmount = mode === 'subscription' ? subPrice : mode === 'monthly' ? monthlyPrice : amount;
    const paymentType = mode === 'subscription' ? 'subscription_24h' : mode === 'monthly' ? 'subscription_monthly' : 'recharge';

    // What the user is buying — shown as an order summary so the selected plan is explicit
    const planInfo = mode === 'monthly'
        ? { icon: '📅', name: t('monthlyPass'), note: t('thirtyDays') }
        : mode === 'subscription'
            ? { icon: '⏰', name: t('24hPass'), note: t('questionsPerHours', { count: parseInt(dailyQuota), hours: quotaResetHours }) }
            : { icon: '💰', name: t('accountTopUp'), note: t('tokenBasedBilling') };

    // A channel shows only when the admin enabled it AND provided an account number
    const configuredChannels = ALL_CHANNELS.filter(c => channelEnabled[c] && accounts[c].number.trim() !== '');
    const manualAvailable = configuredChannels.length > 0;
    const chapaAvailable = chapaEnabled;
    const hasContact = !!(contact.phone || contact.telegram || contact.email);

    // Effective method actually shown to the user — a disabled method is never rendered,
    // even if it was the last-selected one. Falls back to whatever IS available.
    const effectiveMethod: 'chapa' | 'manual' | 'none' =
        (payMethod === 'manual' && manualAvailable) ? 'manual'
            : (payMethod === 'chapa' && chapaAvailable) ? 'chapa'
                : manualAvailable ? 'manual'
                    : chapaAvailable ? 'chapa'
                        : 'none';
    const showChapa = effectiveMethod === 'chapa';
    const showManual = effectiveMethod === 'manual';
    const showMethodSwitch = chapaAvailable && manualAvailable;

    const channelLabel = (c: ManualChannel) => c === 'telebirr' ? t('telebirr') : c === 'safaricom' ? t('safaricom') : (bankName || t('bankTransfer'));
    const channelIcon = (c: ManualChannel) => c === 'telebirr' ? '📱' : c === 'safaricom' ? '📲' : '🏦';

    const telegramHref = (v: string) => v.startsWith('http') ? v : `https://t.me/${v.replace(/^@/, '')}`;

    const copyToClipboard = async (text: string, key: string) => {
        try {
            await navigator.clipboard.writeText(text);
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(''), 1500);
        } catch { /* clipboard not available */ }
    };

    const handleChapaPayment = async () => {
        setError('');
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/payment/initialize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    amount: finalAmount,
                    email: userEmail,
                    first_name: "EthioLex",
                    last_name: "User",
                    payment_type: paymentType
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.detail || 'Payment failed');
            if (data.checkout_url) window.location.href = data.checkout_url;
        } catch (err: any) {
            setError(err.message || 'Error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const ALLOWED_RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

    const onSelectReceipt = (file: File | null) => {
        setError('');
        if (!file) { setReceiptFile(null); return; }
        if (!ALLOWED_RECEIPT_TYPES.includes(file.type)) {
            setError(t('receiptInvalidType'));
            return;
        }
        if (file.size > MAX_RECEIPT_BYTES) {
            setError(t('receiptTooLarge'));
            return;
        }
        setReceiptFile(file);
    };

    const handleManualSubmit = async () => {
        setError('');
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const form = new FormData();
            form.append('amount', finalAmount);
            form.append('payment_type', paymentType);
            form.append('channel', manualChannel);
            form.append('reference', reference.trim());
            if (receiptFile) form.append('receipt', receiptFile);

            const response = await fetch(`${API_URL}/payment/manual/submit`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }, // no Content-Type: browser sets multipart boundary
                body: form
            });
            const data = await response.json();
            if (!response.ok) {
                const detail = typeof data.detail === 'string' ? data.detail : 'Submission failed';
                throw new Error(detail);
            }
            setSubmitted(true);
        } catch (err: any) {
            setError(err.message || 'Error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    const quickAmounts = ['50', '100', '200', '500'];
    const amountTooLow = mode === 'recharge' && Number(amount) < 5;
    const subscriptionNotAgreed = (mode === 'subscription' || mode === 'monthly') && !agreedToFairUsage;

    // ----- Success screen (manual payment submitted) -----
    if (submitted) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
                <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in">
                    <div className="p-6 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                            <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {t('manualSubmittedTitle')}
                        </h2>
                        <p className="text-sm text-slate-500 mb-5">
                            {t('manualSubmittedMsg', { amount: finalAmount })}
                        </p>

                        {hasContact && (
                            <div className="text-left bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5">
                                <p className="text-xs font-semibold text-slate-600 mb-3">{t('sendReceiptTo')}</p>
                                <div className="space-y-2">
                                    {contact.telegram && (
                                        <a href={telegramHref(contact.telegram)} target="_blank" rel="noopener noreferrer"
                                            className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-sky-300 hover:bg-sky-50 transition-all">
                                            <span className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center text-sky-600">✈️</span>
                                            <div className="min-w-0">
                                                <div className="text-[11px] text-slate-400">{t('telegram')}</div>
                                                <div className="text-sm font-medium text-slate-700 truncate">{contact.telegram}</div>
                                            </div>
                                        </a>
                                    )}
                                    {contact.phone && (
                                        <a href={`tel:${contact.phone}`}
                                            className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 transition-all">
                                            <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">📞</span>
                                            <div className="min-w-0">
                                                <div className="text-[11px] text-slate-400">{t('phone')}</div>
                                                <div className="text-sm font-medium text-slate-700 truncate">{contact.phone}</div>
                                            </div>
                                        </a>
                                    )}
                                    {contact.email && (
                                        <a href={`mailto:${contact.email}`}
                                            className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all">
                                            <span className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">✉️</span>
                                            <div className="min-w-0">
                                                <div className="text-[11px] text-slate-400">{t('email')}</div>
                                                <div className="text-sm font-medium text-slate-700 truncate">{contact.email}</div>
                                            </div>
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        <button onClick={onClose}
                            className="w-full py-3.5 rounded-2xl font-bold text-base bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-lg shadow-emerald-500/30 transition-all">
                            {t('done')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto animate-scale-in">

                {/* Header */}
                <div className="relative p-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 sticky top-0 z-20">
                    <div className="absolute top-0 left-0 right-0 h-1 eth-flag-stripe"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 bg-indigo-500"></div>

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
                            {t('choosePlan')}
                        </h2>
                        <p className="text-white/60 text-sm">{t('selectPaymentOption')}</p>
                    </div>
                </div>

                {/* Body - Pricing Cards */}
                <div className="p-5">
                    {/* Three Pricing Cards */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                        {/* Pay-as-you-go Card */}
                        <button
                            onClick={() => setMode('recharge')}
                            className={`relative p-3 rounded-2xl border-2 text-left transition-all ${mode === 'recharge'
                                ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-500/20'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                        >
                            {mode === 'recharge' && (
                                <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                            <div className={`w-8 h-8 rounded-xl mb-2 flex items-center justify-center ${mode === 'recharge' ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                                <svg className={`w-4 h-4 ${mode === 'recharge' ? 'text-white' : 'text-slate-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className={`font-bold text-xs mb-0.5 ${mode === 'recharge' ? 'text-emerald-800' : 'text-slate-700'}`}>
                                {t('payAsYouGo')}
                            </h3>
                            <p className="text-[10px] text-slate-500 mb-2">{t('tokenBasedBilling')}</p>
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                    <svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span>{t('noDailyLimits')}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                    <svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span>{t('useAnytime')}</span>
                                </div>
                            </div>
                        </button>

                        {/* 24-Hour Pass Card */}
                        <button
                            onClick={() => { if (!has24hSubscription && !hasMonthlySubscription) { setMode('subscription'); setAgreedToFairUsage(false); } }}
                            disabled={has24hSubscription || hasMonthlySubscription}
                            className={`relative p-3 rounded-2xl border-2 text-left transition-all ${has24hSubscription || hasMonthlySubscription
                                ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                                : mode === 'subscription'
                                    ? 'border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-500/20'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                        >
                            {mode === 'subscription' && (
                                <div className="absolute -top-2 -right-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                            <div className={`w-8 h-8 rounded-xl mb-2 flex items-center justify-center ${mode === 'subscription' ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                                <span className="text-sm">⏰</span>
                            </div>
                            <h3 className={`font-bold text-xs mb-0.5 ${mode === 'subscription' ? 'text-indigo-800' : 'text-slate-700'}`}>
                                {t('24hPass')}
                            </h3>
                            <p className="text-[10px] text-slate-500 mb-2">{subPrice} ETB</p>
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                    <svg className="w-2.5 h-2.5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span>{t('questionsPerHours', { count: parseInt(dailyQuota), hours: quotaResetHours })}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                    <svg className="w-2.5 h-2.5 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span>{t('noTokenCost')}</span>
                                </div>
                            </div>
                        </button>

                        {/* Monthly Pass Card */}
                        <button
                            onClick={() => { if (!has24hSubscription && !hasMonthlySubscription) { setMode('monthly'); setAgreedToFairUsage(false); } }}
                            disabled={has24hSubscription || hasMonthlySubscription}
                            className={`relative p-3 rounded-2xl border-2 text-left transition-all ${has24hSubscription || hasMonthlySubscription
                                ? 'border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed'
                                : mode === 'monthly'
                                    ? 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-500/20'
                                    : 'border-slate-200 bg-white hover:border-slate-300'
                                }`}
                        >
                            {mode === 'monthly' && (
                                <div className="absolute -top-2 -right-2 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </div>
                            )}
                            <div className="absolute top-1.5 left-1.5">
                                <span className="px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-[8px] font-bold text-white rounded-full uppercase">{t('popular')}</span>
                            </div>
                            <div className={`w-8 h-8 rounded-xl mb-2 mt-4 flex items-center justify-center ${mode === 'monthly' ? 'bg-purple-500' : 'bg-slate-200'}`}>
                                <span className="text-sm">📅</span>
                            </div>
                            <h3 className={`font-bold text-xs mb-0.5 ${mode === 'monthly' ? 'text-purple-800' : 'text-slate-700'}`}>
                                {t('monthlyPass')}
                            </h3>
                            <p className="text-[10px] text-slate-500 mb-2">{monthlyPrice} ETB</p>
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                    <svg className="w-2.5 h-2.5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span>{t('questionsPerHours', { count: parseInt(monthlyQuota), hours: quotaResetHours })}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-600">
                                    <svg className="w-2.5 h-2.5 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span>{t('thirtyDays')}</span>
                                </div>
                            </div>
                        </button>
                    </div>

                    {/* Conditional Content based on mode */}
                    {mode === 'recharge' ? (
                        <div className="animate-fade-in">
                            {/* Amount Input */}
                            <div className="mb-4">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('amountETB')}</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">ETB</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="w-full pl-14 pr-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 text-xl font-bold text-slate-900 transition-all outline-none"
                                        placeholder="50"
                                        min="5"
                                    />
                                </div>
                            </div>

                            {/* Quick Amounts */}
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                {quickAmounts.map((val) => (
                                    <button
                                        key={val}
                                        onClick={() => setAmount(val)}
                                        className={`py-2.5 rounded-xl text-center transition-all text-sm font-bold ${amount === val
                                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                            }`}
                                    >
                                        {val}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in">
                            {/* Fair Usage Agreement */}
                            <div className={`border rounded-xl p-3 mb-4 ${mode === 'monthly' ? 'bg-purple-50 border-purple-200' : 'bg-amber-50 border-amber-200'}`}>
                                <div className="flex items-start gap-2">
                                    <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${mode === 'monthly' ? 'text-purple-500' : 'text-amber-500'}`} fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                    <p className={`text-xs leading-relaxed ${mode === 'monthly' ? 'text-purple-800' : 'text-amber-800'}`}>
                                        <strong>{t('fairUsageTitle')}:</strong> {t('fairUsageWarning', { quota: mode === 'monthly' ? monthlyQuota : dailyQuota, hours: quotaResetHours })}
                                        {mode === 'monthly' && <span className="block mt-1">{t('monthlyDuration')}</span>}
                                    </p>
                                </div>
                            </div>

                            {/* Checkbox */}
                            <label className="flex items-center gap-3 cursor-pointer group mb-4">
                                <div className="relative flex-shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={agreedToFairUsage}
                                        onChange={(e) => setAgreedToFairUsage(e.target.checked)}
                                        className="w-5 h-5 rounded border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-2 cursor-pointer appearance-none checked:bg-indigo-600 checked:border-indigo-600 transition-all"
                                    />
                                    {agreedToFairUsage && (
                                        <svg className="absolute inset-0 w-5 h-5 text-white pointer-events-none p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </div>
                                <span className="text-sm text-slate-600">
                                    {t('fairUsageAgree')}
                                </span>
                            </label>
                        </div>
                    )}

                    {/* Order summary — makes the selected plan explicit before paying */}
                    {effectiveMethod !== 'none' && (
                        <div className="mb-4 rounded-2xl border-2 border-slate-100 bg-slate-50 p-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl flex-shrink-0">{planInfo.icon}</span>
                                <div className="min-w-0">
                                    <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">{t('youArePayingFor')}</div>
                                    <div className="text-sm font-bold text-slate-800 truncate">{planInfo.name}</div>
                                    {planInfo.note && <div className="text-[11px] text-slate-500 truncate">{planInfo.note}</div>}
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                                <div className="text-xl font-bold text-slate-900">{finalAmount}</div>
                                <div className="text-[11px] text-slate-400 font-semibold">ETB</div>
                            </div>
                        </div>
                    )}

                    {/* Payment Method Switch (only when both methods are available) */}
                    {showMethodSwitch && (
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-slate-700 mb-2">{t('selectHowToPay')}</label>
                            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                                <button
                                    onClick={() => { setPayMethod('chapa'); setError(''); }}
                                    className={`py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${showChapa ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <span>💳</span>{t('payOnline')}
                                </button>
                                <button
                                    onClick={() => { setPayMethod('manual'); setError(''); }}
                                    className={`py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 ${showManual ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <span>📱</span>{t('payManually')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* No payment method available at all */}
                    {effectiveMethod === 'none' && (
                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                            {t('noPaymentMethods')}
                        </div>
                    )}

                    {/* Manual payment details */}
                    {showManual && (
                        <div className="animate-fade-in mb-4">
                            {(
                                <>
                                    {manualInstructions && (
                                        <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 mb-4 text-xs text-sky-800 leading-relaxed">
                                            {manualInstructions}
                                        </div>
                                    )}

                                    {/* Account cards */}
                                    <div className="space-y-2 mb-4">
                                        {configuredChannels.map((c) => (
                                            <div key={c} className="border border-slate-200 rounded-xl p-3 bg-white">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-lg flex-shrink-0">{channelIcon(c)}</span>
                                                        <div className="min-w-0">
                                                            <div className="text-[11px] text-slate-400 font-medium">{channelLabel(c)}</div>
                                                            <div className="text-sm font-bold text-slate-800 truncate">{accounts[c].number}</div>
                                                            {accounts[c].name && <div className="text-[11px] text-slate-500 truncate">{accounts[c].name}</div>}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => copyToClipboard(accounts[c].number, c)}
                                                        className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all"
                                                    >
                                                        {copiedKey === c ? `✓ ${t('copied')}` : t('copy')}
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Which account did you pay to? */}
                                    {configuredChannels.length > 1 && (
                                        <div className="mb-3">
                                            <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('whichAccountPaid')}</label>
                                            <div className="flex flex-wrap gap-2">
                                                {configuredChannels.map((c) => (
                                                    <button key={c} onClick={() => setManualChannel(c)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${manualChannel === c ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                                                        {channelIcon(c)} {channelLabel(c)}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Transaction reference */}
                                    <div className="mb-3">
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">{t('txReference')}</label>
                                        <input
                                            type="text"
                                            value={reference}
                                            onChange={(e) => setReference(e.target.value)}
                                            maxLength={200}
                                            className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 text-sm text-slate-900 transition-all outline-none"
                                            placeholder={t('txReferencePlaceholderChannel', { channel: channelLabel(manualChannel) })}
                                        />
                                    </div>

                                    {/* Receipt upload (required) */}
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                            {t('uploadReceipt')} <span className="font-semibold text-red-500">*</span>
                                        </label>
                                        {receiptFile ? (
                                            <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-emerald-200 bg-emerald-50">
                                                <span className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">
                                                    {receiptFile.type === 'application/pdf' ? '📄' : '🖼️'}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-sm font-medium text-slate-800 truncate">{receiptFile.name}</div>
                                                    <div className="text-[11px] text-slate-500">{(receiptFile.size / 1024).toFixed(0)} KB</div>
                                                </div>
                                                <button onClick={() => onSelectReceipt(null)}
                                                    className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 transition-all">
                                                    {t('remove')}
                                                </button>
                                            </div>
                                        ) : (
                                            <label className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/40 cursor-pointer transition-all">
                                                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                                <span className="text-sm font-medium text-slate-500">{t('chooseReceiptFile')}</span>
                                                <input type="file" accept="image/*,application/pdf" className="hidden"
                                                    onChange={(e) => onSelectReceipt(e.target.files?.[0] || null)} />
                                            </label>
                                        )}
                                        <p className="text-[11px] text-slate-400 mt-1.5">{t('receiptHint')}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                            <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm text-red-700">{error}</span>
                        </div>
                    )}

                    {/* Action Button */}
                    {showManual ? (
                        <>
                            <button
                                onClick={handleManualSubmit}
                                disabled={isLoading || amountTooLow || subscriptionNotAgreed || !receiptFile}
                                className={`w-full py-4 rounded-2xl font-bold text-base shadow-lg transition-all transform active:scale-[0.98] ${isLoading || amountTooLow || subscriptionNotAgreed || !receiptFile
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-slate-800 to-slate-700 hover:from-slate-700 hover:to-slate-600 text-white shadow-slate-500/30'
                                    }`}
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        {t('submitting')}
                                    </div>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        {t('submitForConfirmation', { amount: finalAmount })}
                                    </span>
                                )}
                            </button>
                            {!receiptFile && !isLoading && (
                                <p className="text-[11px] text-amber-600 text-center mt-2">{t('receiptRequiredNote')}</p>
                            )}
                        </>
                    ) : showChapa ? (
                        <button
                            onClick={handleChapaPayment}
                            disabled={isLoading || amountTooLow || subscriptionNotAgreed}
                            className={`w-full py-4 rounded-2xl font-bold text-base shadow-lg transition-all transform active:scale-[0.98] ${isLoading || amountTooLow || subscriptionNotAgreed
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : mode === 'monthly'
                                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/30'
                                    : mode === 'subscription'
                                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/30'
                                        : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-500/30'
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
                                    {mode === 'monthly' ? t('activateMonthlyPass', { price: monthlyPrice }) : mode === 'subscription' ? t('activate24hPass', { price: subPrice }) : t('payWithChapa', { amount })}
                                </span>
                            )}
                        </button>
                    ) : null}

                    {/* Security Badge */}
                    {effectiveMethod !== 'none' && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                            {showManual ? t('adminConfirmsManually') : t('securedByChapa')}
                        </span>
                    </div>
                    )}
                </div>
            </div >
        </div>
    );
};

export default PaymentModal;
