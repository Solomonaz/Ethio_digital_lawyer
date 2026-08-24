import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../constants';
import { exportToPdf, exportToWord } from '../utils/documentExport';

interface DocumentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRecharge: () => void;
}

// `key` and `name` are STABLE English identifiers sent to the backend (do not localize).
// `labelKey` / `descKey` / `nameKey` / `phKey` are i18n keys used only for display.
interface DocField { key: string; type: 'text' | 'textarea' | 'date' | 'number'; labelKey: string; phKey?: string; required?: boolean; }
interface DocTemplate { id: string; name: string; nameKey: string; icon: string; descKey: string; fields: DocField[]; }

const TEMPLATES: DocTemplate[] = [
    {
        id: 'poa', name: 'Power of Attorney', nameKey: 'docPoaName', icon: '📝',
        descKey: 'docPoaDesc',
        fields: [
            { key: 'Principal (grantor) full name', type: 'text', required: true, labelKey: 'fPoaPrincipal', phKey: 'phPoaPrincipal' },
            { key: 'Agent (attorney) full name', type: 'text', required: true, labelKey: 'fPoaAgent', phKey: 'phPoaAgent' },
            { key: 'Powers granted', type: 'textarea', required: true, labelKey: 'fPoaPowers', phKey: 'phPoaPowers' },
            { key: 'City', type: 'text', labelKey: 'fCity', phKey: 'phCity' },
        ],
    },
    {
        id: 'employment', name: 'Employment Contract', nameKey: 'docEmploymentName', icon: '💼',
        descKey: 'docEmploymentDesc',
        fields: [
            { key: 'Employer name', type: 'text', required: true, labelKey: 'fEmpEmployer' },
            { key: 'Employee name', type: 'text', required: true, labelKey: 'fEmpEmployee' },
            { key: 'Job position', type: 'text', required: true, labelKey: 'fEmpPosition', phKey: 'phEmpPosition' },
            { key: 'Monthly salary (ETB)', type: 'number', labelKey: 'fEmpSalary', phKey: 'phEmpSalary' },
            { key: 'Start date', type: 'date', labelKey: 'fStartDate' },
            { key: 'Contract type', type: 'text', labelKey: 'fEmpType', phKey: 'phEmpType' },
        ],
    },
    {
        id: 'lease', name: 'Residential Lease Agreement', nameKey: 'docLeaseName', icon: '🏠',
        descKey: 'docLeaseDesc',
        fields: [
            { key: 'Landlord name', type: 'text', required: true, labelKey: 'fLeaseLandlord' },
            { key: 'Tenant name', type: 'text', required: true, labelKey: 'fLeaseTenant' },
            { key: 'Property address', type: 'textarea', required: true, labelKey: 'fLeaseAddress' },
            { key: 'Monthly rent (ETB)', type: 'number', labelKey: 'fLeaseRent' },
            { key: 'Lease duration', type: 'text', labelKey: 'fLeaseDuration', phKey: 'phLeaseDuration' },
            { key: 'Start date', type: 'date', labelKey: 'fStartDate' },
        ],
    },
    {
        id: 'demand', name: 'Demand / Payment Letter', nameKey: 'docDemandName', icon: '📨',
        descKey: 'docDemandDesc',
        fields: [
            { key: 'Your full name', type: 'text', required: true, labelKey: 'fYourFullName' },
            { key: 'Recipient (debtor) name', type: 'text', required: true, labelKey: 'fDemDebtor' },
            { key: 'Amount owed (ETB)', type: 'number', required: true, labelKey: 'fDemAmount' },
            { key: 'Reason for the debt', type: 'textarea', required: true, labelKey: 'fDemReason' },
            { key: 'Payment deadline', type: 'date', labelKey: 'fDemDeadline' },
        ],
    },
    {
        id: 'affidavit', name: 'Affidavit / Sworn Declaration', nameKey: 'docAffidavitName', icon: '📜',
        descKey: 'docAffidavitDesc',
        fields: [
            { key: 'Declarant full name', type: 'text', required: true, labelKey: 'fAffDeclarant' },
            { key: 'Statement of facts', type: 'textarea', required: true, labelKey: 'fAffFacts', phKey: 'phAffFacts' },
            { key: 'City', type: 'text', labelKey: 'fCity' },
        ],
    },
    {
        id: 'resignation', name: 'Resignation Letter', nameKey: 'docResignationName', icon: '✍️',
        descKey: 'docResignationDesc',
        fields: [
            { key: 'Your full name', type: 'text', required: true, labelKey: 'fYourFullName' },
            { key: 'Employer / company name', type: 'text', required: true, labelKey: 'fResEmployer' },
            { key: 'Your position', type: 'text', required: true, labelKey: 'fResPosition' },
            { key: 'Last working day', type: 'date', labelKey: 'fResLastDay' },
            { key: 'Reason (optional)', type: 'text', labelKey: 'fResReason' },
        ],
    },
];

const DocumentsModal: React.FC<DocumentsModalProps> = ({ isOpen, onClose, onRecharge }) => {
    const { t } = useTranslation();
    const [selected, setSelected] = useState<DocTemplate | null>(null);
    const [values, setValues] = useState<Record<string, string>>({});
    const [docLang, setDocLang] = useState<'en' | 'am'>('en');
    const [generating, setGenerating] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [needsRecharge, setNeedsRecharge] = useState(false);
    const [exporting, setExporting] = useState<'pdf' | 'word' | null>(null);
    const [copied, setCopied] = useState(false);
    // Custom document state
    const [customName, setCustomName] = useState('');
    const [customDescription, setCustomDescription] = useState('');
    const [customFields, setCustomFields] = useState<{ label: string; value: string }[]>([]);

    if (!isOpen) return null;

    const CUSTOM: DocTemplate = { id: 'custom', name: 'Custom Document', nameKey: 'customDocument', icon: '✨', descKey: 'customDocumentDesc', fields: [] };
    const isCustom = selected?.id === 'custom';
    // Localized title of the current selection (for the modal header).
    const selectedTitle = selected ? (isCustom ? (customName.trim() || t('customDocument')) : t(selected.nameKey)) : '';

    const clearCustom = () => { setCustomName(''); setCustomDescription(''); setCustomFields([]); };
    const reset = () => { setSelected(null); setValues({}); setResult(null); setError(''); setNeedsRecharge(false); clearCustom(); };
    const closeAll = () => { reset(); onClose(); };

    const pickTemplate = (tpl: DocTemplate) => { setSelected(tpl); setValues({}); setResult(null); setError(''); setNeedsRecharge(false); clearCustom(); };

    const missingRequired = isCustom
        ? !customName.trim()
        : selected ? selected.fields.some(f => f.required && !(values[f.key] || '').trim()) : true;

    const generate = async () => {
        if (!selected) return;
        setError(''); setNeedsRecharge(false); setGenerating(true);
        try {
            const token = localStorage.getItem('token');

            let templateName = selected.name;
            let fieldsPayload: Record<string, string> = values;
            if (isCustom) {
                templateName = customName.trim();
                fieldsPayload = {};
                if (customDescription.trim()) fieldsPayload['Details / instructions'] = customDescription.trim();
                for (const f of customFields) {
                    if (f.label.trim()) fieldsPayload[f.label.trim()] = f.value;
                }
            }

            const res = await fetch(`${API_URL}/documents/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ template_id: selected.id, template_name: templateName, language: docLang, fields: fieldsPayload }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 402) setNeedsRecharge(true);
                throw new Error(typeof data.detail === 'string' ? data.detail : 'Failed to generate the document.');
            }
            setResult(data.document);
        } catch (err: any) {
            setError(err.message || 'Something went wrong.');
        } finally {
            setGenerating(false);
        }
    };

    const doExport = async (kind: 'pdf' | 'word') => {
        if (!result || !selected) return;
        setExporting(kind);
        const docTitle = isCustom ? (customName.trim() || 'Custom Document') : selected.name;
        try {
            if (kind === 'word') exportToWord(docTitle, result);
            else await exportToPdf(docTitle, result);
        } catch (e) {
            setError('Export failed. Please try again.');
        } finally {
            setExporting(null);
        }
    };

    const copyDoc = () => { if (result) { navigator.clipboard.writeText(result); setCopied(true); setTimeout(() => setCopied(false), 2000); } };

    const step: 'gallery' | 'form' | 'result' = result ? 'result' : selected ? 'form' : 'gallery';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-in">

                {/* Header */}
                <div className="relative px-6 py-5 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex-shrink-0">
                    <div className="absolute top-0 left-0 right-0 h-1 eth-flag-stripe"></div>
                    <button aria-label={t('close')} onClick={closeAll} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full text-white/70 hover:text-white hover:bg-white/20 transition-all">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="flex items-center gap-3">
                        {step !== 'gallery' && (
                            <button aria-label={t('back')} onClick={() => (result ? setResult(null) : reset())} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            </button>
                        )}
                        <span className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg">{selected ? selected.icon : '📄'}</span>
                        <div>
                            <h2 className="text-lg font-bold text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                                {step === 'gallery' ? t('legalDocuments') : selectedTitle}
                            </h2>
                            <p className="text-white/50 text-xs">
                                {step === 'gallery' ? t('documentsSubtitle') : step === 'form' ? t('fillDetails') : t('reviewDownload')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'gallery' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {TEMPLATES.map(tpl => (
                                <button key={tpl.id} onClick={() => pickTemplate(tpl)}
                                    className="text-left p-4 rounded-2xl border-2 border-slate-100 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 transition-all group">
                                    <div className="flex items-start gap-3">
                                        <span className="w-11 h-11 rounded-xl bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center text-xl flex-shrink-0 transition-colors">{tpl.icon}</span>
                                        <div className="min-w-0">
                                            <div className="font-bold text-slate-800 text-sm">{t(tpl.nameKey)}</div>
                                            <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">{t(tpl.descKey)}</div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                            {/* Custom document — build your own */}
                            <button onClick={() => pickTemplate(CUSTOM)}
                                className="text-left p-4 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50 transition-all group sm:col-span-2">
                                <div className="flex items-start gap-3">
                                    <span className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center text-xl flex-shrink-0">✨</span>
                                    <div className="min-w-0">
                                        <div className="font-bold text-emerald-800 text-sm">{t('customDocument')}</div>
                                        <div className="text-xs text-emerald-700/70 mt-0.5 leading-relaxed">{t('customDocumentDesc')}</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {step === 'form' && selected && (
                        <div className="space-y-4">
                            {/* Language toggle */}
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-slate-700">{t('documentLanguage')}</span>
                                <div className="flex bg-slate-100 p-1 rounded-lg">
                                    {(['en', 'am'] as const).map(l => (
                                        <button key={l} onClick={() => setDocLang(l)}
                                            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${docLang === l ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                                            {l === 'en' ? 'English' : 'አማርኛ'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {isCustom ? (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('customDocumentType')} <span className="text-red-500">*</span></label>
                                        <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={t('customTypePlaceholder')}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('describeDocument')} <span className="text-slate-400 normal-case">({t('optional')})</span></label>
                                        <textarea value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} rows={3} placeholder={t('describeDocumentPlaceholder')}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-y" />
                                    </div>
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-medium text-slate-500">{t('customFields')} <span className="text-slate-400">({t('optional')})</span></label>
                                            <button type="button" onClick={() => setCustomFields([...customFields, { label: '', value: '' }])} className="text-xs font-semibold text-emerald-600 hover:text-emerald-700">＋ {t('addField')}</button>
                                        </div>
                                        <div className="space-y-2">
                                            {customFields.map((f, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <input value={f.label} onChange={(e) => { const n = [...customFields]; n[i] = { ...n[i], label: e.target.value }; setCustomFields(n); }} placeholder={t('fieldNamePlaceholder')}
                                                        className="w-2/5 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                                    <input value={f.value} onChange={(e) => { const n = [...customFields]; n[i] = { ...n[i], value: e.target.value }; setCustomFields(n); }} placeholder={t('fieldValuePlaceholder')}
                                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                                    <button type="button" aria-label={t('remove')} onClick={() => setCustomFields(customFields.filter((_, j) => j !== i))}
                                                        className="w-9 flex-shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all">✕</button>
                                                </div>
                                            ))}
                                            {customFields.length === 0 && <p className="text-[11px] text-slate-400">{t('customFieldsHint')}</p>}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    {selected.fields.map(f => (
                                        <div key={f.key}>
                                            <label className="block text-xs font-medium text-slate-500 mb-1.5">
                                                {t(f.labelKey)} {f.required && <span className="text-red-500">*</span>}
                                            </label>
                                            {f.type === 'textarea' ? (
                                                <textarea value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} rows={3} placeholder={f.phKey ? t(f.phKey) : undefined}
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-y" />
                                            ) : (
                                                <input type={f.type} value={values[f.key] || ''} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} placeholder={f.phKey ? t(f.phKey) : undefined}
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                            )}
                                        </div>
                                    ))}
                                    <p className="text-[11px] text-slate-400">{t('documentsPlaceholderHint')}</p>
                                </>
                            )}

                            {error && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700 flex items-center gap-2">
                                    <span>{error}</span>
                                    {needsRecharge && <button onClick={() => { closeAll(); onRecharge(); }} className="ml-auto text-emerald-700 font-semibold hover:underline whitespace-nowrap">{t('addFunds')}</button>}
                                </div>
                            )}

                            <button onClick={generate} disabled={generating || missingRequired}
                                className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all shadow-lg ${generating || missingRequired ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white shadow-emerald-500/30'}`}>
                                {generating ? (
                                    <span className="flex items-center justify-center gap-2"><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />{t('generatingDocument')}</span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">✨ {t('generateDocument')}</span>
                                )}
                            </button>
                        </div>
                    )}

                    {step === 'result' && result && (
                        <div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 max-h-[46vh] overflow-y-auto">
                                <div className="markdown-body prose prose-sm prose-slate max-w-none prose-headings:font-serif">
                                    <ReactMarkdown>{result}</ReactMarkdown>
                                </div>
                            </div>
                            <p className="text-[11px] text-slate-400 italic mt-2">{t('documentDraftDisclaimer')}</p>
                        </div>
                    )}
                </div>

                {/* Footer (result actions) */}
                {step === 'result' && (
                    <div className="flex-shrink-0 border-t border-slate-100 px-6 py-4 flex flex-wrap items-center gap-2">
                        <button onClick={() => doExport('word')} disabled={exporting !== null}
                            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50">
                            {exporting === 'word' ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : '⬇'} {t('downloadWord')}
                        </button>
                        {!/[ሀ-፿]/.test(result || '') && (
                            <button onClick={() => doExport('pdf')} disabled={exporting !== null}
                                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-sm transition-all shadow-md disabled:opacity-50">
                                {exporting === 'pdf' ? <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : '⬇'} {t('downloadPdf')}
                            </button>
                        )}
                        {/[ሀ-፿]/.test(result || '') && (
                            <span className="text-[11px] text-slate-400 italic">{t('amharicPdfHint')}</span>
                        )}
                        <button onClick={copyDoc} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold text-sm transition-all">
                            {copied ? `✓ ${t('copied')}` : t('copy')}
                        </button>
                        <button onClick={() => { setResult(null); }} className="ml-auto text-sm text-slate-500 hover:text-slate-700 font-medium">{t('editDetails')}</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentsModal;
