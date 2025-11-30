
import React from 'react';
import { APP_NAME, UI_STRINGS } from '../constants';
import { Language, ChatSession, User } from '../types';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  language: Language;
  user: User | null;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (session: ChatSession) => void;
  onNewChat: () => void;
  onDeleteSession: (sessionId: string, e: React.MouseEvent) => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen, 
  toggleSidebar, 
  language, 
  user,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onLogout
}) => {
  const t = UI_STRINGS[language];

  // Helper to group sessions by date
  const groupSessions = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const groups: { label: string; items: ChatSession[] }[] = [
      { label: t.today, items: [] },
      { label: t.yesterday, items: [] },
      { label: t.previous7Days, items: [] },
      { label: t.older, items: [] }
    ];

    sessions.forEach(session => {
      // Handle Firebase Timestamp conversion edge case if it slipped through props
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
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar Container */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-950 text-slate-100 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-600 via-yellow-400 to-red-600"></div>
          
          <div className="flex items-center space-x-3 pt-1">
             {/* Justice Scale Logo - Ethiopian Colors */}
             <div className="w-8 h-8 flex items-center justify-center">
               <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8" stroke="currentColor">
                 {/* Scale Beam */}
                 <path d="M4 7h16" stroke="#FEDD00" strokeWidth="2" strokeLinecap="round"/>
                 <path d="M12 3v13" stroke="#FEDD00" strokeWidth="2" strokeLinecap="round"/>
                 
                 {/* Left Pan */}
                 <path d="M5 7v4c0 2.2 1.8 4 4 4s4-1.8 4-4V7" stroke="#009A44" strokeWidth="1.5" fill="none"/>
                 <path d="M6 7l3 5 3-5" stroke="#009A44" strokeWidth="1" opacity="0.5"/>

                 {/* Right Pan */}
                 <path d="M15 7v4c0 2.2 1.8 4 4 4s4-1.8 4-4V7" stroke="#FF0000" strokeWidth="1.5" fill="none"/>
                 <path d="M16 7l3 5 3-5" stroke="#FF0000" strokeWidth="1" opacity="0.5"/>

                 {/* Base */}
                 <path d="M8 21h8" stroke="#FEDD00" strokeWidth="2" strokeLinecap="round"/>
                 <path d="M12 16l-3 5h6l-3-5" stroke="#FEDD00" strokeWidth="1.5" fill="none"/>
               </svg>
             </div>
            <span className="font-serif font-bold text-lg tracking-tight text-white">{APP_NAME}</span>
          </div>
          <button onClick={toggleSidebar} className="md:hidden text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-4">
            <button 
                onClick={() => {
                    onNewChat();
                    if(window.innerWidth < 768) toggleSidebar();
                }}
                className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-lg border border-slate-700 transition-all shadow-sm group"
            >
                <svg className="w-5 h-5 text-yellow-400 group-hover:text-yellow-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium text-sm">{t.newChat}</span>
            </button>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto px-2 space-y-6 scrollbar-thin scrollbar-thumb-slate-700">
          {sessions.length === 0 ? (
              <div className="text-center mt-10 px-4">
                  <p className="text-slate-500 text-sm italic">{t.noHistory}</p>
              </div>
          ) : (
            sessionGroups.map((group, gIndex) => (
                <div key={gIndex}>
                    <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">{group.label}</h3>
                    <div className="space-y-1">
                        {group.items.map((session) => (
                            <div 
                                key={session.id}
                                className={`group relative flex items-center rounded-lg px-3 py-2 cursor-pointer transition-colors ${currentSessionId === session.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}`}
                                onClick={() => {
                                    onSelectSession(session);
                                    if(window.innerWidth < 768) toggleSidebar();
                                }}
                            >
                                <div className="flex-1 truncate text-sm">
                                    {session.title}
                                </div>
                                
                                {/* Delete Action */}
                                <button 
                                    onClick={(e) => onDeleteSession(session.id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-opacity"
                                    title={t.clearChat}
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))
          )}
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900">
           {user && (
               <div className="flex items-center justify-between mb-3">
                   <div className="flex items-center space-x-2">
                       <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-600 to-yellow-500 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                           {user.username.charAt(0).toUpperCase()}
                       </div>
                       <div className="flex flex-col">
                           <span className="text-sm font-medium text-white">{user.username}</span>
                           <span className="text-[10px] text-slate-400">{t.freeAccount}</span>
                       </div>
                   </div>
                   <button onClick={onLogout} className="text-slate-400 hover:text-white" title={t.logout}>
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                       </svg>
                   </button>
               </div>
           )}
          
          <div className="text-[10px] text-slate-500 text-center">
             &copy; {new Date().getFullYear()} EthioLex Digital Lawyer
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
