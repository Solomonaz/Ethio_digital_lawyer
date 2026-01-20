import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface AdminUser {
    id: number;
    username: string;
    email: string;
    balance: number;
    is_admin: boolean;
    is_active: boolean;
    created_at: string;
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
    const [searchCost, setSearchCost] = useState('30');
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
            const costSetting = data.find((s: AdminSetting) => s.key === 'search_cost');
            if (costSetting) setSearchCost(costSetting.value);
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

    const updateSearchCost = async () => {
        try {
            const res = await fetch(`http://127.0.0.1:8000/admin/settings/search_cost`, {
                method: 'PUT', headers, body: JSON.stringify({ value: searchCost, description: 'Cost in ETB per search' })
            });
            if (!res.ok) throw new Error('Failed to update');
            setSuccess('Search cost updated!');
            fetchSettings();
        } catch (err: any) { setError(err.message); }
    };

    const stats = {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.is_active).length,
        pendingPayments: payments.filter(p => p.status === 'pending').length,
        totalRevenue: payments.filter(p => p.status === 'success').reduce((sum, p) => sum + p.amount, 0)
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
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
                        <div className="text-3xl font-bold text-purple-600">{stats.totalRevenue} <span className="text-base text-slate-400">ETB</span></div>
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
                                    <th className="text-left p-4 text-slate-600 font-semibold text-sm">{t('balance')}</th>
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
                                            <div className="flex items-center gap-2">
                                                <input type="number" defaultValue={u.balance || 0} className="w-24 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-800 text-sm focus:ring-2 focus:ring-green-500" onBlur={(e) => updateBalance(u.id, e.target.value)} />
                                                <span className="text-slate-400 text-sm">ETB</span>
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
                            <div className="max-w-md">
                                <h2 className="text-lg font-bold text-slate-800 mb-6">⚙️ {t('appSettings')}</h2>
                                <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                                    <label className="block text-sm font-medium text-slate-700 mb-3">{t('searchCostParam')}</label>
                                    <div className="flex gap-3">
                                        <div className="relative flex-1">
                                            <input type="number" value={searchCost} onChange={(e) => setSearchCost(e.target.value)} className="w-full border border-slate-300 rounded-lg px-4 py-3 text-slate-800 text-lg font-bold focus:ring-2 focus:ring-green-500" />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">ETB</span>
                                        </div>
                                        <button onClick={updateSearchCost} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm">{t('save')}</button>
                                    </div>
                                    <p className="text-slate-500 text-sm mt-3">{t('searchCostHelp')}</p>
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
