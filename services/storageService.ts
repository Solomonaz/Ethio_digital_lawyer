import { User, ChatSession, Message, Language, Attachment } from '../types';

// API Base URL (Relative because of Vite Proxy)
const API_URL = '/api';

// --- AUTH ---

export const registerUser = async (username: string, password: string): Promise<User> => {
    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Registration error response:', errorText);
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                throw new Error('Registration failed: ' + errorText);
            }
            throw new Error(errorData.detail || 'Registration failed');
        }
        
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        return {
            id: data.user_id.toString(),
            username: data.username,
            createdAt: new Date(),
            authProvider: 'local'
        };
    } catch (error: any) {
        console.error('Registration error:', error);
        throw error;
    }
};

export const loginUser = async (username: string, password: string): Promise<User> => {
    try {
        const res = await fetch(`${API_URL}/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Login error response:', errorText);
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
    } catch (error: any) {
        console.error('Login error:', error);
        throw error;
    }
};

export const loginWithGoogle = async (): Promise<User> => {
    try {
        // Import Firebase auth dynamically
        const { signInWithPopup } = await import('firebase/auth');
        const { auth, googleProvider } = await import('./firebase');

        // Open Google Sign-In popup
        const result = await signInWithPopup(auth, googleProvider);
        
        // Get user info from Google
        const firebaseUser = result.user;
        const username = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
        const email = firebaseUser.email || '';

        // Send to backend to create/login user
        const res = await fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username, 
                email,
                firebaseUid: firebaseUser.uid,
                photoURL: firebaseUser.photoURL
            })
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Google login error:', errorText);
            throw new Error("Login failed");
        }
        
        const data = await res.json();
        localStorage.setItem('token', data.access_token);
        return {
            id: data.user_id.toString(),
            username: data.username,
            createdAt: new Date(),
            authProvider: 'google'
        };
    } catch (error: any) {
        console.error('Google login error:', error);
        if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('Sign-in cancelled');
        }
        throw error;
    }
};

export const logoutUser = async (): Promise<void> => {
    localStorage.removeItem('token');
};

export const observeAuthState = (callback: (user: User | null) => void) => {
    // Check if token exists
    const token = localStorage.getItem('token');
    if (token) {
        try {
            // Decode JWT token
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
                window.atob(base64)
                    .split('')
                    .map(function(c) {
                        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                    })
                    .join('')
            );
            
            const payload = JSON.parse(jsonPayload);
            
            // Check if token is expired
            if (payload.exp && payload.exp * 1000 < Date.now()) {
                localStorage.removeItem('token');
                callback(null);
                return () => {};
            }
            
            callback({
                id: "backend-id",
                username: payload.sub,
                createdAt: new Date(),
                authProvider: 'local'
            });
        } catch (error) {
            console.error('Error decoding token:', error);
            localStorage.removeItem('token');
            callback(null);
        }
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
    try {
        const res = await fetch(`${API_URL}/chats`, { headers: getAuthHeaders() });
        if (!res.ok) {
            console.error('Failed to get sessions');
            return [];
        }
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
    } catch (error) {
        console.error('Error getting sessions:', error);
        return [];
    }
};

export const createNewSession = async (userId: string): Promise<ChatSession> => {
    try {
        const res = await fetch(`${API_URL}/chats`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ title: "New Consultation" })
        });
        
        if (!res.ok) {
            throw new Error('Failed to create session');
        }
        
        const d = await res.json();
        return {
            id: d.id,
            userId: d.user_id.toString(),
            title: d.title,
            messages: [],
            updatedAt: new Date(d.updated_at)
        };
    } catch (error) {
        console.error('Error creating session:', error);
        throw error;
    }
};

export const deleteSession = async (sessionId: string): Promise<void> => {
    try {
        await fetch(`${API_URL}/chats/${sessionId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
    } catch (error) {
        console.error('Error deleting session:', error);
    }
};

export const sendMessageToBackend = async (
    sessionId: string, 
    message: string, 
    language: Language, 
    attachments: Attachment[]
): Promise<Message> => {
    try {
        const res = await fetch(`${API_URL}/chats/${sessionId}/message`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                message,
                language,
                attachments: attachments.length > 0 ? attachments : null
            })
        });
        
        if (!res.ok) {
            const errorText = await res.text();
            console.error('Send message error:', errorText);
            throw new Error('Failed to send message');
        }
        
        const d = await res.json();
        return {
            id: d.id.toString(),
            role: d.role,
            text: d.text,
            timestamp: new Date(d.timestamp),
            groundingSources: d.groundingSources
        };
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};