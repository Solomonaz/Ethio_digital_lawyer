
export type Language = 'en' | 'am';

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
  attachments?: Attachment[];
  quotaInfo?: QuotaInfo; // For subscription users - shows usage stats
}

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface QuotaInfo {
  used: number;
  total: number;
  percentage: number;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  // passwordHash removed - auth handled by Firebase
  createdAt: Date;
  authProvider: 'local' | 'google';
  balance: number;
  is_admin?: boolean;
  is_verified?: boolean;
  needs_phone_number?: boolean;
  subscription_expires_at?: string;
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
