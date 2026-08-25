import React, { useState, useRef, useEffect } from 'react';
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
  onOpenDocuments: () => void;
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
  onAddFunds,
  onOpenDocuments
}) => {
  const { t } = useTranslation();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };

    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

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

  // Tooltip component for collapsed state
  const Tooltip: React.FC<{ children: React.ReactNode; label: string }> = ({ children, label }) => (
    <div className="group/tooltip relative">
      {children}
      {!isOpen && (
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-neutral-900 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 whitespace-nowrap z-50 border border-white/10">
          {label}
          <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-neutral-900"></div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden animate-fade-in"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-30 flex flex-col transform transition-all duration-300 ease-out 
        md:static md:inset-auto md:transform-none
        ${isOpen ? 'translate-x-0 w-72' : '-translate-x-full w-72 md:translate-x-0 sidebar-rail'}
      `}>

        {/* Main Sidebar Content */}
        <div className={`flex-1 flex flex-col sidebar-surface border-r border-white/5 overflow-hidden transition-all duration-300 ${isOpen ? 'w-72' : 'w-72 sidebar-rail'}`}>

          {/* Header */}
          <div className={`relative ${isOpen ? 'p-5 pb-3' : 'p-3'}`}>
            <div className={`flex items-center ${isOpen ? 'justify-between' : 'flex-col gap-3'}`}>
              {/* Logo */}
              <div className={`flex items-center ${isOpen ? 'gap-3' : 'justify-center pt-2'}`}>
                <div className="relative group cursor-pointer" onClick={!isOpen ? toggleSidebar : undefined}>
                  <div className={`${isOpen ? 'w-12 h-12' : 'w-11 h-11'} flex items-center justify-center transition-all group-hover:scale-105`}>
                    <img src="/logo.png" alt="EthioLex Logo" className={`${isOpen ? 'w-12 h-12' : 'w-11 h-11'} object-contain`} />
                  </div>
                </div>
                {isOpen && (
                  <div className="animate-fade-in">
                    <h1 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {APP_NAME}
                    </h1>
                    <p className="text-[10px] text-neutral-500 font-medium uppercase tracking-[0.2em]">Digital Lawyer</p>
                  </div>
                )}
              </div>

              {/* Toggle Button */}
              <Tooltip label={isOpen ? t('collapseSidebar') || 'Collapse' : t('expandSidebar') || 'Expand'}>
                <button
                  onClick={toggleSidebar}
                  className={`p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10 ${!isOpen && 'mt-1'}`}
                >
                  <svg className="w-5 h-5 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {isOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    )}
                  </svg>
                </button>
              </Tooltip>
            </div>
          </div>

          {/* New Chat Button */}
          <div className={`${isOpen ? 'px-4 py-4' : 'px-3 py-4 flex flex-col items-center gap-2'}`}>
            <Tooltip label={t('newChat')}>
              <button
                onClick={() => {
                  onNewChat();
                  if (window.innerWidth < 768) toggleSidebar();
                }}
                className={`group relative overflow-hidden bg-emerald-800 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center transition-all duration-300 shadow-lg shadow-black/30 hover:-translate-y-0.5 ${isOpen ? 'w-full py-3.5 px-4 gap-2 rounded-xl' : 'w-11 h-11 p-0 rounded-xl'}`}
              >
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {isOpen && <span>{t('newChat')}</span>}
              </button>
            </Tooltip>

            {/* Legal Documents Button */}
            <Tooltip label={t('legalDocuments')}>
              <button
                onClick={() => {
                  onOpenDocuments();
                  if (window.innerWidth < 768) toggleSidebar();
                }}
                className={`group text-neutral-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 font-medium text-sm flex items-center justify-center transition-all ${isOpen ? 'mt-2 w-full py-2.5 px-4 gap-2 rounded-xl' : 'w-11 h-11 p-0 rounded-xl'}`}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                {isOpen && <span>{t('legalDocuments')}</span>}
              </button>
            </Tooltip>
          </div>

          {/* Divider for collapsed state */}
          {!isOpen && sessionGroups.length > 0 && (
            <div className="px-3 py-1">
              <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            </div>
          )}

          {/* Chat History - Collapsed shows icons */}
          {!isOpen ? (
            <div className="flex-1 overflow-hidden py-2 flex flex-col items-center gap-1.5">
              {sessionGroups.flatMap(g => g.items).slice(0, 5).map((session) => (
                <Tooltip key={session.id} label={session.title}>
                  <button
                    onClick={() => {
                      onSelectSession(session);
                      if (window.innerWidth < 768) toggleSidebar();
                    }}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 shrink-0 ${currentSessionId === session.id
                      ? 'bg-white/10 border-l-2 border-l-emerald-500 text-emerald-300'
                      : 'text-neutral-400 hover:bg-white/5 hover:text-white border border-transparent'
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </button>
                </Tooltip>
              ))}
              {sessionGroups.flatMap(g => g.items).length > 5 && (
                <Tooltip label={`${sessionGroups.flatMap(g => g.items).length - 5} more chats`}>
                  <button
                    onClick={toggleSidebar}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-500 hover:text-neutral-200 hover:bg-white/5 transition-all border border-dashed border-white/15 hover:border-white/25 shrink-0"
                  >
                    <span className="text-[10px] font-semibold">+{sessionGroups.flatMap(g => g.items).length - 5}</span>
                  </button>
                </Tooltip>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-3 pb-4 custom-scrollbar">
              {sessionGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-neutral-400 text-sm">{t('noHistory')}</p>
                  <p className="text-neutral-600 text-xs mt-1">Start a new consultation above</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {sessionGroups.map((group, gIndex) => (
                    <div key={gIndex} className="animate-fade-in" style={{ animationDelay: `${gIndex * 50}ms` }}>
                      <h3 className="px-3 py-2 text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.15em] flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-emerald-600"></span>
                        {group.label}
                      </h3>
                      <div className="space-y-1">
                        {group.items.map((session) => (
                          <div
                            key={session.id}
                            className={`group relative flex items-center rounded-xl px-3 py-2.5 cursor-pointer transition-all duration-200 ${currentSessionId === session.id
                              ? 'bg-white/10 border border-white/10 text-white'
                              : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
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
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
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
          )}

          {/* User Footer */}
          <div className={`border-t border-white/5 bg-gradient-to-t from-black/40 to-transparent ${isOpen ? 'p-4' : 'p-3'}`}>
            {user && (
              <div className={`flex ${isOpen ? 'items-center justify-between' : 'flex-col items-center gap-2'}`}>
                {/* User Profile with Popup Menu */}
                <div className="relative" ref={profileMenuRef}>
                  {isOpen ? (
                    <div
                      className="flex items-center gap-3 cursor-pointer group"
                      onClick={() => setShowProfileMenu(!showProfileMenu)}
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-white font-semibold text-sm group-hover:bg-neutral-700 transition-all">
                          {(user.name || user.username)?.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-neutral-950 rounded-full"></div>
                      </div>
                      <div className="animate-fade-in">
                        <p className="text-sm font-medium text-white truncate max-w-[100px]">{user.name || user.username}</p>
                        <p className="text-[10px] text-neutral-500 flex items-center gap-1">
                          <span className={`w-1.5 h-1.5 rounded-full ${user.monthly_subscription_expires_at && new Date(user.monthly_subscription_expires_at) > new Date()
                            ? 'bg-purple-500'
                            : user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date()
                              ? 'bg-indigo-500'
                              : 'bg-emerald-500'
                            }`}></span>
                          {user.monthly_subscription_expires_at && new Date(user.monthly_subscription_expires_at) > new Date() ? (
                            (() => {
                              const diff = new Date(user.monthly_subscription_expires_at).getTime() - new Date().getTime();
                              const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                              const hrs = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                              return `Monthly: ${days}d ${hrs}h left`;
                            })()
                          ) : user.subscription_expires_at && new Date(user.subscription_expires_at) > new Date() ? (
                            (() => {
                              const diff = new Date(user.subscription_expires_at).getTime() - new Date().getTime();
                              const hrs = Math.floor(diff / (1000 * 60 * 60));
                              const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                              return `Pro: ${hrs}h ${mins}m left`;
                            })()
                          ) : (
                            `${user.balance?.toLocaleString() || '0'} ETB`
                          )}
                        </p>
                      </div>
                      {/* Dropdown indicator */}
                      <svg className={`w-4 h-4 text-neutral-500 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  ) : (
                    <Tooltip label={user.username || 'Profile'}>
                      <button
                        onClick={() => setShowProfileMenu(!showProfileMenu)}
                        className="relative"
                      >
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 flex items-center justify-center text-white font-semibold text-sm hover:bg-neutral-700 transition-all border border-white/10">
                          {(user.name || user.username)?.charAt(0).toUpperCase()}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-neutral-950 rounded-full"></div>
                      </button>
                    </Tooltip>
                  )}

                  {/* Profile Popup Menu */}
                  {showProfileMenu && (
                    <div className={`absolute ${isOpen ? 'bottom-full left-0 mb-2 w-48' : 'left-full bottom-0 ml-2 w-44'} bg-neutral-900 rounded-xl shadow-2xl border border-white/10 py-1.5 z-50 animate-fade-in`}>
                      {/* Arrow pointer */}
                      <div className={`absolute ${isOpen ? 'bottom-0 left-4 translate-y-full border-t-neutral-900' : 'left-0 bottom-3 -translate-x-full border-r-neutral-900'} border-8 border-transparent ${isOpen ? 'border-t-neutral-900' : 'border-r-neutral-900'}`}></div>

                      {/* User info header in popup */}
                      <div className="px-3 py-2 border-b border-white/10 mb-1">
                        <p className="text-sm font-medium text-white truncate">{user.name || user.username}</p>
                        <p className="text-xs text-neutral-400 truncate">{user.email || 'User'}</p>
                      </div>

                      {/* Settings Option */}
                      <button
                        onClick={() => {
                          onOpenSettings();
                          setShowProfileMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-neutral-300 hover:bg-white/5 hover:text-white transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t('settings') || 'Settings'}
                      </button>

                      {/* Divider */}
                      <div className="my-1 border-t border-white/10"></div>

                      {/* Logout Option */}
                      <button
                        onClick={() => {
                          onLogout();
                          setShowProfileMenu(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        {t('logout') || 'Logout'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Add Funds Button Only */}
                <Tooltip label={t('addFunds') || 'Add Funds'}>
                  <button
                    onClick={onAddFunds}
                    className={`rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10 ${isOpen ? 'p-2.5' : 'p-2 w-10 h-10 flex items-center justify-center mt-2'}`}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </button>
                </Tooltip>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;

