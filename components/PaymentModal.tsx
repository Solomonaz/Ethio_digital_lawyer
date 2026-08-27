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

// A manual-payment destination. Telebirr / Safaricom are single mobile-money
// accounts; banks are a configurable list — so the picker is driven by a flat
// list of targets rather than three fixed channels, and scales to any number.
type PayKind = 'telebirr' | 'safaricom' | 'bank';
interface PayTarget {
    id: string;      // stable unique id: 'telebirr', 'safaricom', 'bank-0', 'bank-1'…
    kind: PayKind;   // drives the icon and the submitted channel
    label: string;   // display name (bank name, or the channel name)
    number: string;
    holder: string;
}
const KIND_ICON: Record<PayKind, string> = { telebirr: '📱', safaricom: '📲', bank: '🏦' };

const CheckIcon = ({ className }: { className: string }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
);

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, userEmail, has24hSubscription = false, hasMonthlySubscription = false }) => {
    const { t } = useTranslation();

    // Wizard: Step 1 = choose plan & amount, Step 2 = pay & submit proof.
    const [step, setStep] = useState<1 | 2>(1);

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
    const [payMethod, setPayMethod] = useState<'chapa' | 'manual'>('chapa');
    const [manualInstructions, setManualInstructions] = useState('');
    // All manual accounts the user can pay to (Telebirr, Safaricom, and each bank).
    const [payTargets, setPayTargets] = useState<PayTarget[]>([]);
    const [contact, setContact] = useState({ phone: '', telegram: '', email: '' });
    const [selectedTargetId, setSelectedTargetId] = useState('');
    const [reference, setReference] = useState('');
    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [copiedKey, setCopiedKey] = useState('');
    const [submitted, setSubmitted] = useState(false);
    // Object-URL preview for an uploaded image receipt (revoked on change/unmount).
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

    React.useEffect(() => {
        if (receiptFile && receiptFile.type.startsWith('image/')) {
            const url = URL.createObjectURL(receiptFile);
            setReceiptPreview(url);
            return () => URL.revokeObjectURL(url);
        }
        setReceiptPreview(null);
    }, [receiptFile]);

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

                    setManualInstructions(get('manual_payment_instructions') || '');

                    // Build the flat list of pay targets. A target appears only when its
                    // category is enabled AND it has an account number.
                    const targets: PayTarget[] = [];
                    if (isTrue(get('telebirr_enabled')) && (get('telebirr_number') || '').trim())
                        targets.push({ id: 'telebirr', kind: 'telebirr', label: t('telebirr'), number: get('telebirr_number').trim(), holder: get('telebirr_name') || '' });
                    if (isTrue(get('safaricom_enabled')) && (get('safaricom_number') || '').trim())
                        targets.push({ id: 'safaricom', kind: 'safaricom', label: t('safaricom'), number: get('safaricom_number').trim(), holder: get('safaricom_name') || '' });

                    if (isTrue(get('bank_enabled'))) {
                        // Preferred: a JSON list of banks. Fall back to the single legacy
                        // bank_* fields for configs saved before the list existed.
                        let banks: Array<{ label?: string; number?: string; holder?: string }> = [];
                        try { const raw = get('bank_accounts'); if (raw) banks = JSON.parse(raw); } catch { /* malformed — use legacy */ }
                        if (!Array.isArray(banks) || banks.length === 0) {
                            if ((get('bank_account') || '').trim())
                                banks = [{ label: get('bank_name'), number: get('bank_account'), holder: get('bank_holder') }];
                        }
                        banks.forEach((b, i) => {
                            if (b && (b.number || '').toString().trim())
                                targets.push({ id: `bank-${i}`, kind: 'bank', label: (b.label || t('bankTransfer')).toString().trim(), number: b.number!.toString().trim(), holder: (b.holder || '').toString().trim() });
                        });
                    }
                    setPayTargets(targets);

                    const manualAvailable = targets.length > 0;
                    // Default to whichever method is available (prefer Chapa)
                    setPayMethod(cEnabled ? 'chapa' : (manualAvailable ? 'manual' : 'chapa'));
                    if (targets.length > 0) setSelectedTargetId(targets[0].id);

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
            setStep(1);
            setSubmitted(false);
            setError('');
            setReference('');
            setReceiptFile(null);
            setIsDragging(false);
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

    const manualAvailable = payTargets.length > 0;
    const chapaAvailable = chapaEnabled;
    // The account currently being shown/paid to. Falls back to the first one so the
    // detail card is never empty.
    const activeTarget: PayTarget | null = payTargets.find(tg => tg.id === selectedTargetId) || payTargets[0] || null;

    // Effective method actually shown — a disabled method is never selected.
    const effectiveMethod: 'chapa' | 'manual' | 'none' =
        (payMethod === 'chapa' && chapaAvailable) ? 'chapa'
            : (payMethod === 'manual' && manualAvailable) ? 'manual'
                : chapaAvailable ? 'chapa'
                    : manualAvailable ? 'manual'
                        : 'none';
    const isChapaSelected = effectiveMethod === 'chapa';

    // Step 2 payment-method tiles: Chapa (if enabled) plus every manual account.
    type Provider = { id: string; label: string; sub?: string; icon: string; isChapa: boolean; target?: PayTarget };
    const providers: Provider[] = [
        ...(chapaAvailable ? [{ id: 'chapa', label: t('payOnline'), sub: t('securedByChapa'), icon: '💳', isChapa: true }] : []),
        ...payTargets.map(tg => ({ id: tg.id, label: tg.label, sub: tg.holder, icon: KIND_ICON[tg.kind], isChapa: false, target: tg })),
    ];
    const activeProviderId = isChapaSelected ? 'chapa' : (activeTarget?.id || '');
    const selectProvider = (p: Provider) => {
        setError('');
        if (p.isChapa) { setPayMethod('chapa'); }
        else { setPayMethod('manual'); setSelectedTargetId(p.id); }
    };

    const hasContact = !!(contact.phone || contact.telegram || contact.email);
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
            form.append('channel', activeTarget?.kind || 'telebirr');
            form.append('channel_label', activeTarget?.label || '');
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
    // Step 1 → Step 2 gate: a valid amount, and fair-usage agreed for subscriptions.
    const canContinue = !amountTooLow && !subscriptionNotAgreed;
    // Manual proof: both a reference and a receipt are required before submitting.
    const manualIncomplete = !reference.trim() || !receiptFile;

    const choosePlan = (m: 'recharge' | 'subscription' | 'monthly', disabled: boolean) => {
        if (disabled) return;
        setMode(m);
        if (m !== 'recharge') setAgreedToFairUsage(false);
        setError('');
    };

    const subsLocked = has24hSubscription || hasMonthlySubscription;
    // Pricing tiers, ordered so the popular plan sits in the middle column.
    // `variable` = the Pay-as-you-go card whose price is the amount the user enters.
    const pricingPlans = [
        {
            key: 'subscription', mode: 'subscription' as const,
            name: t('24hPass'), price: subPrice, variable: false,
            period: t('perHours', { hours: quotaResetHours }), tagline: t('tagline24h'),
            features: [t('questionsPerHours', { count: parseInt(dailyQuota), hours: quotaResetHours }), t('noTokenCost')],
            disabled: subsLocked, popular: false,
        },
        {
            key: 'monthly', mode: 'monthly' as const,
            name: t('monthlyPass'), price: monthlyPrice, variable: false,
            period: t('perMonth'), tagline: t('taglineMonthly'),
            features: [t('questionsPerHours', { count: parseInt(monthlyQuota), hours: quotaResetHours }), t('thirtyDays'), t('noTokenCost')],
            disabled: subsLocked, popular: true,
        },
        {
            key: 'recharge', mode: 'recharge' as const,
            name: t('payAsYouGo'), price: '', variable: true,
            period: t('flexibleAmount'), tagline: t('taglineRecharge'),
            features: [t('noDailyLimits'), t('useAnytime'), t('tokenBasedBilling')],
            disabled: false, popular: false,
        },
    ];

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
                            className="w-full py-3.5 rounded-2xl font-bold text-base bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30 transition-all">
                            {t('done')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-slate-900/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
            <div className="bg-white w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-in">

                {/* ===== Fixed header ===== */}
                <div className="relative px-4 sm:px-5 pt-4 pb-3.5 bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-950 shrink-0">
                    <div className="absolute top-0 left-0 right-0 h-1 eth-flag-stripe"></div>
                    <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-20 bg-emerald-400"></div>

                    <div className="relative flex items-center justify-between gap-2">
                        {/* Left slot: Back (step 2) */}
                        <div className="w-28 flex justify-start">
                            {step === 2 && (
                                <button onClick={() => { setStep(1); setError(''); }}
                                    className="inline-flex items-center gap-1 text-white/80 hover:text-white text-xs font-semibold transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                    {t('backToPlans')}
                                </button>
                            )}
                        </div>

                        {/* Center: title */}
                        <h2 className="text-base sm:text-lg font-bold text-white truncate" style={{ fontFamily: "'Playfair Display', serif" }}>
                            {step === 1 ? t('choosePlan') : t('makePayment')}
                        </h2>

                        {/* Right slot: Close */}
                        <div className="w-28 flex justify-end">
                            <button aria-label="Close" onClick={onClose}
                                className="w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/20 transition-all">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="relative mt-3 flex items-center justify-center gap-1.5">
                        <span className="h-1.5 w-8 rounded-full bg-emerald-400 transition-all"></span>
                        <span className={`h-1.5 rounded-full transition-all ${step === 2 ? 'w-8 bg-emerald-400' : 'w-3 bg-white/25'}`}></span>
                        <span className="ml-2 text-[10px] font-semibold text-white/60 uppercase tracking-wider">{t('stepIndicator', { current: step, total: 2 })}</span>
                    </div>
                </div>

                {/* ===== Scrollable body ===== */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div key={step} className={step === 1 ? 'animate-slide-in-left' : 'animate-slide-in-right'}>

                        {step === 1 ? (
                            /* ---------- STEP 1: pricing cards ---------- */
                            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                                {pricingPlans.map((p) => {
                                    const rechargeInvalid = p.variable && Number(amount) < 5;
                                    const ctaDisabled = p.disabled || rechargeInvalid;
                                    return (
                                        <div key={p.key}
                                            className={`relative flex flex-col rounded-2xl border-2 p-5 transition-all ${p.disabled ? 'opacity-60' : ''} ${p.popular
                                                ? 'border-emerald-500 bg-white shadow-xl shadow-emerald-500/10 md:-mt-2 md:mb-2'
                                                : 'border-gray-100 bg-white'}`}
                                        >
                                            {p.popular && (
                                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-600 text-[10px] font-bold text-white rounded-full uppercase tracking-wide shadow-md shadow-emerald-500/30 whitespace-nowrap">
                                                    {t('topSeller')}
                                                </span>
                                            )}

                                            <h3 className="text-center font-bold text-slate-800 text-base mt-1">{p.name}</h3>

                                            {/* Price */}
                                            <div className="flex items-start justify-center mt-3 mb-0.5">
                                                <span className="text-sm font-bold text-slate-400 mt-2 mr-0.5">ETB</span>
                                                {p.variable ? (
                                                    <input type="number" value={amount} min="5" onChange={(e) => setAmount(e.target.value)}
                                                        aria-label={t('amountETB')}
                                                        className="w-24 text-center text-5xl font-extrabold text-slate-900 leading-none tracking-tight bg-transparent outline-none border-b-2 border-emerald-200 focus:border-emerald-500 transition-all" />
                                                ) : (
                                                    <span className="text-5xl font-extrabold text-slate-900 leading-none tracking-tight">{p.price}</span>
                                                )}
                                            </div>
                                            <p className="text-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{p.period}</p>
                                            <p className="text-center text-xs text-slate-500 mt-2 min-h-[32px]">{p.tagline}</p>

                                            {/* Quick amounts (Pay-as-you-go only) */}
                                            {p.variable && (
                                                <div className="grid grid-cols-4 gap-1.5 mt-1 mb-1">
                                                    {quickAmounts.map((v) => (
                                                        <button key={v} onClick={() => setAmount(v)}
                                                            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${amount === v ? 'bg-emerald-500 text-white' : 'bg-gray-50 border border-gray-100 text-slate-600 hover:border-emerald-200'}`}>
                                                            {v}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* CTA */}
                                            <button
                                                onClick={() => { if (ctaDisabled) return; choosePlan(p.mode, p.disabled); setStep(2); }}
                                                disabled={ctaDisabled}
                                                className={`mt-4 w-full py-3 rounded-xl font-bold text-sm transition-all transform active:scale-[0.98] ${ctaDisabled
                                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                                    : p.popular
                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30'
                                                        : 'bg-emerald-800 hover:bg-emerald-900 text-white'}`}
                                            >
                                                {t('selectPlan')}
                                            </button>

                                            {/* Divider + features */}
                                            <div className="border-t border-gray-100 mt-5 pt-4 space-y-2.5">
                                                {p.features.map((f, i) => (
                                                    <div key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                                        <span className="text-emerald-500 font-bold leading-5 flex-shrink-0">→</span>
                                                        <span>{f}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            /* ---------- STEP 2: payment & proof ---------- */
                            <div className="p-4 sm:p-5 space-y-3">
                                {/* Order summary bar */}
                                <div className="flex items-center justify-between gap-3 rounded-2xl bg-emerald-50 border border-emerald-100 p-3.5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="w-10 h-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center text-xl flex-shrink-0">{planInfo.icon}</span>
                                        <div className="min-w-0">
                                            <div className="text-sm font-bold text-slate-800 truncate">{planInfo.name}</div>
                                            {planInfo.note && <div className="text-[11px] text-slate-500 truncate">{planInfo.note}</div>}
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <div className="text-xl font-extrabold text-emerald-700 leading-none">{finalAmount}<span className="text-xs font-bold text-emerald-600/70 ml-0.5">ETB</span></div>
                                    </div>
                                </div>

                                {/* Fair-usage agreement — required before a subscription can be submitted */}
                                {(mode === 'subscription' || mode === 'monthly') && (
                                    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-3.5 space-y-3">
                                        <div className="flex items-start gap-2">
                                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                            <p className="text-xs leading-relaxed text-amber-800">
                                                <strong>{t('fairUsageTitle')}:</strong> {t('fairUsageWarning', { quota: mode === 'monthly' ? monthlyQuota : dailyQuota, hours: quotaResetHours })}
                                                {mode === 'monthly' && <span className="block mt-1">{t('monthlyDuration')}</span>}
                                            </p>
                                        </div>
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <div className="relative flex-shrink-0">
                                                <input type="checkbox" checked={agreedToFairUsage} onChange={(e) => setAgreedToFairUsage(e.target.checked)}
                                                    className="w-5 h-5 rounded border-2 border-gray-300 appearance-none checked:bg-emerald-600 checked:border-emerald-600 cursor-pointer transition-all" />
                                                {agreedToFairUsage && (
                                                    <svg className="absolute inset-0 w-5 h-5 text-white pointer-events-none p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                )}
                                            </div>
                                            <span className="text-sm text-slate-700">{t('fairUsageAgree')}</span>
                                        </label>
                                    </div>
                                )}

                                {effectiveMethod === 'none' ? (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">{t('noPaymentMethods')}</div>
                                ) : (
                                    <>
                                        {/* Payment provider grid (2 columns) */}
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-600 mb-2">{t('selectPaymentMethod')}</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {providers.map((p) => {
                                                    const sel = activeProviderId === p.id;
                                                    return (
                                                        <button key={p.id} onClick={() => selectProvider(p)}
                                                            className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${sel ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200'}`}>
                                                            <span className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${sel ? 'bg-emerald-100' : 'bg-gray-100'}`}>{p.icon}</span>
                                                            <span className={`text-xs font-semibold truncate ${sel ? 'text-emerald-800' : 'text-slate-600'}`}>{p.label}</span>
                                                            {sel && <CheckIcon className="w-4 h-4 text-emerald-600 ml-auto flex-shrink-0" />}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {isChapaSelected ? (
                                            /* Online (Chapa) — no account/receipt needed */
                                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 flex items-start gap-3">
                                                <span className="w-10 h-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center text-xl flex-shrink-0">🔒</span>
                                                <div className="min-w-0 text-sm text-slate-600">
                                                    <div className="font-bold text-slate-800 mb-0.5">{t('payOnline')}</div>
                                                    {t('securedByChapa')}
                                                </div>
                                            </div>
                                        ) : activeTarget && (
                                            /* Manual — account details + verification form */
                                            <div className="space-y-4">
                                                {manualInstructions && (
                                                    <div className="bg-sky-50 border border-sky-100 rounded-xl p-3 text-xs text-sky-800 leading-relaxed">{manualInstructions}</div>
                                                )}

                                                {/* Dynamic account details card */}
                                                <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-4">
                                                    <div className="flex items-center gap-2.5 mb-3">
                                                        <span className="w-10 h-10 rounded-xl bg-white border border-emerald-100 flex items-center justify-center text-xl flex-shrink-0">{KIND_ICON[activeTarget.kind]}</span>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-bold text-slate-800 truncate">{activeTarget.label}</div>
                                                            {activeTarget.holder && <div className="text-[11px] text-slate-500 truncate">{activeTarget.holder}</div>}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 rounded-xl bg-white border border-gray-100 p-1.5 pl-3.5">
                                                        <span className="flex-1 min-w-0 font-mono text-base sm:text-lg font-bold text-slate-900 tracking-wide truncate">{activeTarget.number}</span>
                                                        <button
                                                            onClick={() => copyToClipboard(activeTarget.number, activeTarget.id)}
                                                            className={`flex-shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${copiedKey === activeTarget.id ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
                                                        >
                                                            {copiedKey === activeTarget.id ? (
                                                                <><CheckIcon className="w-3.5 h-3.5" />{t('copied')}!</>
                                                            ) : (
                                                                <>📋 {t('copy')}</>
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Transaction reference (required) */}
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('txReference')} <span className="text-red-500">*</span></label>
                                                    <input
                                                        type="text"
                                                        value={reference}
                                                        onChange={(e) => setReference(e.target.value)}
                                                        maxLength={200}
                                                        className="w-full px-3 py-2.5 bg-white border-2 border-gray-100 rounded-xl focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 text-sm text-slate-900 outline-none transition-all"
                                                        placeholder={t('txReferencePlaceholderChannel', { channel: activeTarget.label })}
                                                    />
                                                </div>

                                                {/* Receipt drag-and-drop / upload (required) */}
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                                        {t('uploadReceipt')} <span className="text-red-500">*</span>
                                                    </label>
                                                    {receiptFile ? (
                                                        <div className="flex items-center gap-3 p-2.5 rounded-xl border-2 border-emerald-200 bg-emerald-50">
                                                            {receiptPreview ? (
                                                                <img src={receiptPreview} alt="" className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-emerald-200" />
                                                            ) : (
                                                                <span className="w-11 h-11 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0">📄</span>
                                                            )}
                                                            <div className="min-w-0 flex-1">
                                                                <div className="text-sm font-medium text-slate-800 truncate">{receiptFile.name}</div>
                                                                <div className="text-[11px] text-slate-500">{(receiptFile.size / 1024).toFixed(0)} KB</div>
                                                            </div>
                                                            <button onClick={() => onSelectReceipt(null)} aria-label={t('remove')}
                                                                className="flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 flex items-center justify-center transition-all">
                                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <label
                                                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                                            onDragLeave={() => setIsDragging(false)}
                                                            onDrop={(e) => { e.preventDefault(); setIsDragging(false); onSelectReceipt(e.dataTransfer.files?.[0] || null); }}
                                                            className={`flex flex-col items-center justify-center gap-1 border-dashed border-2 rounded-xl p-5 text-center cursor-pointer transition-all ${isDragging ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50 hover:border-emerald-300'}`}>
                                                            <svg className={`w-6 h-6 ${isDragging ? 'text-emerald-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                            </svg>
                                                            <span className="text-sm font-medium text-slate-600">{t('dropReceiptHere')}</span>
                                                            <span className="text-[11px] text-slate-400">{t('receiptHint')}</span>
                                                            <input type="file" accept="image/*,application/pdf" className="hidden"
                                                                onChange={(e) => onSelectReceipt(e.target.files?.[0] || null)} />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ===== Fixed footer (Step 2 only — Step 1 cards carry their own CTAs) ===== */}
                {step === 2 && (
                <div className="shrink-0 border-t border-gray-100 bg-white">
                    {error && (
                        <div className="px-4 sm:px-5 pt-3">
                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                                <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <span className="text-sm text-red-700">{error}</span>
                            </div>
                        </div>
                    )}

                    <div className="p-4 space-y-2">
                        {effectiveMethod === 'none' ? (
                            <button onClick={onClose}
                                className="w-full py-3.5 rounded-2xl font-bold text-sm sm:text-base bg-slate-800 hover:bg-slate-700 text-white transition-all">
                                {t('done')}
                            </button>
                        ) : isChapaSelected ? (
                            <button
                                onClick={handleChapaPayment}
                                disabled={isLoading || !canContinue}
                                className={`w-full py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all transform active:scale-[0.98] ${isLoading || !canContinue
                                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30'}`}
                            >
                                {isLoading ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        {t('processing')}
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">🔒 {t('payWithChapa', { amount: finalAmount })}</span>
                                )}
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={handleManualSubmit}
                                    disabled={isLoading || !canContinue || manualIncomplete}
                                    className={`w-full py-3.5 rounded-2xl font-bold text-sm sm:text-base transition-all transform active:scale-[0.98] ${isLoading || !canContinue || manualIncomplete
                                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/30'}`}
                                >
                                    {isLoading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            {t('submitting')}
                                        </span>
                                    ) : (
                                        t('submitForConfirmation', { amount: finalAmount })
                                    )}
                                </button>
                                {manualIncomplete && !isLoading && (
                                    <p className="text-[11px] text-amber-600 text-center">{t('verifyPaymentHelper')}</p>
                                )}
                            </>
                        )}
                    </div>
                </div>
                )}
            </div>
        </div>
    );
};

export default PaymentModal;
