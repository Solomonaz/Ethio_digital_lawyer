import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../constants';

interface AdminUser {
    id: number;
    username: string;
    email: string;
    balance: number;
    total_cost?: number; // Added for Cost Tracking
    is_admin: boolean;
    is_active: boolean;
    created_at: string;
    subscription_expires_at?: string; // For 24h subscriber detection
    monthly_subscription_expires_at?: string; // For monthly subscriber detection
}

interface AdminPayment {
    id: number;
    user_id: number;
    username: string;
    amount: number;
    tx_ref: string;
    status: string;
    payment_type: string;
    method?: string;
    reference?: string;
    has_receipt?: boolean;
    created_at: string;
}

interface AdminSetting {
    id: number;
    key: string;
    value: string;
    description: string;
}

interface LegalProvisionRow {
    id: number;
    law_code: string;
    article?: string | null;
    title?: string | null;
    content: string;
    language: string;
    source_url?: string | null;
    is_active: boolean;
    has_embedding: boolean;
    created_at?: string;
}

interface AdminDashboardProps {
    onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'users' | 'payments' | 'settings' | 'legal'>('users');
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [payments, setPayments] = useState<AdminPayment[]>([]);
    const [settings, setSettings] = useState<AdminSetting[]>([]);

    // Legal Library (RAG knowledge base) state
    const [provisions, setProvisions] = useState<LegalProvisionRow[]>([]);
    const [savingProvision, setSavingProvision] = useState(false);
    const [confirmDeleteProvision, setConfirmDeleteProvision] = useState<number | null>(null);
    const emptyProvision = { law_code: '', article: '', title: '', content: '', language: 'en', source_url: '' };
    const [newProvision, setNewProvision] = useState({ ...emptyProvision });

    // Model Pricing State
    const [modelName, setModelName] = useState('gemini-3-pro-preview');
    const [inputCost, setInputCost] = useState('240');
    const [outputCost, setOutputCost] = useState('1440');
    const [minBalance, setMinBalance] = useState('10.0');
    const [subPrice, setSubPrice] = useState('100'); // Default 24h subscription price
    const [dailyQuota, setDailyQuota] = useState('100'); // Default 24h subscriber daily limit
    const [monthlyPrice, setMonthlyPrice] = useState('500'); // Default monthly subscription price
    const [monthlyQuota, setMonthlyQuota] = useState('100'); // Default monthly subscriber daily limit
    const [quotaResetHours, setQuotaResetHours] = useState('24'); // Quota reset interval in hours

    // Payment method + manual payment + contact configuration
    const [chapaEnabled, setChapaEnabled] = useState(true);
    const [telebirrEnabled, setTelebirrEnabled] = useState(true);
    const [safaricomEnabled, setSafaricomEnabled] = useState(true);
    const [bankEnabled, setBankEnabled] = useState(true);
    const [manualInstructions, setManualInstructions] = useState('');
    const [telebirrNumber, setTelebirrNumber] = useState('');
    const [telebirrName, setTelebirrName] = useState('');
    const [safaricomNumber, setSafaricomNumber] = useState('');
    const [safaricomName, setSafaricomName] = useState('');
    // Banks are a list — the admin can add as many as they like.
    const [bankAccounts, setBankAccounts] = useState<Array<{ label: string; number: string; holder: string }>>([]);
    const [adminContactPhone, setAdminContactPhone] = useState('');
    const [adminContactTelegram, setAdminContactTelegram] = useState('');
    const [adminContactEmail, setAdminContactEmail] = useState('');
    const [savingPayment, setSavingPayment] = useState(false);
    const [viewingReceipt, setViewingReceipt] = useState<number | null>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

    // Pagination state for payments
    const [paymentsPage, setPaymentsPage] = useState(1);
    const paymentsPerPage = 10;

    // Pagination state for users
    const [usersPage, setUsersPage] = useState(1);
    const usersPerPage = 10;

    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        else if (activeTab === 'payments') fetchPayments();
        else if (activeTab === 'settings') fetchSettings();
        else if (activeTab === 'legal') fetchProvisions();
    }, [activeTab]);

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    const fetchUsers = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/admin/users`, { headers });
            if (!res.ok) throw new Error('Failed to fetch users');
            setUsers(await res.json());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchPayments = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/admin/payments`, { headers });
            if (!res.ok) throw new Error('Failed to fetch payments');
            setPayments(await res.json());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/admin/settings`, { headers });
            if (!res.ok) throw new Error('Failed to fetch settings');
            const data = await res.json();
            setSettings(data);


            // Parse settings into state
            const modelSetting = data.find((s: AdminSetting) => s.key === 'model_name');
            if (modelSetting) setModelName(modelSetting.value);

            const inputSetting = data.find((s: AdminSetting) => s.key === 'cost_input_1m');
            if (inputSetting) setInputCost(inputSetting.value);

            const outputSetting = data.find((s: AdminSetting) => s.key === 'cost_output_1m');
            if (outputSetting) setOutputCost(outputSetting.value);

            const minBalanceSetting = data.find((s: AdminSetting) => s.key === 'min_search_balance');
            if (minBalanceSetting) setMinBalance(minBalanceSetting.value);

            const subPriceSetting = data.find((s: AdminSetting) => s.key === 'subscription_24h_price');
            if (subPriceSetting) setSubPrice(subPriceSetting.value);

            const dailyQuotaSetting = data.find((s: AdminSetting) => s.key === 'subscription_daily_quota');
            if (dailyQuotaSetting) setDailyQuota(dailyQuotaSetting.value);

            const monthlyPriceSetting = data.find((s: AdminSetting) => s.key === 'subscription_monthly_price');
            if (monthlyPriceSetting) setMonthlyPrice(monthlyPriceSetting.value);

            const monthlyQuotaSetting = data.find((s: AdminSetting) => s.key === 'subscription_monthly_quota');
            if (monthlyQuotaSetting) setMonthlyQuota(monthlyQuotaSetting.value);

            const quotaResetHoursSetting = data.find((s: AdminSetting) => s.key === 'quota_reset_hours');
            if (quotaResetHoursSetting) setQuotaResetHours(quotaResetHoursSetting.value);

            // Payment method + manual payment + contact settings
            const val = (key: string) => data.find((s: AdminSetting) => s.key === key)?.value;
            const isTrue = (v: any) => String(v).toLowerCase() === 'true';
            if (val('chapa_enabled') !== undefined) setChapaEnabled(isTrue(val('chapa_enabled')));
            if (val('telebirr_enabled') !== undefined) setTelebirrEnabled(isTrue(val('telebirr_enabled')));
            if (val('safaricom_enabled') !== undefined) setSafaricomEnabled(isTrue(val('safaricom_enabled')));
            if (val('bank_enabled') !== undefined) setBankEnabled(isTrue(val('bank_enabled')));
            if (val('manual_payment_instructions') !== undefined) setManualInstructions(val('manual_payment_instructions'));
            if (val('telebirr_number') !== undefined) setTelebirrNumber(val('telebirr_number'));
            if (val('telebirr_name') !== undefined) setTelebirrName(val('telebirr_name'));
            if (val('safaricom_number') !== undefined) setSafaricomNumber(val('safaricom_number'));
            if (val('safaricom_name') !== undefined) setSafaricomName(val('safaricom_name'));
            // Banks: prefer the JSON list; fall back to the single legacy bank_* fields.
            let banks: Array<{ label: string; number: string; holder: string }> = [];
            try { const raw = val('bank_accounts'); if (raw) banks = JSON.parse(raw); } catch { /* malformed — use legacy */ }
            if (!Array.isArray(banks) || banks.length === 0) {
                if ((val('bank_account') || '').trim())
                    banks = [{ label: val('bank_name') || '', number: val('bank_account') || '', holder: val('bank_holder') || '' }];
            }
            setBankAccounts(banks.map(b => ({ label: b.label || '', number: b.number || '', holder: b.holder || '' })));
            if (val('admin_contact_phone') !== undefined) setAdminContactPhone(val('admin_contact_phone'));
            if (val('admin_contact_telegram') !== undefined) setAdminContactTelegram(val('admin_contact_telegram'));
            if (val('admin_contact_email') !== undefined) setAdminContactEmail(val('admin_contact_email'));
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const savePaymentSettings = async () => {
        try {
            setSavingPayment(true);
            setError('');
            const put = (key: string, value: string, description: string) =>
                fetch(`${API_URL}/admin/settings/${key}`, {
                    method: 'PUT', headers, body: JSON.stringify({ value, description })
                });
            // Run sequentially to keep it simple and reliable
            await put('chapa_enabled', chapaEnabled ? 'true' : 'false', 'Enable the Chapa online payment option');
            await put('telebirr_enabled', telebirrEnabled ? 'true' : 'false', 'Enable the Telebirr manual payment option');
            await put('safaricom_enabled', safaricomEnabled ? 'true' : 'false', 'Enable the Safaricom / M-Pesa manual payment option');
            await put('bank_enabled', bankEnabled ? 'true' : 'false', 'Enable the bank transfer manual payment option');
            await put('manual_payment_instructions', manualInstructions, 'Instructions shown to users on the manual payment screen');
            await put('telebirr_number', telebirrNumber, 'Telebirr account phone number for manual payments');
            await put('telebirr_name', telebirrName, 'Telebirr account holder name');
            await put('safaricom_number', safaricomNumber, 'Safaricom / M-Pesa account phone number for manual payments');
            await put('safaricom_name', safaricomName, 'Safaricom / M-Pesa account holder name');
            // Persist the bank list as JSON; drop empty rows and trim fields.
            const cleanBanks = bankAccounts
                .map(b => ({ label: b.label.trim(), number: b.number.trim(), holder: b.holder.trim() }))
                .filter(b => b.number !== '');
            await put('bank_accounts', JSON.stringify(cleanBanks), 'List of bank accounts [{label, number, holder}] shown for manual payments');
            await put('admin_contact_phone', adminContactPhone, 'Admin phone number shown in Contact Admin');
            await put('admin_contact_telegram', adminContactTelegram, 'Admin Telegram username or link shown in Contact Admin');
            await put('admin_contact_email', adminContactEmail, 'Admin email address shown in Contact Admin');

            setSuccess('Payment & contact settings saved successfully!');
            fetchSettings();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSavingPayment(false);
        }
    };

    const viewReceipt = async (paymentId: number) => {
        setViewingReceipt(paymentId);
        setError('');
        try {
            const res = await fetch(`${API_URL}/admin/payments/${paymentId}/receipt`, { headers });
            if (!res.ok) throw new Error('Failed to load receipt');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
            // Revoke shortly after so the new tab has time to load it
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setViewingReceipt(null);
        }
    };

    // --- Legal Library (RAG knowledge base) ---
    const fetchProvisions = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/admin/legal`, { headers });
            if (!res.ok) throw new Error('Failed to fetch legal library');
            setProvisions(await res.json());
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const addProvision = async () => {
        if (!newProvision.law_code.trim() || !newProvision.content.trim()) {
            setError('Law name and provision text are required.');
            return;
        }
        setSavingProvision(true);
        setError('');
        try {
            const res = await fetch(`${API_URL}/admin/legal`, {
                method: 'POST', headers, body: JSON.stringify(newProvision)
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.detail || 'Failed to add provision');
            }
            setSuccess('Provision added to the legal library!');
            setNewProvision({ ...emptyProvision });
            fetchProvisions();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSavingProvision(false);
        }
    };

    const deleteProvision = async (id: number) => {
        try {
            const res = await fetch(`${API_URL}/admin/legal/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete provision');
            setSuccess('Provision deleted.');
            setConfirmDeleteProvision(null);
            fetchProvisions();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const updateBalance = async (userId: number, newBalance: string) => {
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}/balance`, {
                method: 'PUT', headers, body: JSON.stringify({ balance: parseFloat(newBalance) })
            });
            if (!res.ok) throw new Error('Failed to update balance');
            setSuccess('Balance updated!');
            fetchUsers();
        } catch (err: any) { setError(err.message); }
    };

    const toggleUserActive = async (userId: number) => {
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}/toggle-active`, {
                method: 'PUT', headers
            });
            if (!res.ok) throw new Error('Failed to toggle status');
            const data = await res.json();
            setSuccess(data.message);
            fetchUsers();
        } catch (err: any) { setError(err.message); }
    };

    const deleteUser = async (userId: number) => {
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}`, {
                method: 'DELETE', headers
            });
            if (!res.ok) throw new Error('Failed to delete user');
            setSuccess('User deleted!');
            setConfirmDelete(null);
            fetchUsers();
        } catch (err: any) { setError(err.message); }
    };

    const approvePayment = async (paymentId: number) => {
        try {
            const res = await fetch(`${API_URL}/admin/payments/${paymentId}/approve`, { method: 'PUT', headers });
            if (!res.ok) throw new Error('Failed to approve');
            setSuccess('Payment approved!');
            fetchPayments();
        } catch (err: any) { setError(err.message); }
    };

    const rejectPayment = async (paymentId: number) => {
        try {
            const res = await fetch(`${API_URL}/admin/payments/${paymentId}/reject`, { method: 'PUT', headers });
            if (!res.ok) throw new Error('Failed to reject');
            setSuccess('Payment rejected!');
            fetchPayments();
        } catch (err: any) { setError(err.message); }
    };

    const saveModelSettings = async () => {
        try {
            setLoading(true);
            // 1. Model Name
            await fetch(`${API_URL}/admin/settings/model_name`, {
                method: 'PUT', headers, body: JSON.stringify({ value: modelName, description: 'Active AI Model Name' })
            });
            // 2. Input Cost
            await fetch(`${API_URL}/admin/settings/cost_input_1m`, {
                method: 'PUT', headers, body: JSON.stringify({ value: inputCost, description: 'Cost in ETB per 1 Million Input Tokens' })
            });
            // 3. Output Cost
            await fetch(`${API_URL}/admin/settings/cost_output_1m`, {
                method: 'PUT', headers, body: JSON.stringify({ value: outputCost, description: 'Cost in ETB per 1 Million Output Tokens' })
            });
            // 4. Min Balance
            await fetch(`${API_URL}/admin/settings/min_search_balance`, {
                method: 'PUT', headers, body: JSON.stringify({ value: minBalance, description: 'Minimum Balance Required to Search' })
            });
            // 5. Subscription Price
            await fetch(`${API_URL}/admin/settings/subscription_24h_price`, {
                method: 'PUT', headers, body: JSON.stringify({ value: subPrice, description: 'Price for 24-hour subscription (ETB)' })
            });
            // 6. Subscriber Daily Quota
            await fetch(`${API_URL}/admin/settings/subscription_daily_quota`, {
                method: 'PUT', headers, body: JSON.stringify({ value: dailyQuota, description: 'Maximum questions per day for 24h subscribers' })
            });
            // 7. Monthly Subscription Price
            await fetch(`${API_URL}/admin/settings/subscription_monthly_price`, {
                method: 'PUT', headers, body: JSON.stringify({ value: monthlyPrice, description: 'Price for monthly subscription (ETB)' })
            });
            // 8. Monthly Subscriber Daily Quota
            await fetch(`${API_URL}/admin/settings/subscription_monthly_quota`, {
                method: 'PUT', headers, body: JSON.stringify({ value: monthlyQuota, description: 'Maximum questions per day for monthly subscribers' })
            });
            // 9. Quota Reset Hours
            await fetch(`${API_URL}/admin/settings/quota_reset_hours`, {
                method: 'PUT', headers, body: JSON.stringify({ value: quotaResetHours, description: 'How often the question limit resets (in hours)' })
            });

            setSuccess('Pricing settings saved successfully!');
            fetchSettings();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const stats = {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.is_active).length,
        pendingPayments: payments.filter(p => p.status === 'pending').length,
        totalRevenue: payments.filter(p => p.status === 'success').reduce((sum, p) => sum + p.amount, 0),
        totalSystemCost: users.reduce((sum, u) => sum + (u.total_cost || 0), 0)
    };

    // Pagination calculations for payments
    const totalPaymentsPages = Math.ceil(payments.length / paymentsPerPage);
    const paginatedPayments = payments.slice(
        (paymentsPage - 1) * paymentsPerPage,
        paymentsPage * paymentsPerPage
    );

    // Pagination calculations for users
    const totalUsersPages = Math.ceil(users.length / usersPerPage);
    const paginatedUsers = users.slice(
        (usersPage - 1) * usersPerPage,
        usersPage * usersPerPage
    );

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-50 via-white to-green-50 z-50 overflow-auto">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                            {t('backToChat')}
                        </button>
                        <div className="h-6 w-px bg-slate-200"></div>
                        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm">⚡</span>
                            {t('adminDashboard')}
                        </h1>
                    </div>
                    <div className="text-sm text-slate-500">{t('ethioLexAdmin')}</div>
                </div>
            </header>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                        <div className="text-slate-500 text-sm font-medium mb-1">👥 {t('totalUsers')}</div>
                        <div className="text-3xl font-bold text-slate-900">{stats.totalUsers}</div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                        <div className="text-slate-500 text-sm font-medium mb-1">✓ {t('activeUsers')}</div>
                        <div className="text-3xl font-bold text-green-600">{stats.activeUsers}</div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                        <div className="text-slate-500 text-sm font-medium mb-1">⏳ {t('pending')}</div>
                        <div className="text-3xl font-bold text-yellow-600">{stats.pendingPayments}</div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                        <div className="text-slate-500 text-sm font-medium mb-1">📈 {t('revenue')}</div>
                        <div className="text-3xl font-bold text-purple-600">{stats.totalRevenue.toFixed(0)} <span className="text-base text-slate-400">ETB</span></div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm border-l-4 border-l-red-400">
                        <div className="text-slate-500 text-sm font-medium mb-1">💸 Total API Cost</div>
                        <div className="text-3xl font-bold text-slate-700">{stats.totalSystemCost.toFixed(2)} <span className="text-base text-slate-400">ETB</span></div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6 border-b border-slate-200 pb-4">
                    {[{ key: 'users', label: t('users'), icon: '👥' }, { key: 'payments', label: t('payments'), icon: '💳' }, { key: 'legal', label: t('legalLibrary'), icon: '📚' }, { key: 'settings', label: t('settings'), icon: '⚙️' }].map((tab) => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 ${activeTab === tab.key ? 'bg-green-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                            <span>{tab.icon}</span>{tab.label}
                        </button>
                    ))}
                </div>

                {/* Messages */}
                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>{error}<button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">✕</button></div>}
                {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>{success}</div>}

                {/* Content */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div></div>
                    ) : activeTab === 'users' ? (
                        <>
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('username')}</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('email')}</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">Plan Type</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('balance')}</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">Est. Cost</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('status')}</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedUsers.map((u) => (
                                        <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${!u.is_active ? 'opacity-60' : ''}`}>
                                            <td className="p-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm ${u.is_admin ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 'bg-gradient-to-br from-green-400 to-emerald-500'}`}>
                                                        {u.username.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-slate-900 font-medium flex items-center gap-2">
                                                            {u.username}
                                                            {u.is_admin && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{t('admin')}</span>}
                                                        </div>
                                                        <div className="text-slate-400 text-xs">ID: {u.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-slate-600">{u.email || <span className="text-slate-400">—</span>}</td>
                                            <td className="p-4">
                                                {(() => {
                                                    const now = new Date();
                                                    const has24hSub = u.subscription_expires_at && new Date(u.subscription_expires_at) > now;
                                                    const hasMonthlySub = u.monthly_subscription_expires_at && new Date(u.monthly_subscription_expires_at) > now;

                                                    if (hasMonthlySub) {
                                                        const expiresAt = new Date(u.monthly_subscription_expires_at!);
                                                        const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
                                                        return (
                                                            <div className="flex flex-col">
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                                                                    <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-1.5 animate-pulse"></span>
                                                                    Monthly Subscriber
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 mt-1">{daysLeft}d left</span>
                                                            </div>
                                                        );
                                                    } else if (has24hSub) {
                                                        const expiresAt = new Date(u.subscription_expires_at!);
                                                        const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
                                                        return (
                                                            <div className="flex flex-col">
                                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                                                                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-1.5 animate-pulse"></span>
                                                                    24h Subscriber
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 mt-1">{hoursLeft}h left</span>
                                                            </div>
                                                        );
                                                    } else {
                                                        return (
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
                                                                Pay as you go
                                                            </span>
                                                        );
                                                    }
                                                })()}
                                            </td>
                                            <td className="p-4">
                                                {(() => {
                                                    const now = new Date();
                                                    const hasMonthlySub = u.monthly_subscription_expires_at && new Date(u.monthly_subscription_expires_at) > now;
                                                    const has24hSub = u.subscription_expires_at && new Date(u.subscription_expires_at) > now;

                                                    if (hasMonthlySub || has24hSub) {
                                                        return (
                                                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-500">
                                                                — Subscriber
                                                            </span>
                                                        );
                                                    }

                                                    return (
                                                        <div className="flex items-center gap-2">
                                                            <input type="number" defaultValue={u.balance || 0} className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 text-sm focus:ring-2 focus:ring-green-500" onBlur={(e) => updateBalance(u.id, e.target.value)} />
                                                            <span className="text-slate-400 text-sm">ETB</span>
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td className="p-4">
                                                <div className="font-mono text-sm text-slate-600 font-bold">
                                                    {(u.total_cost || 0).toFixed(4)} ETB
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {u.is_active ? '✓ Active' : '✕ Inactive'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {!u.is_admin && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => toggleUserActive(u.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${u.is_active ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700' : 'bg-green-100 hover:bg-green-200 text-green-700'}`}>
                                                            {u.is_active ? t('deactivate') : t('activate')}
                                                        </button>
                                                        {confirmDelete === u.id ? (
                                                            <div className="flex gap-1">
                                                                <button onClick={() => deleteUser(u.id)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium">{t('confirm')}</button>
                                                                <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium">{t('cancel')}</button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => setConfirmDelete(u.id)} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium">🗑 {t('delete')}</button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Pagination Controls for Users */}
                            {users.length > usersPerPage && (
                                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                                    <div className="text-sm text-slate-500">
                                        Showing {((usersPage - 1) * usersPerPage) + 1} - {Math.min(usersPage * usersPerPage, users.length)} of {users.length} users
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setUsersPage(1)}
                                            disabled={usersPage === 1}
                                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            ««
                                        </button>
                                        <button
                                            onClick={() => setUsersPage(p => Math.max(1, p - 1))}
                                            disabled={usersPage === 1}
                                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            «
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, totalUsersPages) }, (_, i) => {
                                                let pageNum;
                                                if (totalUsersPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (usersPage <= 3) {
                                                    pageNum = i + 1;
                                                } else if (usersPage >= totalUsersPages - 2) {
                                                    pageNum = totalUsersPages - 4 + i;
                                                } else {
                                                    pageNum = usersPage - 2 + i;
                                                }
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setUsersPage(pageNum)}
                                                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${usersPage === pageNum
                                                            ? 'bg-emerald-600 text-white shadow-md'
                                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button
                                            onClick={() => setUsersPage(p => Math.min(totalUsersPages, p + 1))}
                                            disabled={usersPage === totalUsersPages}
                                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            »
                                        </button>
                                        <button
                                            onClick={() => setUsersPage(totalUsersPages)}
                                            disabled={usersPage === totalUsersPages}
                                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            »»
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : activeTab === 'payments' ? (
                        <>
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('transaction')}</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('username')}</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('amount')}</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('type')}</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">Method</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('status')}</th>
                                        <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payments.length === 0 ? (
                                        <tr><td colSpan={7} className="p-12 text-center text-slate-400">{t('noPayments')}</td></tr>
                                    ) : paginatedPayments.map((p) => (
                                        <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                            <td className="p-4"><div className="font-mono text-sm text-slate-700">{p.tx_ref}</div><div className="text-slate-400 text-xs">ID: {p.id}</div></td>
                                            <td className="p-4 text-slate-700">{p.username}</td>
                                            <td className="p-4"><span className="text-slate-900 font-semibold">{p.amount}</span><span className="text-slate-400 ml-1">ETB</span></td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${p.payment_type === 'subscription_monthly' ? 'bg-purple-100 text-purple-700' :
                                                    p.payment_type === 'subscription_24h' ? 'bg-indigo-100 text-indigo-700' :
                                                        'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                    {p.payment_type === 'subscription_monthly' ? '📅 Monthly Pass' :
                                                        p.payment_type === 'subscription_24h' ? '⚡ 24h Pass' :
                                                            '💰 Recharge'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${p.method === 'manual' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                                                    {p.method === 'manual' ? '📱 Manual' : '💳 Chapa'}
                                                </span>
                                                {p.reference && (
                                                    <div className="text-[11px] text-slate-400 mt-1 max-w-[160px] truncate" title={p.reference}>{p.reference}</div>
                                                )}
                                                {p.has_receipt && (
                                                    <button
                                                        onClick={() => viewReceipt(p.id)}
                                                        disabled={viewingReceipt === p.id}
                                                        className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all disabled:opacity-50"
                                                    >
                                                        {viewingReceipt === p.id ? (
                                                            <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                                        )}
                                                        View Receipt
                                                    </button>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${p.status === 'success' ? 'bg-green-100 text-green-700' : p.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {p.status === 'success' ? `✓ ${t('successStatus')}` : p.status === 'failed' ? `✕ ${t('failedStatus')}` : `⏳ ${t('pending')}`}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {p.status === 'pending' && (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => approvePayment(p.id)} className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-xs font-medium">✓ {t('approve')}</button>
                                                        <button onClick={() => rejectPayment(p.id)} className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-xs font-medium">✕ {t('reject')}</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Pagination Controls */}
                            {payments.length > paymentsPerPage && (
                                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
                                    <div className="text-sm text-slate-500">
                                        Showing {((paymentsPage - 1) * paymentsPerPage) + 1} - {Math.min(paymentsPage * paymentsPerPage, payments.length)} of {payments.length} transactions
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setPaymentsPage(1)}
                                            disabled={paymentsPage === 1}
                                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            ««
                                        </button>
                                        <button
                                            onClick={() => setPaymentsPage(p => Math.max(1, p - 1))}
                                            disabled={paymentsPage === 1}
                                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            «
                                        </button>
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: Math.min(5, totalPaymentsPages) }, (_, i) => {
                                                let pageNum;
                                                if (totalPaymentsPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (paymentsPage <= 3) {
                                                    pageNum = i + 1;
                                                } else if (paymentsPage >= totalPaymentsPages - 2) {
                                                    pageNum = totalPaymentsPages - 4 + i;
                                                } else {
                                                    pageNum = paymentsPage - 2 + i;
                                                }
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setPaymentsPage(pageNum)}
                                                        className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${paymentsPage === pageNum
                                                            ? 'bg-emerald-600 text-white shadow-md'
                                                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button
                                            onClick={() => setPaymentsPage(p => Math.min(totalPaymentsPages, p + 1))}
                                            disabled={paymentsPage === totalPaymentsPages}
                                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            »
                                        </button>
                                        <button
                                            onClick={() => setPaymentsPage(totalPaymentsPages)}
                                            disabled={paymentsPage === totalPaymentsPages}
                                            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                        >
                                            »»
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : activeTab === 'legal' ? (
                        <div className="p-6 md:p-8 min-h-full">
                            <div className="max-w-4xl mx-auto space-y-6">
                                {/* Add provision card */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                                    <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5">
                                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                            <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">📚</span>
                                            Legal Library
                                        </h2>
                                        <p className="text-slate-400 text-sm mt-1">Verified Ethiopian legal provisions the AI is allowed to cite. Answers are grounded only in what you add here — so add accurate, sourced text.</p>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Law name <span className="text-red-500">*</span></label>
                                                <input type="text" value={newProvision.law_code} onChange={(e) => setNewProvision({ ...newProvision, law_code: e.target.value })} placeholder="e.g. Labour Proclamation No. 1156/2019"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Article</label>
                                                <input type="text" value={newProvision.article} onChange={(e) => setNewProvision({ ...newProvision, article: e.target.value })} placeholder="e.g. Article 35"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            <div className="md:col-span-2">
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Title / heading</label>
                                                <input type="text" value={newProvision.title} onChange={(e) => setNewProvision({ ...newProvision, title: e.target.value })} placeholder="e.g. Period of Notice for Termination"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Language</label>
                                                <select value={newProvision.language} onChange={(e) => setNewProvision({ ...newProvision, language: e.target.value })}
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all bg-white">
                                                    <option value="en">English</option>
                                                    <option value="am">አማርኛ</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Provision text <span className="text-red-500">*</span></label>
                                            <textarea value={newProvision.content} onChange={(e) => setNewProvision({ ...newProvision, content: e.target.value })} rows={4} placeholder="Paste the exact text of the legal provision…"
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-y" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 mb-1.5">Source URL (verifiable link)</label>
                                            <input type="text" value={newProvision.source_url} onChange={(e) => setNewProvision({ ...newProvision, source_url: e.target.value })} placeholder="https://…"
                                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                        </div>
                                        <div className="flex justify-end">
                                            <button onClick={addProvision} disabled={savingProvision}
                                                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed">
                                                {savingProvision ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="text-lg leading-none">＋</span>}
                                                Add to Library
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Library list */}
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-100">
                                        <h3 className="font-semibold text-slate-800">Library <span className="text-slate-400 font-normal">({provisions.length})</span></h3>
                                    </div>
                                    {provisions.length === 0 ? (
                                        <div className="p-12 text-center text-slate-400 text-sm">No provisions yet. Add the first one above — the AI will start citing it.</div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {provisions.map((p) => (
                                                <div key={p.id} className="p-4 hover:bg-slate-50 transition-colors">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className="text-sm font-bold text-slate-800">{p.law_code}</span>
                                                                {p.article && <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">{p.article}</span>}
                                                                <span className="text-[10px] uppercase text-slate-400 tracking-wide">{p.language}</span>
                                                                {!p.has_embedding && <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded">no embedding</span>}
                                                            </div>
                                                            {p.title && <div className="text-xs text-slate-500 mt-0.5">{p.title}</div>}
                                                            <p className="text-[13px] text-slate-600 mt-1.5 line-clamp-2">{p.content}</p>
                                                            {p.source_url && <a href={p.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-600 hover:underline mt-1 inline-block">Source ↗</a>}
                                                        </div>
                                                        <div className="flex-shrink-0">
                                                            {confirmDeleteProvision === p.id ? (
                                                                <div className="flex gap-1">
                                                                    <button onClick={() => deleteProvision(p.id)} className="px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-medium">{t('confirm')}</button>
                                                                    <button onClick={() => setConfirmDeleteProvision(null)} className="px-2.5 py-1 bg-slate-200 text-slate-600 rounded-lg text-xs font-medium">{t('cancel')}</button>
                                                                </div>
                                                            ) : (
                                                                <button aria-label="Delete provision" onClick={() => setConfirmDeleteProvision(p.id)} className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium">🗑</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 md:p-8 min-h-full">
                            {/* Single unified settings card */}
                            <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">⚙️</span>
                                        Platform Configuration
                                    </h2>
                                    <p className="text-slate-400 text-sm mt-1">Manage AI model, pricing, and subscription settings</p>
                                </div>

                                {/* Content */}
                                <div className="p-6 space-y-8">
                                    {/* AI Model Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-lg">🤖</span>
                                            <h3 className="font-semibold text-slate-800">AI Model</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="md:col-span-3">
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Model Name</label>
                                                <input
                                                    type="text"
                                                    value={modelName}
                                                    onChange={(e) => setModelName(e.target.value)}
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                                    placeholder="e.g. gemini-3-pro-preview"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Input Cost / 1M Tokens</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={inputCost}
                                                        onChange={(e) => setInputCost(e.target.value)}
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-14 text-slate-800 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">ETB</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Output Cost / 1M Tokens</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={outputCost}
                                                        onChange={(e) => setOutputCost(e.target.value)}
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-14 text-slate-800 text-sm font-mono focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">ETB</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">Min Search Balance</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={minBalance}
                                                        onChange={(e) => setMinBalance(e.target.value)}
                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-14 text-slate-800 text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">ETB</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-slate-100"></div>

                                    {/* Subscription Plans Section */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-lg">⚡</span>
                                            <h3 className="font-semibold text-slate-800">Subscription Plans</h3>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* 24h Pass */}
                                            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-4 border border-indigo-100">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                                                        <span className="text-white text-xs">24h</span>
                                                    </div>
                                                    <span className="font-semibold text-indigo-900 text-sm">24 Hour Pass</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-indigo-600/70 mb-1">Price</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                value={subPrice}
                                                                onChange={(e) => setSubPrice(e.target.value)}
                                                                className="w-full border border-indigo-200 bg-white rounded-lg px-3 py-2 pr-12 text-indigo-900 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 transition-all"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-indigo-400">ETB</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-indigo-600/70 mb-1">Questions per {quotaResetHours}h</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                value={dailyQuota}
                                                                onChange={(e) => setDailyQuota(e.target.value)}
                                                                className="w-full border border-indigo-200 bg-white rounded-lg px-3 py-2 pr-8 text-indigo-900 text-sm font-semibold focus:ring-2 focus:ring-indigo-500 transition-all"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-indigo-400">Q</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Monthly Pass */}
                                            <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-xl p-4 border border-purple-100">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center">
                                                        <span className="text-white text-xs">30d</span>
                                                    </div>
                                                    <span className="font-semibold text-purple-900 text-sm">Monthly Pass</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-purple-600/70 mb-1">Price</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                value={monthlyPrice}
                                                                onChange={(e) => setMonthlyPrice(e.target.value)}
                                                                className="w-full border border-purple-200 bg-white rounded-lg px-3 py-2 pr-12 text-purple-900 text-sm font-semibold focus:ring-2 focus:ring-purple-500 transition-all"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-purple-400">ETB</span>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-purple-600/70 mb-1">Questions per {quotaResetHours}h</label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                value={monthlyQuota}
                                                                onChange={(e) => setMonthlyQuota(e.target.value)}
                                                                className="w-full border border-purple-200 bg-white rounded-lg px-3 py-2 pr-8 text-purple-900 text-sm font-semibold focus:ring-2 focus:ring-purple-500 transition-all"
                                                                min="1"
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-purple-400">Q</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Divider */}
                                    <div className="border-t border-slate-100"></div>

                                    {/* Quota Reset Configuration */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-lg">🔄</span>
                                            <h3 className="font-semibold text-slate-800">Limit Reset Configuration</h3>
                                        </div>
                                        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                                                    <span className="text-white text-xs">⏱</span>
                                                </div>
                                                <span className="font-semibold text-amber-900 text-sm">Reset Interval</span>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-amber-600/70 mb-1">Limit resets every</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={quotaResetHours}
                                                        onChange={(e) => setQuotaResetHours(e.target.value)}
                                                        className="w-full border border-amber-200 bg-white rounded-lg px-3 py-2 pr-16 text-amber-900 text-sm font-semibold focus:ring-2 focus:ring-amber-500 transition-all"
                                                        min="1"
                                                        max="168"
                                                    />
                                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-medium text-amber-400">hours</span>
                                                </div>
                                                <p className="text-[10px] text-amber-600/60 mt-1.5">e.g., 3 = every 3 hours, 24 = daily reset</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer with Save Button */}
                                <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
                                    <p className="text-xs text-slate-400">Changes will take effect immediately after saving.</p>
                                    <button
                                        onClick={saveModelSettings}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                        Save Configuration
                                    </button>
                                </div>
                            </div>

                            {/* ===== Payment Methods & Contact card ===== */}
                            <div className="max-w-4xl mx-auto mt-6 bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden">
                                {/* Header */}
                                <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-5">
                                    <h2 className="text-xl font-bold text-white flex items-center gap-3">
                                        <span className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">💳</span>
                                        Payment Methods & Contact
                                    </h2>
                                    <p className="text-slate-400 text-sm mt-1">Configure manual (Telebirr / Safaricom / Bank) payments and how users reach you</p>
                                </div>

                                <div className="p-6 space-y-8">
                                    {/* Payment options — each has its own on/off toggle */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">🔀</span>
                                            <h3 className="font-semibold text-slate-800">Payment Options</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-4">Turn each option on or off. A manual option also needs its account number filled in to appear to users.</p>

                                        <div className="space-y-4">
                                            {/* Chapa */}
                                            <div className={`rounded-xl border p-4 transition-all ${chapaEnabled ? 'border-sky-200 bg-sky-50/50' : 'border-slate-200 bg-slate-50'}`}>
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">💳 Chapa (Online)</div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={chapaEnabled} onChange={(e) => setChapaEnabled(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-slate-300 peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                                                    </label>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">Instant online card / wallet payment via the Chapa gateway.</p>
                                            </div>

                                            {/* Telebirr */}
                                            <div className={`rounded-xl border p-4 transition-all ${telebirrEnabled ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50'}`}>
                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                    <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">📱 Telebirr</div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={telebirrEnabled} onChange={(e) => setTelebirrEnabled(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-slate-300 peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                                                    </label>
                                                </div>
                                                <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${telebirrEnabled ? '' : 'opacity-50'}`}>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Phone / Account Number</label>
                                                        <input type="text" value={telebirrNumber} onChange={(e) => setTelebirrNumber(e.target.value)} placeholder="e.g. 0912345678"
                                                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Account Holder Name</label>
                                                        <input type="text" value={telebirrName} onChange={(e) => setTelebirrName(e.target.value)} placeholder="e.g. Abebe Kebede"
                                                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Safaricom */}
                                            <div className={`rounded-xl border p-4 transition-all ${safaricomEnabled ? 'border-orange-200 bg-orange-50/40' : 'border-slate-200 bg-slate-50'}`}>
                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                    <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">📲 Safaricom / M-Pesa</div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={safaricomEnabled} onChange={(e) => setSafaricomEnabled(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-slate-300 peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                                                    </label>
                                                </div>
                                                <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 ${safaricomEnabled ? '' : 'opacity-50'}`}>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Phone / Account Number</label>
                                                        <input type="text" value={safaricomNumber} onChange={(e) => setSafaricomNumber(e.target.value)} placeholder="e.g. 0712345678"
                                                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-slate-500 mb-1.5">Account Holder Name</label>
                                                        <input type="text" value={safaricomName} onChange={(e) => setSafaricomName(e.target.value)} placeholder="e.g. Abebe Kebede"
                                                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bank (editable bank name) */}
                                            <div className={`rounded-xl border p-4 transition-all ${bankEnabled ? 'border-purple-200 bg-purple-50/40' : 'border-slate-200 bg-slate-50'}`}>
                                                <div className="flex items-center justify-between gap-3 mb-3">
                                                    <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">🏦 Bank Transfer</div>
                                                    <label className="relative inline-flex items-center cursor-pointer">
                                                        <input type="checkbox" checked={bankEnabled} onChange={(e) => setBankEnabled(e.target.checked)} className="sr-only peer" />
                                                        <div className="w-11 h-6 bg-slate-300 peer-focus:ring-2 peer-focus:ring-emerald-300 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
                                                    </label>
                                                </div>
                                                <p className="text-xs text-slate-400 mb-3">Add one row per bank account. Users pick which one to pay to; only the selected account's details show on their screen, so the list never crowds the checkout.</p>
                                                <div className={`space-y-3 ${bankEnabled ? '' : 'opacity-50'}`}>
                                                    {bankAccounts.length === 0 && (
                                                        <p className="text-xs text-slate-400 italic">No bank accounts yet — add one below.</p>
                                                    )}
                                                    {bankAccounts.map((b, idx) => (
                                                        <div key={idx} className="rounded-lg border border-slate-200 bg-white p-3">
                                                            <div className="flex items-center justify-between mb-2">
                                                                <span className="text-xs font-semibold text-slate-500">Bank #{idx + 1}</span>
                                                                <button type="button" onClick={() => setBankAccounts(prev => prev.filter((_, i) => i !== idx))}
                                                                    className="text-xs font-semibold text-red-500 hover:text-red-600 inline-flex items-center gap-1">
                                                                    🗑 Remove
                                                                </button>
                                                            </div>
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                <div>
                                                                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Bank Name</label>
                                                                    <input type="text" value={b.label} onChange={(e) => setBankAccounts(prev => prev.map((x, i) => i === idx ? { ...x, label: e.target.value } : x))} placeholder="e.g. Commercial Bank of Ethiopia"
                                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Account Number</label>
                                                                    <input type="text" value={b.number} onChange={(e) => setBankAccounts(prev => prev.map((x, i) => i === idx ? { ...x, number: e.target.value } : x))} placeholder="e.g. 1000123456789"
                                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-xs font-medium text-slate-500 mb-1.5">Account Holder Name</label>
                                                                    <input type="text" value={b.holder} onChange={(e) => setBankAccounts(prev => prev.map((x, i) => i === idx ? { ...x, holder: e.target.value } : x))} placeholder="e.g. Abebe Kebede"
                                                                        className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <button type="button" onClick={() => setBankAccounts(prev => [...prev, { label: '', number: '', holder: '' }])}
                                                        className="w-full border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 rounded-lg py-2.5 text-sm font-semibold transition-all">
                                                        + Add bank account
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Instructions */}
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-800 mb-2">Instructions shown to users</label>
                                        <textarea value={manualInstructions} onChange={(e) => setManualInstructions(e.target.value)} rows={3}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
                                            placeholder="Tell users how to pay and send you the receipt..." />
                                    </div>

                                    <div className="border-t border-slate-100"></div>

                                    {/* Contact channels */}
                                    <div>
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="text-lg">📨</span>
                                            <h3 className="font-semibold text-slate-800">Contact Admin Channels</h3>
                                        </div>
                                        <p className="text-xs text-slate-400 mb-4">Shown to users in "Contact Admin" and when they submit a manual payment. Leave blank to hide.</p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">📞 Phone</label>
                                                <input type="text" value={adminContactPhone} onChange={(e) => setAdminContactPhone(e.target.value)} placeholder="e.g. 0912345678"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">✈️ Telegram (username or link)</label>
                                                <input type="text" value={adminContactTelegram} onChange={(e) => setAdminContactTelegram(e.target.value)} placeholder="e.g. @ethiolex or https://t.me/ethiolex"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 mb-1.5">✉️ Email</label>
                                                <input type="text" value={adminContactEmail} onChange={(e) => setAdminContactEmail(e.target.value)} placeholder="e.g. support@ethiolex.com"
                                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-slate-800 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Footer with Save Button */}
                                <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 flex items-center justify-between">
                                    <p className="text-xs text-slate-400">Users see these changes the next time they open the payment screen.</p>
                                    <button
                                        onClick={savePaymentSettings}
                                        disabled={savingPayment}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium text-sm transition-all shadow-lg shadow-slate-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {savingPayment ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                        Save Payment & Contact
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminDashboard;
