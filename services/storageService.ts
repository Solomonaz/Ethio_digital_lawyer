import { User, ChatSession, Message, Language, Attachment } from '../types';

// API Base URL (Relative because of Vite Proxy)
const API_URL = '/api';

// --- AUTH ---

export const registerUser = async (username: string, password: string): Promise<User> => {
    const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Registration failed');
    }
    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    return {
        id: data.user_id.toString(),
        username: data.username,
        createdAt: new Date(),
        authProvider: 'local'
    };
};

export const loginUser = async (username: string, password: string): Promise<User> => {
    const res = await fetch(`${API_URL}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (!res.ok) {
        throw new Error('Invalid credentials');
    }
    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    return {
        id: data.user_id.toString(),
        username: data.username,
        createdAt: new Date(),
        authProvider: 'local'
    };
};

export const loginWithGoogle = async (): Promise<User> => {
    // Simulation for frontend "Mock" google login -> Backend "Mock" google login
    const username = prompt("Enter the name you want to use:");
    if (!username) throw new Error("Cancelled");
    
    const email = `${username.toLowerCase().replace(/\s/g, '')}@gmail.com`;

    const res = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email })
    });
    
    if (!res.ok) throw new Error("Login failed");
    
    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    return {
        id: data.user_id.toString(),
        username: data.username,
        createdAt: new Date(),
        authProvider: 'google'
    };
};

export const logoutUser = async (): Promise<void> => {
    localStorage.removeItem('token');
};

export const observeAuthState = (callback: (user: User | null) => void) => {
    // Check if token exists
    const token = localStorage.getItem('token');
    if (token) {
        // In a real app, verify token endpoint /users/me
        // For now, assume valid or decode JWT
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        const payload = JSON.parse(jsonPayload);
        
        callback({
            id: "backend-id", // User ID is inside DB, simplify for now
            username: payload.sub,
            createdAt: new Date(),
            authProvider: 'local'
        });
    } else {
        callback(null);
    }
    return () => {}; // Unsubscribe function
};

// --- CHATS ---

const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
});

export const getUserSessions = async (userId: string): Promise<ChatSession[]> => {
    const res = await fetch(`${API_URL}/chats`, { headers: getAuthHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map((d: any) => ({
        id: d.id,
        userId: d.user_id.toString(),
        title: d.title,
        messages: d.messages.map((m: any) => ({
            id: m.id.toString(),
            role: m.role,
            text: m.content,
            timestamp: new Date(m.timestamp)
        })),
        updatedAt: new Date(d.updated_at)
    }));
};

export const createNewSession = async (userId: string): Promise<ChatSession> => {
    const res = await fetch(`${API_URL}/chats`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ title: "New Consultation" })
    });
    const d = await res.json();
    return {
        id: d.id,
        userId: d.user_id.toString(),
        title: d.title,
        messages: [],
        updatedAt: new Date(d.updated_at)
    };
};

export const deleteSession = async (sessionId: string): Promise<void> => {
    await fetch(`${API_URL}/chats/${sessionId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
};

export const sendMessageToBackend = async (
    sessionId: string, 
    message: string, 
    language: Language, 
    attachments: Attachment[]
): Promise<Message> => {
    const res = await fetch(`${API_URL}/chats/${sessionId}/message`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
            message,
            language,
            attachments: attachments.length > 0 ? attachments : null
        })
    });
    
    if (!res.ok) throw new Error("Failed to send message");
    
    const d = await res.json();
    return {
        id: d.id.toString(),
        role: d.role,
        text: d.text,
        timestamp: new Date(d.timestamp),
        groundingSources: d.groundingSources
    };
};
