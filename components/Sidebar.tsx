import React from 'react';
import { useTranslation } from 'react-i18next';
import { APP_NAME } from '../constants';
import { ChatSession, User } from '../types';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  user: User | null;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onAddFunds: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  toggleSidebar,
  user,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onLogout,
  onOpenSettings,
  onAddFunds
}) => {
  const { t } = useTranslation();

  // Helper to check if a session has real user messages (not just welcome/model messages)
  const hasRealContent = (session: ChatSession) => {
    const hasUserMessages = session.messages.some(m => m.role === 'user');
    if (session.title === 'New Consultation' && !hasUserMessages) {
      return false;
    }
    return true;
  };

  // Helper to group sessions by date
  const groupSessions = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { label: string; items: ChatSession[] }[] = [
      { label: t('today'), items: [] },
      { label: t('yesterday'), items: [] },
      { label: t('previous7Days'), items: [] },
      { label: t('older'), items: [] }
    ];

    sessions.forEach(session => {
      // Skip sessions that don't have real content
      if (!hasRealContent(session)) {
        return;
      }

      const date = new Date(session.updatedAt);

      if (date.toDateString() === today.toDateString()) {
        groups[0].items.push(session);
      } else if (date.toDateString() === yesterday.toDateString()) {
        groups[1].items.push(session);
      } else if (date > new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)) {
        groups[2].items.push(session);
      } else {
        groups[3].items.push(session);
      }
    });

    return groups.filter(g => g.items.length > 0);
  };

  const sessionGroups = groupSessions();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-20 md:hidden animate-fade-in"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-30 flex flex-col transform transition-all duration-300 ease-out 
        md:static md:inset-auto md:transform-none
        ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72 md:translate-x-0 md:w-20'}
      `}>

        {/* Main Sidebar Content */}
        <div className={`flex-1 flex flex-col bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-r border-slate-800/50 overflow-hidden transition-all duration-300 ${isOpen ? 'w-72' : 'w-72 md:w-20'}`}>

          {/* Header */}
          <div className={`relative p-5 border-b border-slate-800/50 flex items-center ${isOpen ? 'justify-between' : 'justify-center flex-col gap-4'}`}>
            <div className="absolute top-0 left-0 right-0 h-1 eth-flag-stripe"></div>

            <div className={`flex items-center ${isOpen ? 'gap-3' : 'justify-center'}`}>
              <div className="relative">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center">
                  <img src="/favicon.svg" alt="EthioLex Logo" className="w-10 h-10 object-contain" />
                </div>
              </div>
              {isOpen && (
                <div className="animate-fade-in">
                  <h1 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                    {APP_NAME}
                  </h1>
                  <p className="text-[10px] text-emerald-400 font-medium uppercase tracking-widest">Digital Lawyer</p>
                </div>
              )}
            </div>

            {/* Toggle Button */}
            <button
              onClick={toggleSidebar}
              className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all ${!isOpen && 'mt-2'}`}
              title={t('toggleSidebar')}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* New Chat Button - Only show when there are previous histories */}
          {sessionGroups.length > 0 && (
            <div className={`px-4 py-4 ${!isOpen && 'flex justify-center'}`}>
              <button
                onClick={() => {
                  onNewChat();
                  if (window.innerWidth < 768) toggleSidebar();
                }}
                className={`group relative overflow-hidden bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl font-medium text-sm flex items-center justify-center transition-all duration-300 shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 ${isOpen ? 'w-full py-3.5 px-4 gap-2' : 'w-12 h-12 p-0'}`}
                title={t('newChat')}
              >
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {isOpen && <span>{t('newChat')}</span>}
              </button>
            </div>
          )}

          {/* Chat History */}
          <div className={`flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar ${!isOpen ? 'hidden' : ''}`}>
            {sessionGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/50 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-slate-500 text-sm">{t('noHistory')}</p>
                <p className="text-slate-600 text-xs mt-1">Start a new consultation above</p>
              </div>
            ) : (
              <div className="space-y-5">
                {sessionGroups.map((group, gIndex) => (
                  <div key={gIndex} className="animate-fade-in" style={{ animationDelay: `${gIndex * 50}ms` }}>
                    <h3 className="px-3 py-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                      {group.label}
                    </h3>
                    <div className="space-y-1">
                      {group.items.map((session) => (
                        <div
                          key={session.id}
                          className={`group relative flex items-center rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200 ${currentSessionId === session.id
                            ? 'bg-gradient-to-r from-emerald-500/15 to-emerald-500/5 border border-emerald-500/20 text-white'
                            : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                            }`}
                          onClick={() => {
                            onSelectSession(session);
                            if (window.innerWidth < 768) toggleSidebar();
                          }}
                        >
                          {currentSessionId === session.id && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-emerald-500 rounded-r-full"></div>
                          )}

                          <svg className="w-4 h-4 mr-3 flex-shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                          </svg>

                          <span className="flex-1 truncate text-sm">{session.title}</span>

                          <button
                            onClick={(e) => onDeleteSession(session.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* User Footer - Cleaner design with Settings button */}
          <div className="p-4 border-t border-slate-800/50 bg-gradient-to-t from-slate-950 to-transparent">
            {user && (
              <div className={`flex items-center ${isOpen ? 'justify-between' : 'flex-col gap-4'}`}>
                {/* User Profile */}
                <div className={`flex items-center ${isOpen ? 'gap-3' : 'justify-center'}`}>
                  <div className="relative cursor-pointer" onClick={onOpenSettings} title={user.username}>
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center text-white font-semibold text-sm">
                      {user.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
                  </div>
                  {isOpen && (
                    <div className="animate-fade-in">
                      <p className="text-sm font-medium text-white truncate max-w-[100px]">{user.username}</p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {user.balance?.toLocaleString() || '0'} ETB
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className={`flex items-center gap-1 ${!isOpen && 'flex-col'}`}>
                  {/* Add Funds Button */}
                  <button
                    onClick={onAddFunds}
                    className="p-2.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-all"
                    title="Add Funds"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>

                  {/* Settings Button */}
                  <button
                    onClick={onOpenSettings}
                    className="p-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
                    title={t('settings')}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>

                  {/* Logout Button */}
                  <button
                    onClick={onLogout}
                    className="p-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    title={t('logout')}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
