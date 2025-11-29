
import { User, ChatSession, Message } from '../types';

// Storage Keys
const USERS_KEY = 'ethiolex_users';
const SESSIONS_KEY = 'ethiolex_sessions';
const CURRENT_USER_KEY = 'ethiolex_current_user';

// --- User Management (Simulating Backend Auth) ---

export const registerUser = (username: string, password: string): User => {
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];

  if (users.find(u => u.username === username)) {
    throw new Error('Username already exists');
  }

  const newUser: User = {
    id: Date.now().toString(),
    username,
    passwordHash: btoa(password), // Simple encoding for mock purposes
    createdAt: new Date(),
    authProvider: 'local'
  };

  users.push(newUser);
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return newUser;
};

export const loginUser = (username: string, password: string): User => {
  const usersStr = localStorage.getItem(USERS_KEY);
  const users: User[] = usersStr ? JSON.parse(usersStr) : [];
  
  const user = users.find(u => u.username === username && u.passwordHash === btoa(password) && u.authProvider === 'local');
  
  if (!user) {
    throw new Error('Invalid credentials');
  }
  
  localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  return user;
};

export const loginWithGoogle = (simulatedName: string): Promise<User> => {
  // Simulate network delay and external auth process
  return new Promise((resolve) => {
    setTimeout(() => {
      const usersStr = localStorage.getItem(USERS_KEY);
      const users: User[] = usersStr ? JSON.parse(usersStr) : [];
      
      // Use timestamp for unique ID to support unicode names safely (btoa fails on unicode)
      const googleId = "google_" + Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
      
      // Check if we already have a google user with this exact name for this demo
      let user = users.find(u => u.authProvider === 'google' && u.username === simulatedName);
      
      if (!user) {
        // Create new user
        user = {
          id: googleId,
          username: simulatedName,
          createdAt: new Date(),
          authProvider: 'google'
        };
        users.push(user);
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
      
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      resolve(user);
    }, 1500);
  });
};

export const logoutUser = () => {
  localStorage.removeItem(CURRENT_USER_KEY);
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem(CURRENT_USER_KEY);
  return userStr ? JSON.parse(userStr) : null;
};

// --- Chat History Management (Simulating Backend DB) ---

export const getUserSessions = (userId: string): ChatSession[] => {
  const sessionsStr = localStorage.getItem(SESSIONS_KEY);
  const allSessions: ChatSession[] = sessionsStr ? JSON.parse(sessionsStr) : [];
  
  // Filter by user ID and sort by date desc
  return allSessions
    .filter(s => s.userId === userId)
    .map(s => ({...s, updatedAt: new Date(s.updatedAt), messages: s.messages.map(m => ({...m, timestamp: new Date(m.timestamp)}))}))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
};

export const saveSession = (session: ChatSession) => {
  const sessionsStr = localStorage.getItem(SESSIONS_KEY);
  let allSessions: ChatSession[] = sessionsStr ? JSON.parse(sessionsStr) : [];
  
  const existingIndex = allSessions.findIndex(s => s.id === session.id);
  
  if (existingIndex >= 0) {
    allSessions[existingIndex] = session;
  } else {
    allSessions.push(session);
  }
  
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(allSessions));
};

export const deleteSession = (sessionId: string) => {
  const sessionsStr = localStorage.getItem(SESSIONS_KEY);
  let allSessions: ChatSession[] = sessionsStr ? JSON.parse(sessionsStr) : [];
  
  allSessions = allSessions.filter(s => s.id !== sessionId);
  
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(allSessions));
};

export const createNewSession = (userId: string, firstMessage?: string): ChatSession => {
  return {
    id: Date.now().toString(),
    userId,
    title: firstMessage ? (firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '')) : 'New Consultation',
    messages: [],
    updatedAt: new Date()
  };
};
