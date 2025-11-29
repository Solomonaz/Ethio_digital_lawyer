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
      <div className="flex flex-wrap gap-2 mb-2 justify-end">
        {message.attachments.map((att, index) => (
          <div key={index} className="relative group">
            {att.type === 'image' ? (
              <img 
                src={`data:${att.mimeType};base64,${att.data}`} 
                alt="Attachment" 
                className="w-24 h-24 object-cover rounded-lg border border-slate-200 shadow-sm"
              />
            ) : att.type === 'audio' ? (
              <div className="flex items-center justify-center w-24 h-10 bg-slate-100 rounded-lg border border-slate-200">
                <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                <span className="text-xs text-slate-600 ml-1">Audio</span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-24 h-24 bg-slate-50 rounded-lg border border-slate-200 p-2 text-center">
                 <svg className="w-8 h-8 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" />
                 </svg>
                 <span className="text-[10px] text-slate-500 truncate w-full px-1">{att.name || 'Document'}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shadow-sm overflow-hidden
          ${isUser ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-white'}`}>
          {isUser ? 'ME' : (
             <div className="w-full h-full flex flex-col opacity-90">
                 <div className="flex-1 bg-green-600"></div>
                 <div className="flex-1 bg-yellow-400"></div>
                 <div className="flex-1 bg-red-600"></div>
             </div>
          )}
        </div>

        {/* Message Content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
          
          {/* Render User Attachments if present */}
          {isUser && renderAttachments()}

          <div className={`px-5 py-4 rounded-2xl shadow-sm text-sm md:text-base leading-relaxed
            ${isUser 
              ? 'bg-white border border-slate-100 text-slate-800 rounded-tr-none' 
              : isError 
                ? 'bg-red-50 border border-red-100 text-red-800 rounded-tl-none'
                : 'bg-white border border-yellow-100 text-slate-800 rounded-tl-none'
            }`}>
            {isError ? (
              <p>{message.text}</p>
            ) : (
              <div className="markdown-body prose prose-sm max-w-none prose-p:mb-2 prose-headings:font-serif prose-headings:text-slate-900 prose-a:text-green-700">
                <ReactMarkdown>{message.text}</ReactMarkdown>
              </div>
            )}
          </div>

          {/* Sources / Grounding */}
          {!isUser && message.groundingSources && message.groundingSources.length > 0 && (
            <div className="mt-2 ml-1 p-3 bg-slate-50 rounded-lg border border-slate-200 w-full max-w-lg">
              <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">{t.sources}</p>
              <ul className="space-y-1">
                {message.groundingSources.map((source, idx) => (
                  <li key={idx} className="text-xs truncate">
                    <a 
                      href={source.uri} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center text-green-700 hover:underline hover:text-green-800 transition-colors"
                    >
                      <svg className="w-3 h-3 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                        <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                      </svg>
                      {source.title || source.uri}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <span className="text-xs text-slate-400 mt-1 px-1">
            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;