import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ChatMessage from './components/ChatMessage';
import Sidebar from './components/Sidebar';
import DisclaimerModal from './components/DisclaimerModal';
import AuthModal from './components/AuthModal';
import LandingPage from './components/LandingPage';
import PaymentModal from './components/PaymentModal';
import ContactAdminModal from './components/ContactAdminModal';
import DocumentsModal from './components/DocumentsModal';
import SuccessModal from './components/SuccessModal';
import SettingsModal from './components/SettingsModal';
// Code-split: the admin dashboard is only loaded for admins, not in the initial bundle.
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
import QuotaExhaustedModal from './components/QuotaExhaustedModal';
import { observeAuthState, observePasswordRecovery, getUserSessions, createNewSession, deleteSession, logoutUser, sendMessageToBackend } from './services/storageService';
import { Message, Language, Attachment, User, ChatSession, Perspective } from './types';
import { API_URL } from './constants';

const App: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  // Landing → auth flow for logged-out visitors: null shows the landing page,
  // 'login'/'signup' opens the auth screen on that tab.
  const [authMode, setAuthMode] = useState<null | 'login' | 'signup'>(null);
  // True when the user arrived via a password-reset link — shows the "set a new
  // password" screen instead of the landing page. Seeded synchronously from the
  // URL hash (implicit flow returns #...type=recovery) to avoid any flash.
  const [recoveryMode, setRecoveryMode] = useState<boolean>(
    typeof window !== 'undefined' && window.location.hash.includes('type=recovery')
  );
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [input, setInput] = useState('');
  // Answer perspective: neutral explainer (default), advocate for the user, or
  // help building a claim against another party. Passed per message to the backend.
  const [perspective, setPerspective] = useState<Perspective>('neutral');
  const [isLoading, setIsLoading] = useState(false);
  // Open by default on desktop, closed on mobile (matches Tailwind's md breakpoint).
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  );
  const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isContactAdminOpen, setIsContactAdminOpen] = useState(false);
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [successModal, setSuccessModal] = useState<{ open: boolean; amount?: number; message?: string; subscriptionExpiresAt?: string }>({ open: false });
  // const [searchCost, setSearchCost] = useState(30); // REMOVED: Legacy fixed cost
  const [minRequiredBalance, setMinRequiredBalance] = useState(10.0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; persistent?: boolean } | null>(null);
  const [quotaExhaustedModal, setQuotaExhaustedModal] = useState<{ open: boolean; total: number; resetHours: number }>({ open: false, total: 0, resetHours: 24 });
  const [shownHalfQuotaWarning, setShownHalfQuotaWarning] = useState(false); // Track if 50% warning shown today

  useEffect(() => {
    if (toast && !toast.persistent) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  // Id of the user whose data we've already loaded. Guards the auth listener so
  // the one-time load doesn't re-run on every repeated Supabase auth event.
  const loadedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = observeAuthState((user) => {
      setCurrentUser(user);
      if (user) {
        // Supabase re-fires SIGNED_IN on every tab/window focus and fires
        // TOKEN_REFRESHED on a timer (and getSession + INITIAL_SESSION both fire
        // on mount). Without this guard, each event re-ran loadUserData — which
        // resets the session list, jumps back to the first chat, and flashes the
        // loading spinner — so the app appeared to "repeatedly refresh". Only run
        // the one-time load when the signed-in user actually changes.
        if (loadedUserIdRef.current === user.id) {
          setIsAuthChecking(false);
          return;
        }
        loadedUserIdRef.current = user.id;
        loadUserData(user.id);
        if (!localStorage.getItem('disclaimerAccepted')) {
          setIsDisclaimerOpen(true);
        }
        if (user.is_admin) {
          setShowAdminDashboard(true);
        }

        const urlParams = new URLSearchParams(window.location.search);
        const txRef = urlParams.get('tx_ref');
        if (txRef) {
          const token = localStorage.getItem('token');
          fetch(`${API_URL}/payment/verify/${txRef}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
            .then(res => res.json())
            .then(data => {
              if (data.status === 'success' || data.message === "Payment already verified") {
                window.history.replaceState({}, document.title, window.location.pathname);
                fetch(`${API_URL}/users/me`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                })
                  .then(r => r.json())
                  .then(userData => {
                    setCurrentUser(prev => prev ? {
                      ...prev,
                      balance: userData.balance,
                      subscription_expires_at: userData.subscription_expires_at,
                      monthly_subscription_expires_at: userData.monthly_subscription_expires_at
                    } : null);

                    const is24hSubscription = userData.subscription_expires_at && new Date(userData.subscription_expires_at) > new Date();
                    const isMonthlySubscription = userData.monthly_subscription_expires_at && new Date(userData.monthly_subscription_expires_at) > new Date();

                    if (isMonthlySubscription) {
                      setSuccessModal({
                        open: true,
                        message: 'Monthly Pass Activated!',
                        subscriptionExpiresAt: userData.monthly_subscription_expires_at
                      });
                    } else if (is24hSubscription) {
                      setSuccessModal({
                        open: true,
                        message: '24-Hour Pass Activated!',
                        subscriptionExpiresAt: userData.subscription_expires_at
                      });
                    } else {
                      setSuccessModal({
                        open: true,
                        amount: userData.balance,
                        message: t('accountCredited')
                      });
                    }
                  });
              }
            })
            .catch(err => console.error("Verification failed", err));
        }



        // Fetch dynamic minimum balance
        fetch(`${API_URL}/settings/min-balance`)
          .then(res => res.json())
          .then(data => setMinRequiredBalance(data.min_balance || 10.0))
          .catch(() => setMinRequiredBalance(10.0));
      } else {
        loadedUserIdRef.current = null;
        setSessions([]);
        setCurrentSession(null);
        setMessages([]);
        setShowAdminDashboard(false);
      }
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // Password-reset (recovery) link handling: when the user returns from the
  // reset email, show the "set a new password" screen instead of logging in.
  useEffect(() => {
    const unsubscribe = observePasswordRecovery(() => {
      setRecoveryMode(true);
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, attachments.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadUserData = async (userId: string) => {
    setIsLoading(true);
    try {
      const userSessions = await getUserSessions(userId);
      setSessions(userSessions);
      if (userSessions.length > 0) {
        setCurrentSession(userSessions[0]);
        setMessages(userSessions[0].messages);
      } else {
        await handleNewChat(userId);
      }
    } catch (e) {
      console.error("Failed to load user data", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (user: User) => {
    window.location.reload();
  };

  const handleLogout = async () => {
    await logoutUser();
    window.location.reload();
  };

  const handleNewChat = async (userId: string = currentUser?.id || '') => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const newSession = await createNewSession(userId);
      const welcomeMsg: Message = {
        id: 'welcome-' + Date.now(),
        role: 'model',
        text: t('welcomeText'),
        timestamp: new Date()
      };
      newSession.messages = [welcomeMsg];
      setCurrentSession(newSession);
      setMessages([welcomeMsg]);
      setSessions(prev => [newSession, ...prev]);
      if (window.innerWidth < 768) setIsSidebarOpen(false);
    } catch (e) {
      console.error("New chat error", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSession(session);
    setMessages(session.messages);
  };

  // Calculate free search status
  const totalUserMessages = sessions.reduce((acc, session) =>
    acc + session.messages.filter(m => m.role === 'user').length, 0
  );
  const sessionIsFree = totalUserMessages < 2;

  // Check if user has an active subscription (for UI rendering)
  const has24hSubscription = currentUser?.subscription_expires_at
    ? new Date(currentUser.subscription_expires_at) > new Date()
    : false;
  const hasMonthlySubscription = currentUser?.monthly_subscription_expires_at
    ? new Date(currentUser.monthly_subscription_expires_at) > new Date()
    : false;
  const hasActiveSubscription = has24hSubscription || hasMonthlySubscription;

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isRecording) stopListening();

    if ((!input.trim() && attachments.length === 0) || isLoading || !currentSession || !currentUser) return;

    // Check Minimum Balance (Client Side Pre-check)
    // BYPASS if user has an active subscription
    const hasSubscription = hasActiveSubscription;

    if (!sessionIsFree && !hasSubscription && (currentUser.balance || 0) < minRequiredBalance) {
      setToast({
        message: t('insufficientBalanceMsg', {
          balance: (currentUser.balance || 0).toFixed(2),
          minBalance: minRequiredBalance
        }),
        type: 'error'
      });
      // Also open payment modal directly
      setIsPaymentModalOpen(true);
      return;
    }

    const userText = input.trim();
    const userAttachments = [...attachments];

    setInput('');
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: new Date(),
      attachments: userAttachments
    };

    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      const botResponse = await sendMessageToBackend(currentSession.id, userText, i18n.language as Language, userAttachments, perspective);
      const finalMessages = [...updatedMessages, botResponse];
      setMessages(finalMessages);
      const updatedSessions = await getUserSessions(currentUser.id);
      setSessions(updatedSessions);
      const updatedCurrent = updatedSessions.find(s => s.id === currentSession.id);
      if (updatedCurrent) {
        setCurrentSession(prev => prev ? { ...prev, title: updatedCurrent.title } : null);
      }

      // Update user balance if not free search (optimistic update or fetch from backend)
      if (!sessionIsFree) {
        fetch(`${API_URL}/users/me`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
          .then(r => r.json())
          .then(userData => {
            setCurrentUser(prev => prev ? { ...prev, balance: userData.balance } : null);
          });
      }

      // Check for quota warnings (50% threshold)
      if (botResponse.quotaInfo && botResponse.quotaInfo.percentage >= 50 && botResponse.quotaInfo.percentage < 100 && !shownHalfQuotaWarning) {
        setToast({
          message: t('quotaHalfUsed', { used: botResponse.quotaInfo.used, total: botResponse.quotaInfo.total }),
          type: 'info',
          persistent: true
        });
        setShownHalfQuotaWarning(true);
      }

    } catch (error: any) {
      // Check if it's a quota exhausted error from backend (429)
      if (error.status === 429 || (error.message && error.message.includes('daily_limit_reached'))) {
        // Parse the detail object if available
        let total = 100; // Default
        let resetHours = 24; // Default
        try {
          if (error.detail && typeof error.detail === 'object') {
            total = error.detail.total || 100;
            resetHours = error.detail.reset_hours || 24;
          }
        } catch { }
        setQuotaExhaustedModal({ open: true, total, resetHours });
        return; // Don't show error message
      }

      // Check if it's an insufficient balance error from backend (402)
      if (error.message && error.message.includes("Insufficient balance")) {
        setToast({
          message: t('insufficientBalanceMsg', {
            balance: (currentUser.balance || 0).toFixed(2),
            minBalance: minRequiredBalance
          }),
          type: 'error'
        });
        setIsPaymentModalOpen(true);
      }

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: t('error'),
        timestamp: new Date(),
        isError: true
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

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
        setToast({ message: t('failedToUpload'), type: 'error' });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const startListening = () => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToast({ message: t('browserNotSupported'), type: 'error' });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = i18n.language === 'am' ? 'am-ET' : 'en-US';

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
      }
      if (finalTranscript) setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleDeleteSessionTrigger = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessionToDelete(sessionId);
    setIsClearModalOpen(true);
  };

  const confirmDeleteSession = async () => {
    if (sessionToDelete) {
      await deleteSession(sessionToDelete);
      const updatedSessions = await getUserSessions(currentUser?.id || '');
      setSessions(updatedSessions);
      if (currentSession?.id === sessionToDelete) {
        if (updatedSessions.length > 0) handleSelectSession(updatedSessions[0]);
        else handleNewChat();
      }
    }
    setIsClearModalOpen(false);
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

  // Loading State
  if (isAuthChecking) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-20 h-20 flex items-center justify-center animate-pulse">
              <img src="/logo.png" alt="Logo" className="w-20 h-20 object-contain" />
            </div>
            <div className="absolute inset-0 rounded-2xl bg-emerald-700/25 blur-2xl animate-pulse"></div>
          </div>
          <div className="flex gap-1.5">
            <div className="w-2 h-2 bg-white/70 rounded-full loading-dot"></div>
            <div className="w-2 h-2 bg-white/40 rounded-full loading-dot"></div>
            <div className="w-2 h-2 bg-white/20 rounded-full loading-dot"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden font-sans relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce-in ${toast.type === 'success'
          ? 'bg-gradient-to-r from-emerald-700 to-emerald-600'
          : toast.type === 'error'
            ? 'bg-gradient-to-r from-red-600 to-red-500'
            : 'bg-gradient-to-r from-neutral-800 to-neutral-700'
          } text-white`}>
          {toast.type === 'success' ? (
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            </div>
          ) : toast.type === 'error' ? (
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
          ) : (
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
          )}
          <span className="font-medium text-sm">{toast.message}</span>
          {toast.persistent && (
            <button aria-label="Close"
              onClick={() => setToast(null)}
              className="ml-2 w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>
      )}

      {!currentUser && (
        (authMode === null && !recoveryMode) ? (
          <LandingPage
            onGetStarted={() => setAuthMode('signup')}
            onLogin={() => setAuthMode('login')}
          />
        ) : (
          <AuthModal
            onLogin={handleLogin}
            initialView={recoveryMode ? 'reset' : (authMode || 'login')}
            onBack={recoveryMode ? undefined : () => setAuthMode(null)}
            onRecoveryComplete={() => {
              setRecoveryMode(false);
              setAuthMode('login');
              // Strip the recovery token from the URL so a refresh doesn't re-open the reset screen.
              window.history.replaceState({}, document.title, window.location.pathname);
            }}
          />
        )
      )}

      {currentUser && (
        <>
          <SuccessModal
            isOpen={successModal.open}
            onClose={() => setSuccessModal({ open: false })}
            amount={successModal.amount}
            message={successModal.message}
            subscriptionExpiresAt={successModal.subscriptionExpiresAt}
            title={t('paymentSuccessful')}
          />
          <QuotaExhaustedModal
            isOpen={quotaExhaustedModal.open}
            onClose={() => setQuotaExhaustedModal({ open: false, total: 0, resetHours: 24 })}
            total={quotaExhaustedModal.total}
            resetHours={quotaExhaustedModal.resetHours}
            onSubscribe={() => {
              setQuotaExhaustedModal({ open: false, total: 0, resetHours: 24 });
              setIsPaymentModalOpen(true);
            }}
            onPayAsYouGo={() => {
              setQuotaExhaustedModal({ open: false, total: 0, resetHours: 24 });
              setIsPaymentModalOpen(true);
            }}
          />
          <DisclaimerModal
            isOpen={isDisclaimerOpen}
            onAccept={() => {
              setIsDisclaimerOpen(false);
              localStorage.setItem('disclaimerAccepted', 'true');
            }}
          />

          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf" />

          {/* Delete Confirmation Modal */}
          {isClearModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/70 backdrop-blur-sm p-4 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-scale-in">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-neutral-900">{t('clearChat')}</h3>
                </div>
                <p className="text-neutral-600 mb-6 text-sm">{t('clearChatConfirm')}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsClearModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border-2 border-stone-200 rounded-xl text-neutral-700 font-medium hover:bg-stone-50 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    onClick={confirmDeleteSession}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl font-medium hover:from-red-500 hover:to-red-400 transition-all shadow-lg shadow-red-500/20"
                  >
                    {t('confirmDelete')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <Sidebar
            isOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            user={currentUser}
            sessions={sessions}
            currentSessionId={currentSession?.id || null}
            onSelectSession={handleSelectSession}
            onNewChat={() => handleNewChat()}
            onDeleteSession={handleDeleteSessionTrigger}
            onLogout={handleLogout}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onAddFunds={() => setIsPaymentModalOpen(true)}
            onOpenDocuments={() => setIsDocumentsOpen(true)}
          />

          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            user={currentUser}
            onAddFunds={() => {
              setIsSettingsOpen(false);
              setIsPaymentModalOpen(true);
            }}
            onLogout={handleLogout}
            onContactAdmin={() => setIsContactAdminOpen(true)}
          />

          <PaymentModal
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
            userEmail={currentUser?.email || currentUser?.username + '@ethiolex.com'}
            has24hSubscription={has24hSubscription}
            hasMonthlySubscription={hasMonthlySubscription}
          />

          <ContactAdminModal
            isOpen={isContactAdminOpen}
            onClose={() => setIsContactAdminOpen(false)}
          />

          <DocumentsModal
            isOpen={isDocumentsOpen}
            onClose={() => setIsDocumentsOpen(false)}
            onRecharge={() => setIsPaymentModalOpen(true)}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col h-full relative bg-gradient-to-br from-stone-50 via-white to-stone-50">
            {/* Pattern overlay */}
            <div className="absolute inset-0 pattern-grid opacity-50 pointer-events-none"></div>

            {/* Header */}
            <header className="relative bg-white/80 backdrop-blur-xl h-16 flex items-center justify-between px-4 md:px-6 shadow-sm flex-shrink-0 z-10 border-b border-stone-100">
              {/* Ethiopian stripe accent */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 eth-flag-stripe"></div>

              <div className="flex items-center gap-4">
                {/* Mobile Menu Button */}
                <button
                  aria-label={t('toggleSidebar')}
                  onClick={() => setIsSidebarOpen(true)}
                  className="md:hidden p-2 -ml-2 rounded-xl text-stone-500 hover:text-neutral-800 hover:bg-stone-100 transition-all"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {/* Mobile Logo */}
                <div className="flex items-center gap-2 md:hidden">
                  <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain" />
                  <span className="font-bold text-neutral-900" style={{ fontFamily: "'Playfair Display', serif" }}>EthioLex</span>
                </div>

                {/* Desktop Tagline */}
                <h2 className="hidden md:block text-lg font-bold eth-gradient-text tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                  {t('appTagline')}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                {/* Admin Button */}
                {currentUser?.is_admin && (
                  <button
                    onClick={() => setShowAdminDashboard(!showAdminDashboard)}
                    className={`hidden sm:flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-all ${showAdminDashboard
                      ? 'bg-emerald-800 text-white'
                      : 'bg-stone-100 text-neutral-700 hover:bg-stone-200'
                      }`}
                  >
                    {showAdminDashboard ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        <span>Back to Chat</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>Admin</span>
                      </>
                    )}
                  </button>
                )}

                {/* Language Toggle */}
                <div className="flex bg-stone-100 p-1 rounded-xl">
                  <button
                    onClick={() => i18n.changeLanguage('en')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${i18n.language === 'en'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-stone-500 hover:text-neutral-700'
                      }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => i18n.changeLanguage('am')}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${i18n.language === 'am'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-stone-500 hover:text-neutral-700'
                      }`}
                  >
                    አማርኛ
                  </button>
                </div>
              </div>
            </header>

            {/* Chat Area */}
            <main id="main-content" className="flex-1 overflow-y-auto px-4 py-6 md:px-8 scroll-smooth">
              {showAdminDashboard ? (
                <React.Suspense fallback={<div className="flex items-center justify-center py-20"><div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>}>
                  <AdminDashboard onBack={() => setShowAdminDashboard(false)} />
                </React.Suspense>
              ) : (
                <div className="max-w-3xl mx-auto">
                  {/* Welcome State */}
                  {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
                      <div className="mb-6">
                        <img src="/logo.png" alt="Logo" className="w-24 h-24 object-contain" />
                      </div>
                      <h2 className="text-2xl font-bold text-neutral-900 mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                        {t('welcomeTitle')}
                      </h2>
                      <p className="text-stone-500 max-w-md text-sm">
                        {t('welcomeText')}
                      </p>
                    </div>
                  )}

                  {/* Messages */}
                  {messages.map(msg => (
                    <ChatMessage key={msg.id} message={msg} />
                  ))}

                  {/* Loading Indicator */}
                  {isLoading && (
                    <div className="flex w-full mb-6 justify-start animate-fade-in">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 h-10 w-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center shadow-sm">
                          <img src="/logo.png" alt="" className="w-7 h-7 object-contain" />
                        </div>
                        <div className="bg-white border border-stone-100 px-5 py-4 rounded-2xl rounded-tl-sm shadow-lg">
                          <div className="flex items-center gap-3">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-emerald-800 rounded-full loading-dot"></div>
                              <div className="w-2 h-2 bg-emerald-800/50 rounded-full loading-dot"></div>
                              <div className="w-2 h-2 bg-emerald-800/25 rounded-full loading-dot"></div>
                            </div>
                            <span className="text-xs text-neutral-400 font-medium">{t('consulting')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </main>

            {/* Input Area */}
            <div className="relative bg-white/80 backdrop-blur-xl border-t border-stone-100 p-4 md:p-6 flex-shrink-0">
              <div className="max-w-3xl mx-auto">
                {/* Answer Perspective / Court Mode selector */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mr-0.5">{t('answerMode')}</span>
                  <div className="inline-flex flex-wrap gap-1.5">
                    {([
                      { id: 'neutral', icon: '⚖️', label: t('modeNeutral') },
                      { id: 'lawyer', icon: '🛡️', label: t('modeLawyer') },
                      { id: 'claimant', icon: '📣', label: t('modeClaimant') },
                    ] as { id: Perspective; icon: string; label: string }[]).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPerspective(m.id)}
                        aria-pressed={perspective === m.id}
                        title={t(m.id === 'neutral' ? 'modeNeutralDesc' : m.id === 'lawyer' ? 'modeLawyerDesc' : 'modeClaimantDesc')}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${perspective === m.id
                          ? 'bg-emerald-800 text-white border-emerald-800'
                          : 'bg-white text-neutral-600 border-stone-200 hover:border-emerald-300 hover:text-emerald-700'
                          }`}
                      >
                        <span aria-hidden="true">{m.icon}</span>{m.label}
                      </button>
                    ))}
                  </div>
                  {perspective !== 'neutral' && (
                    <span className="text-[11px] text-neutral-400 w-full sm:w-auto sm:ml-1">
                      {t(perspective === 'lawyer' ? 'modeLawyerDesc' : 'modeClaimantDesc')}
                    </span>
                  )}
                </div>

                {/* Attachments Preview */}
                {attachments.length > 0 && (
                  <div className="flex gap-3 mb-4 overflow-x-auto py-2">
                    {attachments.map((att, index) => (
                      <div key={index} className="relative group flex-shrink-0 animate-scale-in">
                        {att.type === 'image' ? (
                          <div className="relative overflow-hidden rounded-xl border border-stone-200 shadow-md">
                            <img src={`data:${att.mimeType};base64,${att.data}`} className="h-20 w-20 object-cover" alt="Preview" />
                          </div>
                        ) : (
                          <div className="h-20 w-20 bg-gradient-to-br from-stone-50 to-stone-100 rounded-xl border border-stone-200 flex flex-col items-center justify-center px-2 shadow-md">
                            <svg className="w-6 h-6 text-neutral-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-[10px] text-stone-500 truncate w-full text-center font-medium">{att.name}</span>
                          </div>
                        )}
                        <button aria-label="Close"
                          onClick={() => removeAttachment(index)}
                          className="absolute -top-1.5 -right-1.5 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Insufficient Balance Warning - Only show if NO active subscription */}
                {currentUser && !hasActiveSubscription && (currentUser.balance || 0) < minRequiredBalance && sessionIsFree === false && (
                  <div className="mb-4 p-4 bg-gradient-to-r from-red-50 to-rose-50 border border-red-100 rounded-2xl flex items-center justify-between gap-4 animate-slide-up">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-red-800">{t('insufficientBalanceTitle')}</p>
                        <p className="text-xs text-red-600">
                          {t('insufficientBalanceMsg', {
                            balance: (currentUser.balance || 0).toFixed(2),
                            minBalance: minRequiredBalance
                          })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="flex-shrink-0 bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:from-red-500 hover:to-red-400 transition-all shadow-lg shadow-red-500/20"
                    >
                      {t('addFunds')}
                    </button>
                  </div>
                )}

                {/* Input Container */}
                <div className={`relative flex items-end gap-2 bg-white border-2 rounded-2xl p-2 transition-all shadow-lg ${isRecording
                  ? 'border-red-300 ring-4 ring-red-100'
                  : 'border-stone-200 focus-within:border-emerald-700 focus-within:ring-4 focus-within:ring-emerald-800/10'
                  } ${currentUser && !hasActiveSubscription && (currentUser.balance || 0) < minRequiredBalance && !sessionIsFree ? 'opacity-50 pointer-events-none' : ''}`}>

                  {/* Attachment Button */}
                  <button
                    aria-label={t('uploadFile')}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 rounded-xl text-neutral-400 hover:text-emerald-800 hover:bg-emerald-50 transition-all disabled:opacity-50"
                    disabled={isRecording || (currentUser && !hasActiveSubscription && (currentUser.balance || 0) < minRequiredBalance && !sessionIsFree)}
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                  </button>

                  {/* Voice Button */}
                  <button
                    aria-label={isRecording ? t('stopRecording') : t('voiceInput')}
                    onClick={isRecording ? stopListening : startListening}
                    className={`p-3 rounded-xl transition-all ${isRecording
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 animate-pulse'
                      : 'text-neutral-400 hover:text-emerald-800 hover:bg-emerald-50'
                      }`}
                    disabled={currentUser && !hasActiveSubscription && (currentUser.balance || 0) < minRequiredBalance && !sessionIsFree}
                  >
                    {isRecording ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                      </svg>
                    )}
                  </button>

                  {/* Text Input */}
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={adjustTextareaHeight}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      currentUser && !hasActiveSubscription && (currentUser.balance || 0) < minRequiredBalance && !sessionIsFree
                        ? t('insufficientBalance')
                        : isRecording
                          ? t('listening')
                          : t('inputPlaceholder')
                    }
                    className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[44px] py-3 px-2 text-neutral-800 placeholder-neutral-400 text-sm outline-none"
                    rows={1}
                    disabled={isLoading || (currentUser && !hasActiveSubscription && (currentUser.balance || 0) < minRequiredBalance && !sessionIsFree)}
                  />

                  {/* Send Button */}
                  <button
                    aria-label={t('send')}
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || (!input.trim() && attachments.length === 0) || (currentUser && !hasActiveSubscription && (currentUser.balance || 0) < minRequiredBalance && !sessionIsFree)}
                    className={`p-3 rounded-xl transition-all ${isLoading || (!input.trim() && attachments.length === 0) || (currentUser && !hasActiveSubscription && (currentUser.balance || 0) < minRequiredBalance && !sessionIsFree)
                      ? 'bg-stone-100 text-neutral-400 cursor-not-allowed'
                      : 'bg-emerald-800 text-white shadow-md hover:bg-emerald-700'
                      }`}
                  >
                    <svg className="w-5 h-5 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                  </button>
                </div>

                {/* Disclaimer */}
                <p className="text-center text-[10px] text-neutral-400 mt-3">
                  <span className="text-neutral-400 font-medium">{t('disclaimerText').split('.')[0]}.</span>
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
