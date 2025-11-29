
import { Language } from './types';

export const APP_NAME = "EthioLex";

export const SYSTEM_INSTRUCTION = `You are EthioLex, a highly skilled and professional AI Digital Lawyer specialized in Ethiopian Law.

**CORE DIRECTIVE**: You are a STRICTLY LEGAL AI. You must ONLY answer questions related to Ethiopian Law, legal procedures, court cases, rights, and regulations (Constitution, Criminal Code, Civil Code, Labor Proclamation, etc.).

**STRICT SCOPE ENFORCEMENT**:
Before answering, evaluate the user's query:
1.  **Is this a legal question?** (e.g., "How do I sue?", "What is the penalty for theft?", "Landlord rights").
2.  **Is this a non-legal question?** (e.g., "How to bake injera?", "Who is the prime minister?", "Write me a poem", "Solve this math problem").
3.  **IF NON-LEGAL**: You MUST politely refuse to answer. State clearly that you are a specialized Legal AI designed only for Ethiopian legal matters. Do not provide the non-legal information.

**RESPONSE GUIDELINES**:
1.  **Analyze the Situation**: Understand the legal implications.
2.  **Cite Sources**: You MUST use the Google Search tool to find specific Articles/Proclamations. Explicitly mention "Article X of the Criminal Code" or "Proclamation No. Y".
3.  **Language**: You MUST respond in the language specified by the system prompt context (English or Amharic).
4.  **Tone**: Professional, objective, empathetic.
5.  **Disclaimer**: ALWAYS conclude with a reminder that this is information, not legal advice, and to consult a qualified lawyer.

**For Amharic Responses**:
- Ensure the Amharic is formal and legally accurate.
- Translate legal terms appropriately.
`;

export const UI_STRINGS: Record<Language, Record<string, string>> = {
  en: {
    // App
    appTagline: "Ethiopian Digital Lawyer",
    // Auth
    welcomeBack: "Welcome Back",
    createAccount: "Create Account",
    signInGoogle: "Sign in with Google",
    username: "Username",
    password: "Password",
    login: "Log In",
    signup: "Sign Up",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    authSubtitle: "Sign in to access your legal history",
    // Sidebar
    newChat: "New Consultation",
    today: "Today",
    yesterday: "Yesterday",
    previous7Days: "Previous 7 Days",
    older: "Older",
    noHistory: "No consultation history found.",
    freeAccount: "Free Account",
    logout: "Logout",
    // Main UI
    welcomeTitle: "Welcome to EthioLex",
    welcomeText: "I am your digital legal assistant specialized in Ethiopian Law. I can help you understand the Constitution, Criminal Code, and Civil Code. How can I help you today?",
    inputPlaceholder: "Type a message or use voice...",
    send: "Send",
    disclaimerTitle: "Important Disclaimer",
    disclaimerText: "EthioLex is an AI tool, not a human lawyer. Information is for guidance only. Consult a certified Ethiopian attorney for court representation.",
    acceptDisclaimer: "I Understand & Agree",
    clearChat: "Delete Chat",
    clearChatConfirm: "Are you sure you want to delete this conversation?",
    cancel: "Cancel",
    confirm: "Yes, Delete",
    legalOnlyWarning: "I can only assist with Ethiopian legal matters.",
    sources: "Sources",
    consulting: "Consulting Ethiopian Legal Codes...",
    error: "I encountered an error. Please try again.",
    beta: "Beta",
    resources: "Resources",
    listening: "Listening... (Speak now)",
    uploadFile: "Upload File",
    stopRecording: "Stop & Convert to Text"
  },
  am: {
    // App
    appTagline: "የኢትዮጵያ ዲጂታል ጠበቃ",
    // Auth
    welcomeBack: "እንኳን ደህና መጡ",
    createAccount: "መለያ ይፍጠሩ",
    signInGoogle: "በ Google ይግቡ",
    username: "የተጠቃሚ ስም",
    password: "የይለፍ ቃል",
    login: "ግቡ",
    signup: "ይመዝገቡ",
    noAccount: "መለያ የለዎትም? ",
    hasAccount: "መለያ አለዎት? ",
    authSubtitle: "የህግ ምክክር ታሪክዎን ለማግኘት ይግቡ",
    // Sidebar
    newChat: "አዲስ ምክክር",
    today: "ዛሬ",
    yesterday: "ትናንት",
    previous7Days: "ያለፉት 7 ቀናት",
    older: "የቆዩ",
    noHistory: "ምንም የምክክር ታሪክ አልተገኘም።",
    freeAccount: "ነጻ መለያ",
    logout: "ውጣ",
    // Main UI
    welcomeTitle: "እንኳን ወደ ኢትዮ-ሌክስ (EthioLex) በደህና መጡ",
    welcomeText: "እኔ በኢትዮጵያ ህግ ላይ የተካነ ዲጂታል የህግ ረዳት ነኝ። ህገ-መንግስቱን፣ የወንጀል ህግን እና የፍትሐ ብሄር ህግን እንዲረዱ ልረዳዎ እችላለሁ። ዛሬ ምን ልርዳዎ?",
    inputPlaceholder: "መልእክት ይጻፉ ወይም በድምጽ ይናገሩ...",
    send: "ላክ",
    disclaimerTitle: "አስፈላጊ ማሳሰቢያ",
    disclaimerText: "ኢትዮ-ሌክስ (EthioLex) የኤአይ (AI) መሳሪያ እንጂ የሰው ጠበቃ አይደለም። የቀረበው መረጃ ለመሪነት ብቻ ነው። ለፍርድ ቤት ጉዳዮች የተረጋገጠ የኢትዮጵያ ጠበቃ ያማክሩ።",
    acceptDisclaimer: "ተረድቻለሁ እና እስማማለሁ",
    clearChat: "ውይይቱን አጥፋ",
    clearChatConfirm: "ይህን የውይይት ታሪክ መሰረዝ ይፈልጋሉ?",
    cancel: "አይ",
    confirm: "አዎ፣ አጥፋው",
    legalOnlyWarning: "እኔ መርዳት የምችለው በኢትዮጵያ የህግ ጉዳዮች ላይ ብቻ ነው።",
    sources: "ምንጮች",
    consulting: "የኢትዮጵያ ህጎችን በማጣቀስ ላይ...",
    error: "ስህተት አጋጠመኝ። እባክዎ እንደገና ይሞክሩ።",
    beta: "ቤታ",
    resources: "ጠቃሚ ምንጮች",
    listening: "እየሰማሁ ነው... (ይናገሩ)",
    uploadFile: "ፋይል ስቀል",
    stopRecording: "አቁም እና ወደ ጽሁፍ ቀይር"
  }
};
