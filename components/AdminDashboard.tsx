import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

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
}

interface AdminPayment {
    id: number;
    user_id: number;
    username: string;
    amount: number;
    tx_ref: string;
    status: string;
    created_at: string;
}

interface AdminSetting {
    id: number;
    key: string;
    value: string;
    description: string;
}

interface AdminDashboardProps {
    onBack: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'users' | 'payments' | 'settings'>('users');
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [payments, setPayments] = useState<AdminPayment[]>([]);
    const [settings, setSettings] = useState<AdminSetting[]>([]);

    // Model Pricing State
    const [modelName, setModelName] = useState('gemini-3-pro-preview');
    const [inputCost, setInputCost] = useState('240');
    const [outputCost, setOutputCost] = useState('1440');
    const [minBalance, setMinBalance] = useState('10.0');
    const [subPrice, setSubPrice] = useState('100'); // Default subscription price
    const [dailyQuota, setDailyQuota] = useState('100'); // Default subscriber daily limit

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };

    useEffect(() => {
        if (activeTab === 'users') fetchUsers();
        else if (activeTab === 'payments') fetchPayments();
        else if (activeTab === 'settings') fetchSettings();
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
            const res = await fetch('http://127.0.0.1:8000/admin/users', { headers });
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
            const res = await fetch('http://127.0.0.1:8000/admin/payments', { headers });
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
            const res = await fetch('http://127.0.0.1:8000/admin/settings', { headers });
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
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const updateBalance = async (userId: number, newBalance: string) => {
        try {
            const res = await fetch(`http://127.0.0.1:8000/admin/users/${userId}/balance`, {
                method: 'PUT', headers, body: JSON.stringify({ balance: parseFloat(newBalance) })
            });
            if (!res.ok) throw new Error('Failed to update balance');
            setSuccess('Balance updated!');
            fetchUsers();
        } catch (err: any) { setError(err.message); }
    };

    const toggleUserActive = async (userId: number) => {
        try {
            const res = await fetch(`http://127.0.0.1:8000/admin/users/${userId}/toggle-active`, {
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
            const res = await fetch(`http://127.0.0.1:8000/admin/users/${userId}`, {
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
            const res = await fetch(`http://127.0.0.1:8000/admin/payments/${paymentId}/approve`, { method: 'PUT', headers });
            if (!res.ok) throw new Error('Failed to approve');
            setSuccess('Payment approved!');
            fetchPayments();
        } catch (err: any) { setError(err.message); }
    };

    const rejectPayment = async (paymentId: number) => {
        try {
            const res = await fetch(`http://127.0.0.1:8000/admin/payments/${paymentId}/reject`, { method: 'PUT', headers });
            if (!res.ok) throw new Error('Failed to reject');
            setSuccess('Payment rejected!');
            fetchPayments();
        } catch (err: any) { setError(err.message); }
    };

    const saveModelSettings = async () => {
        try {
            setLoading(true);
            // 1. Model Name
            await fetch(`http://127.0.0.1:8000/admin/settings/model_name`, {
                method: 'PUT', headers, body: JSON.stringify({ value: modelName, description: 'Active AI Model Name' })
            });
            // 2. Input Cost
            await fetch(`http://127.0.0.1:8000/admin/settings/cost_input_1m`, {
                method: 'PUT', headers, body: JSON.stringify({ value: inputCost, description: 'Cost in ETB per 1 Million Input Tokens' })
            });
            // 3. Output Cost
            await fetch(`http://127.0.0.1:8000/admin/settings/cost_output_1m`, {
                method: 'PUT', headers, body: JSON.stringify({ value: outputCost, description: 'Cost in ETB per 1 Million Output Tokens' })
            });
            // 4. Min Balance
            await fetch(`http://127.0.0.1:8000/admin/settings/min_search_balance`, {
                method: 'PUT', headers, body: JSON.stringify({ value: minBalance, description: 'Minimum Balance Required to Search' })
            });
            // 5. Subscription Price
            await fetch(`http://127.0.0.1:8000/admin/settings/subscription_24h_price`, {
                method: 'PUT', headers, body: JSON.stringify({ value: subPrice, description: 'Price for 24-hour subscription (ETB)' })
            });
            // 6. Subscriber Daily Quota
            await fetch(`http://127.0.0.1:8000/admin/settings/subscription_daily_quota`, {
                method: 'PUT', headers, body: JSON.stringify({ value: dailyQuota, description: 'Maximum questions per day for 24h subscribers' })
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
                    {[{ key: 'users', label: t('users'), icon: '👥' }, { key: 'payments', label: t('payments'), icon: '💳' }, { key: 'settings', label: t('settings'), icon: '⚙️' }].map((tab) => (
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
                                {users.map((u) => (
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
                                                // Debug log
                                                console.log(`User ${u.username}: subscription_expires_at =`, u.subscription_expires_at);

                                                if (!u.subscription_expires_at) {
                                                    return (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
                                                            Pay as you go
                                                        </span>
                                                    );
                                                }

                                                const expiresAt = new Date(u.subscription_expires_at);
                                                const now = new Date();
                                                const hasActiveSub = expiresAt > now;

                                                console.log(`  -> Expires: ${expiresAt.toISOString()}, Now: ${now.toISOString()}, Active: ${hasActiveSub}`);

                                                if (hasActiveSub) {
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
                                                    // Subscription expired - show as Pay as you go with expired note
                                                    return (
                                                        <div className="flex flex-col">
                                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>
                                                                Pay as you go
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 mt-1">Sub expired</span>
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <input type="number" defaultValue={u.balance || 0} className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 text-sm focus:ring-2 focus:ring-green-500" onBlur={(e) => updateBalance(u.id, e.target.value)} />
                                                <span className="text-slate-400 text-sm">ETB</span>
                                            </div>
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
                    ) : activeTab === 'payments' ? (
                        <table className="w-full">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('transaction')}</th>
                                    <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('username')}</th>
                                    <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('amount')}</th>
                                    <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('status')}</th>
                                    <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.length === 0 ? (
                                    <tr><td colSpan={5} className="p-12 text-center text-slate-400">{t('noPayments')}</td></tr>
                                ) : payments.map((p) => (
                                    <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                        <td className="p-4"><div className="font-mono text-sm text-slate-700">{p.tx_ref}</div><div className="text-slate-400 text-xs">ID: {p.id}</div></td>
                                        <td className="p-4 text-slate-700">{p.username}</td>
                                        <td className="p-4"><span className="text-slate-900 font-semibold">{p.amount}</span><span className="text-slate-400 ml-1">ETB</span></td>
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
                    ) : (
                        <div className="p-8">
                            <div className="max-w-2xl">
                                <h2 className="text-lg font-bold text-slate-800 mb-6">⚙️ Model & Pricing Configuration</h2>
                                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200 space-y-6">

                                    {/* Model Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Active Model Name</label>
                                        <input
                                            type="text"
                                            value={modelName}
                                            onChange={(e) => setModelName(e.target.value)}
                                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 focus:ring-2 focus:ring-green-500"
                                            placeholder="e.g. gemini-3-pro-preview"
                                        />
                                        <p className="text-xs text-slate-500 mt-1">Check Google AI Studio for exact model names.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Input Cost */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Input Cost (per 1M Tokens)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={inputCost}
                                                    onChange={(e) => setInputCost(e.target.value)}
                                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-green-500"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">ETB</span>
                                            </div>
                                            {/* <p className="text-xs text-slate-500 mt-1">Default: ~2.00 USD (240 ETB)</p> */}
                                        </div>

                                        {/* Output Cost */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">Output Cost (per 1M Tokens)</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={outputCost}
                                                    onChange={(e) => setOutputCost(e.target.value)}
                                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-green-500"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">ETB</span>
                                            </div>
                                            {/* <p className="text-xs text-slate-500 mt-1">Default: ~12.00 USD (1440 ETB)</p> */}
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-200 mt-4">
                                        <h3 className="text-sm font-bold text-slate-800 mb-3">Balance & Subscription</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Minimum Balance to Search</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={minBalance}
                                                        onChange={(e) => setMinBalance(e.target.value)}
                                                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-green-500"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">ETB</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">Users must have at least this amount to start a search.</p>
                                            </div>

                                            {/* Subscription Price */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">24-Hour Pass Price</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={subPrice}
                                                        onChange={(e) => setSubPrice(e.target.value)}
                                                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-green-500"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">ETB</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">Cost for 24 hours of unlimited usage.</p>
                                            </div>

                                            {/* Subscriber Daily Limit */}
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-2">Subscriber Daily Limit</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={dailyQuota}
                                                        onChange={(e) => setDailyQuota(e.target.value)}
                                                        className="w-full border border-slate-300 rounded-lg px-4 py-2.5 text-slate-800 font-medium focus:ring-2 focus:ring-green-500"
                                                        min="1"
                                                    />
                                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">Q's</span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">Max questions per day for 24h pass holders.</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-4 border-t border-slate-200">
                                        <button onClick={saveModelSettings} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm w-full md:w-auto">
                                            Save Configuration
                                        </button>
                                    </div>
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
