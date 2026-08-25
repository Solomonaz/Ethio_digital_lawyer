
export type Language = 'en' | 'am';

// Stance of the AI answer: neutral explainer, advocate for the user, or
// help building a claim against another party (court-oriented).
export type Perspective = 'neutral' | 'lawyer' | 'claimant';

export interface Attachment {
  type: 'image' | 'file' | 'audio';
  mimeType: string;
  data: string; // Base64 string
  name?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isError?: boolean;
  groundingSources?: GroundingSource[];
  legalCitations?: LegalCitation[]; // Verified Ethiopian-law provisions grounding the answer
  attachments?: Attachment[];
  quotaInfo?: QuotaInfo; // For subscription users - shows usage stats
}

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface LegalCitation {
  id?: number;
  law_code: string;
  article?: string | null;
  title?: string | null;
  snippet: string;
  source_url?: string | null;
  relevance?: number;
}

export interface QuotaInfo {
  used: number;
  total: number;
  percentage: number;
}

export interface User {
  id: string;
  username: string;
  name?: string; // Full display name from signup
  email?: string;
  // Auth is handled by Supabase Auth
  createdAt: Date;
  authProvider: 'local' | 'google' | 'supabase';
  balance: number;
  is_admin?: boolean;
  is_verified?: boolean;
  needs_phone_number?: boolean;
  subscription_expires_at?: string;
  monthly_subscription_expires_at?: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  messages: Message[];
  updatedAt: Date; // Used for sorting history
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}
