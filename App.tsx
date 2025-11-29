
import React, { useState, useRef, useEffect } from 'react';
import ChatMessage from './components/ChatMessage';
import Sidebar from './components/Sidebar';
import DisclaimerModal from './components/DisclaimerModal';
import AuthModal from './components/AuthModal';
import { sendMessageToGemini } from './services/geminiService';
import { getCurrentUser, getUserSessions, createNewSession, saveSession, deleteSession, logoutUser } from './services/storageService';
import { Message, Language, Attachment, User, ChatSession } from './types';
import { UI_STRINGS } from './constants';

const App: React.FC = () => {
  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Chat State
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  // UI State
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false); // Only show after auth
  const [language, setLanguage] = useState<Language>('en');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  
  // Attachments & Voice State
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Speech Recognition Reference
  const recognitionRef = useRef<any>(null);

  const t = UI_STRINGS[language];

  // --- Initialization & Auth ---

  useEffect(() => {
    // Check for logged in user
    const user = getCurrentUser();
    if (user) {
      setCurrentUser(user);
      loadUserData(user.id);
    }
    setIsAuthChecking(false);
  }, []);

  const loadUserData = (userId: string) => {
    const userSessions = getUserSessions(userId);
    setSessions(userSessions);
    
    // Auto load most recent session or create new
    if (userSessions.length > 0) {
      setCurrentSession(userSessions[0]);
    } else {
      handleNewChat(userId);
    }
    
    // Show disclaimer once per session/login ideally, but for now show if logged in
    setIsDisclaimerOpen(true);
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    loadUserData(user.id);
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setCurrentSession(null);
    setSessions([]);
    setMessages([]); // Clear visual messages
  };

  const handleNewChat = (userId: string = currentUser?.id || '') => {
    if (!userId) return;
    const newSession = createNewSession(userId);
    // Add welcome message to new session
    const welcomeMsg: Message = {
      id: 'welcome-' + Date.now(),
      role: 'model',
      text: UI_STRINGS[language].welcomeText,
      timestamp: new Date()
    };
    newSession.messages.push(welcomeMsg);
    
    setCurrentSession(newSession);
    // Don't save to list yet until user sends first message to avoid empty spam
    setMessages(newSession.messages);
    if(window.innerWidth < 768) setIsSidebarOpen(false);
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSession(session);
    setMessages(session.messages);
  };

  // --- Message Handling Wrapper ---
  // We use a local messages state for rendering, but sync with currentSession
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, attachments.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // --- File Handling ---

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        const base64 = await convertFileToBase64(file);
        const newAttachment: Attachment = {
          type: file.type.startsWith('image/') ? 'image' : 'file',
          mimeType: file.type,
          data: base64,
          name: file.name
        };
        setAttachments(prev => [...prev, newAttachment]);
      } catch (error) {
        console.error("Error reading file", error);
        alert("Failed to upload file");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // --- Voice Transcription (Speech-to-Text) ---

  const startListening = () => {
    // @ts-ignore - Vendor prefixes
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Your browser does not support Speech Recognition. Please use Chrome or Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'am' ? 'am-ET' : 'en-US';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Update input with the transcription
      if (finalTranscript) {
         setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- Sending Message ---

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Stop recording if active when sending
    if (isRecording) {
      stopListening();
    }
    
    if ((!input.trim() && attachments.length === 0) || isLoading || !currentSession || !currentUser) return;

    const userText = input.trim();
    const userAttachments = [...attachments];
    
    // Reset inputs
    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // 1. Create User Message
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: new Date(),
      attachments: userAttachments
    };

    // 2. Update Local State & Session
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    
    const updatedSession = { 
        ...currentSession, 
        messages: updatedMessages,
        title: currentSession.messages.length <= 1 ? userText.slice(0, 30) : currentSession.title,
        updatedAt: new Date()
    };
    
    setCurrentSession(updatedSession);
    saveSession(updatedSession); // Save to Storage
    
    // Refresh sidebar list
    if (currentUser) {
        setSessions(getUserSessions(currentUser.id));
    }

    setIsLoading(true);

    try {
      const response = await sendMessageToGemini(updatedMessages, userText, language, userAttachments);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        timestamp: new Date(),
        groundingSources: response.sources
      };
      
      const finalMessages = [...updatedMessages, botMessage];
      setMessages(finalMessages);
      
      const finalSession = { 
          ...updatedSession, 
          messages: finalMessages,
          updatedAt: new Date()
      };
      setCurrentSession(finalSession);
      saveSession(finalSession);
      
      if (currentUser) setSessions(getUserSessions(currentUser.id));

    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: t.error,
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSessionTrigger = (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSessionToDelete(sessionId);
      setIsClearModalOpen(true);
  };

  const confirmDeleteSession = () => {
      if (sessionToDelete) {
          deleteSession(sessionToDelete);
          if (currentUser) {
              const updatedSessions = getUserSessions(currentUser.id);
              setSessions(updatedSessions);
              
              // If deleted current session, select another or create new
              if (currentSession?.id === sessionToDelete) {
                  if (updatedSessions.length > 0) {
                      handleSelectSession(updatedSessions[0]);
                  } else {
                      handleNewChat(currentUser.id);
                  }
              }
          }
      }
      setIsClearModalOpen(false);
      setSessionToDelete(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const adjustTextareaHeight = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  if (isAuthChecking) return <div className="flex h-screen items-center justify-center bg-slate-50">Loading...</div>;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {!currentUser && <AuthModal onLogin={handleLogin} language={language} onLanguageChange={setLanguage} />}
      
      {currentUser && (
        <>
        <DisclaimerModal isOpen={isDisclaimerOpen} onAccept={() => setIsDisclaimerOpen(false)} language={language} />
        
        {/* Hidden File Input */}
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />

        {isClearModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 backdrop-blur-sm">
                <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{t.clearChat}</h3>
                    <p className="text-slate-600 mb-6">{t.clearChatConfirm}</p>
                    <div className="flex space-x-3">
                        <button onClick={() => setIsClearModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50">{t.cancel}</button>
                        <button onClick={confirmDeleteSession} className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">{t.confirm}</button>
                    </div>
                </div>
            </div>
        )}

        <Sidebar 
            isOpen={isSidebarOpen} 
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            language={language}
            user={currentUser}
            sessions={sessions}
            currentSessionId={currentSession?.id || null}
            onSelectSession={handleSelectSession}
            onNewChat={() => handleNewChat()}
            onDeleteSession={handleDeleteSessionTrigger}
            onLogout={handleLogout}
        />

        <div className="flex-1 flex flex-col h-full relative">
            {/* Header */}
            <header className="bg-white eth-gradient-border-b h-16 flex items-center justify-between px-4 md:px-8 shadow-sm flex-shrink-0 z-10">
            <div className="flex items-center">
                <button onClick={() => setIsSidebarOpen(true)} className="md:hidden mr-4 text-slate-500 hover:text-slate-800">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <h2 className="text-lg font-serif text-slate-900 font-bold md:hidden">EthioLex</h2>
                <h2 className="hidden md:block eth-gradient-text font-serif text-lg font-bold">{t.appTagline}</h2>
            </div>
            <div className="flex items-center space-x-4">
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${language === 'en' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>English</button>
                    <button onClick={() => setLanguage('am')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${language === 'am' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>አማርኛ</button>
                </div>
            </div>
            </header>

            {/* Chat Area */}
            <main className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
            <div className="max-w-3xl mx-auto">
                {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center"></div>
                ) : (
                messages.map(msg => <ChatMessage key={msg.id} message={msg} language={language} />)
                )}
                
                {isLoading && (
                <div className="flex w-full mb-6 justify-start">
                    <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
                            <div className="w-full h-full flex flex-col opacity-90">
                                <div className="flex-1 bg-green-600"></div>
                                <div className="flex-1 bg-yellow-400"></div>
                                <div className="flex-1 bg-red-600"></div>
                            </div>
                        </div>
                    <div className="bg-white border border-yellow-100 px-5 py-4 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        <span className="text-xs text-slate-400 ml-2">{t.consulting}</span>
                    </div>
                    </div>
                </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            </main>

            {/* Input Area */}
            <div className="bg-white border-t border-slate-200 p-4 md:p-6 flex-shrink-0">
            <div className="max-w-3xl mx-auto">
                
                {/* Attachment Preview */}
                {attachments.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto py-2">
                        {attachments.map((att, index) => (
                            <div key={index} className="relative group flex-shrink-0">
                                {att.type === 'image' ? (
                                    <img src={`data:${att.mimeType};base64,${att.data}`} className="h-20 w-20 object-cover rounded-lg border border-slate-300" alt="Preview" />
                                ) : (
                                    <div className="h-20 w-20 bg-slate-100 rounded-lg border border-slate-300 flex flex-col items-center justify-center px-1">
                                        <svg className="w-8 h-8 text-slate-400 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 011.414.586l5.414 5.414a1 1 0 01.586 1.414V19a2 2 0 01-2 2z" /></svg>
                                        <span className="text-[10px] text-slate-500 w-full truncate text-center">{att.name}</span>
                                    </div>
                                )}
                                <button onClick={() => removeAttachment(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <div className={`relative flex items-end gap-2 bg-slate-50 border rounded-xl p-2 focus-within:ring-2 focus-within:ring-green-500 focus-within:border-transparent transition-all shadow-sm ${isRecording ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-300'}`}>
                
                {/* Attachment Button */}
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors mb-0.5"
                    title={t.uploadFile}
                    type="button"
                    disabled={isRecording}
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                </button>

                {/* Voice Record Button (Speech to Text) */}
                <button 
                    onClick={isRecording ? stopListening : startListening}
                    className={`p-2.5 rounded-lg transition-all mb-0.5 ${
                        isRecording 
                        ? 'bg-red-500 text-white shadow-md animate-pulse' 
                        : 'text-slate-400 hover:text-slate-600 hover:bg-slate-200'
                    }`}
                    title={isRecording ? t.stopRecording : "Voice to Text"}
                    type="button"
                >
                    {isRecording ? (
                        <div className="w-5 h-5 flex items-center justify-center">
                             {/* Stop Icon */}
                             <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>
                        </div>
                    ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    )}
                </button>

                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={adjustTextareaHeight}
                    onKeyDown={handleKeyDown}
                    placeholder={isRecording ? t.listening : t.inputPlaceholder}
                    className="w-full bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-2.5 px-2 text-slate-800 placeholder-slate-400"
                    rows={1}
                    disabled={isLoading}
                />
                <button
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || (!input.trim() && attachments.length === 0)}
                    className={`p-2.5 rounded-lg mb-0.5 transition-colors duration-200 flex-shrink-0 ${
                    isLoading || (!input.trim() && attachments.length === 0)
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                        : 'bg-slate-900 text-white hover:bg-slate-800 shadow-md'
                    }`}
                >
                    <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                </button>
                </div>
                <p className="text-center text-[10px] text-slate-400 mt-2">
                Gemini 2.5 • <span className="text-red-400">{t.disclaimerText.split('.')[0]}.</span>
                </p>
            </div>
            </div>
        </div>
        </>
      )}
    </div>
  );
};

export default App;
