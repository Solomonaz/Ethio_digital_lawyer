
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
}

export interface GroundingSource {
  title?: string;
  uri?: string;
}

export interface User {
  id: string;
  username: string;
  // passwordHash removed - auth handled by Firebase
  createdAt: Date;
  authProvider: 'local' | 'google';
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
