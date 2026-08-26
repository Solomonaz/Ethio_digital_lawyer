import { User, ChatSession, Message, Language, Attachment, Perspective } from '../types';
import { supabase, setAuthSuppressed, isAuthSuppressed, setRecoveryMode, isRecoveryMode } from './supabase';

// API Base URL (Relative because of Vite Proxy)
const API_URL = import.meta.env.VITE_API_URL || '/api';

// --- AUTH (Supabase) ---

// Map the backend /users/me response to the app's User shape.
const mapUser = (u: any): User => ({
    id: u.id.toString(),
    username: u.username,
    name: u.name || undefined,
    email: u.email,
    createdAt: u.created_at ? new Date(u.created_at) : new Date(),
    authProvider: u.auth_provider || 'supabase',
    balance: u.balance || 0,
    is_admin: u.is_admin || false,
    is_verified: u.is_verified || false,
    subscription_expires_at: u.subscription_expires_at || undefined,
    monthly_subscription_expires_at: u.monthly_subscription_expires_at || undefined,
});

// Fetch the app profile for the current Supabase session.
const fetchProfile = async (accessToken: string): Promise<User> => {
    const res = await fetch(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!res.ok) throw new Error('Failed to load profile');
    return mapUser(await res.json());
};

// Sign up with email + password. Does NOT log the user in — after creating the
// account we sign out (when confirmation is off) so the user logs in manually
// with their new credentials. Returns whether email confirmation is pending.
export const registerUser = async (
    name: string, email: string, phoneNumber: string, password: string
): Promise<{ needsConfirmation: boolean }> => {
    setAuthSuppressed(true);
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name, phone: phoneNumber } }
        });
        if (error) throw new Error(error.message);
        // If confirmation is OFF, signUp returns a live session — drop it so the
        // user is not auto-logged-in and must sign in manually.
        if (data.session) {
            await supabase.auth.signOut();
        }
        return { needsConfirmation: !data.session };
    } finally {
        setAuthSuppressed(false);
    }
};

export const loginUser = async (email: string, password: string): Promise<User> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    const token = data.session?.access_token;
    if (!token) throw new Error('Login failed');
    localStorage.setItem('token', token);
    return fetchProfile(token);
};

// Starts the Google OAuth redirect. The page navigates away and returns with a
// session, which observeAuthState picks up. Nothing is returned synchronously.
export const loginWithGoogle = async (): Promise<void> => {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
    });
    if (error) throw new Error(error.message);
};

export const logoutUser = async (): Promise<void> => {
    await supabase.auth.signOut();
    localStorage.removeItem('token');
};

// --- PASSWORD RESET (Supabase) ---

// Sends a password-reset email. The link returns the user to the app with a
// recovery token, which Supabase turns into a temporary recovery session and
// signals with the PASSWORD_RECOVERY auth event (see observePasswordRecovery).
export const requestPasswordReset = async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        // Return to the app itself; the recovery token rides in the URL and is
        // consumed automatically (detectSessionInUrl) to open the reset screen.
        redirectTo: `${window.location.origin}${window.location.pathname}`,
    });
    if (error) throw new Error(error.message);
};

// Sets a new password for the user in the active recovery session.
export const updatePassword = async (newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
};

// Notifies the app when the user has arrived via a password-reset link, so it
// can show the "set a new password" screen. Fires on the PASSWORD_RECOVERY
// event, and immediately if the recovery link was already detected in the URL
// (the synchronous check in supabase.ts) before this listener was attached.
export const observePasswordRecovery = (callback: () => void) => {
    if (isRecoveryMode()) callback();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
            setRecoveryMode(true);
            callback();
        }
    });
    return () => sub.subscription.unsubscribe();
};

// Ends the recovery flow after the password was updated and signs out, so the
// user logs in fresh with their new password (mirrors the sign-up convention).
export const finishPasswordRecovery = async (): Promise<void> => {
    setRecoveryMode(false);
    await supabase.auth.signOut();
    localStorage.removeItem('token');
};

export const observeAuthState = (callback: (user: User | null) => void) => {
    const handle = async (accessToken: string | undefined) => {
        // Ignore transient auth events while signing up (create-then-signout).
        if (isAuthSuppressed()) return;
        // During password recovery the session belongs to the reset flow, not a
        // real login — report "logged out" so the app shows the reset screen
        // (and still clears the auth-checking spinner) rather than the dashboard.
        if (isRecoveryMode()) { callback(null); return; }
        if (accessToken) {
            localStorage.setItem('token', accessToken);
            try {
                callback(await fetchProfile(accessToken));
            } catch (e) {
                console.error('Error fetching user data:', e);
                callback(null);
            }
        } else {
            localStorage.removeItem('token');
            callback(null);
        }
    };

    // Initial session (also completes an OAuth redirect if present)
    supabase.auth.getSession().then(({ data }) => handle(data.session?.access_token));

    // React to sign-in / sign-out / token refresh
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
        handle(session?.access_token);
    });

    return () => sub.subscription.unsubscribe();
};

// --- PHONE VERIFICATION ---

export const requestVerificationCode = async (phoneNumber: string): Promise<{ message: string; expires_in: number; dev_code?: string }> => {
    const res = await fetch(`${API_URL}/auth/request-verification`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ phone_number: phoneNumber })
    });

    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to send verification code');
    }

    return res.json();
};

export const verifyPhoneCode = async (phoneNumber: string, code: string): Promise<{ message: string; is_verified: boolean }> => {
    const res = await fetch(`${API_URL}/auth/verify-phone`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ phone_number: phoneNumber, code })
    });

    if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Verification failed');
    }

    return res.json();
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
                timestamp: new Date(m.timestamp),
                legalCitations: m.legalCitations || undefined
            })),
            updatedAt: d.updated_at ? new Date(d.updated_at) : new Date()
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
    attachments: Attachment[],
    perspective: Perspective = 'neutral'
): Promise<Message> => {
    try {
        const res = await fetch(`${API_URL}/chats/${sessionId}/message`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                message,
                language,
                perspective,
                attachments: attachments.length > 0 ? attachments : null
            })
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('Send message error:', errorText);

            // Create error with status for proper handling (e.g., 429 quota exceeded)
            const error: any = new Error('Failed to send message');
            error.status = res.status;

            try {
                const errorData = JSON.parse(errorText);
                if (errorData.detail) {
                    error.message = typeof errorData.detail === 'string' ? errorData.detail : 'daily_limit_reached';
                    error.detail = errorData.detail;
                }
            } catch (e) {
                // If parsing fails, use generic message
            }
            throw error;
        }

        const d = await res.json();
        return {
            id: d.id.toString(),
            role: d.role,
            text: d.text,
            timestamp: new Date(d.timestamp),
            groundingSources: d.groundingSources,
            legalCitations: d.legalCitations || undefined,
            quotaInfo: d.quotaInfo // Include quota info for frontend warnings
        };
    } catch (error) {
        console.error('Error sending message:', error);
        throw error;
    }
};