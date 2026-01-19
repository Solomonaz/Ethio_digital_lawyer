import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Language } from '../types';
import { UI_STRINGS } from '../constants';

interface ChatMessageProps {
  message: Message;
  language: Language;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, language }) => {
  const isUser = message.role === 'user';
  const isError = message.isError;
  const t = UI_STRINGS[language];

  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 mb-3 justify-end">
        {message.attachments.map((att, index) => (
          <div key={index} className="relative group">
            {att.type === 'image' ? (
              <div className="relative overflow-hidden rounded-xl shadow-lg">
                <img
                  src={`data:${att.mimeType};base64,${att.data}`}
                  alt="Attachment"
                  className="w-28 h-28 object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
            ) : att.type === 'audio' ? (
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl border border-slate-200 shadow-sm">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <span className="text-xs font-medium text-slate-600">Voice Message</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-28 h-28 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200 p-3 text-center shadow-sm group-hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mb-2">
                  <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-[10px] text-slate-500 truncate w-full font-medium">{att.name || 'Document'}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`flex w-full mb-6 animate-slide-up ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>

        {/* Avatar */}
        <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shadow-lg overflow-hidden transition-transform hover:scale-105 ${isUser
            ? 'bg-gradient-to-br from-slate-800 to-slate-700 text-white'
            : 'bg-white border border-slate-100'
          }`}>
          {isUser ? (
            <span className="text-xs font-bold tracking-wide">ME</span>
          ) : (
            <div className="w-full h-full flex flex-col">
              <div className="flex-1 bg-emerald-500"></div>
              <div className="flex-1 bg-amber-400"></div>
              <div className="flex-1 bg-red-500"></div>
            </div>
          )}
        </div>

        {/* Message Content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>

          {/* Render User Attachments if present */}
          {isUser && renderAttachments()}

          <div className={`relative px-5 py-4 text-sm md:text-base leading-relaxed ${isUser
              ? 'message-user shadow-lg shadow-emerald-500/10'
              : isError
                ? 'bg-gradient-to-br from-red-50 to-rose-50 border border-red-100 text-red-800 rounded-2xl rounded-tl-sm shadow-sm'
                : 'message-bot shadow-soft'
            }`}>
            {/* Decorative elements for bot messages */}
            {!isUser && !isError && (
              <div className="absolute top-0 left-0 w-8 h-8 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-tl-2xl"></div>
            )}

            {isError ? (
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p>{message.text}</p>
              </div>
            ) : (
              <div className={`markdown-body prose prose-sm max-w-none ${isUser ? 'prose-invert' : 'prose-slate'}`}>
                <ReactMarkdown>{message.text}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* Sources / Grounding */}
          {!isUser && message.groundingSources && message.groundingSources.length > 0 && (
            <div className="mt-3 ml-1 p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-100 w-full max-w-lg shadow-sm animate-fade-in">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t.sources}</p>
              </div>
              <ul className="space-y-2">
                {message.groundingSources.map((source, idx) => (
                  <li key={idx}>
                    <a
                      href={source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center text-sm text-slate-600 hover:text-emerald-600 transition-colors p-2 rounded-lg hover:bg-emerald-50"
                    >
                      <div className="w-5 h-5 rounded bg-slate-100 group-hover:bg-emerald-100 flex items-center justify-center mr-2 transition-colors">
                        <svg className="w-3 h-3 text-slate-400 group-hover:text-emerald-500 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                          <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                        </svg>
                      </div>
                      <span className="truncate">{source.title || source.uri}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Timestamp */}
          <div className={`flex items-center gap-1.5 mt-1.5 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
            <span className="text-[11px] text-slate-400 font-medium">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {isUser && (
              <svg className="w-3.5 h-3.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;