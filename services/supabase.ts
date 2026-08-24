import { createClient, Session } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Surface a clear message during development if the env vars are missing.
    console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Add them to the project .env');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // completes the Google OAuth redirect automatically
    },
});

// --- Auth suppression ---
// During signup we create then immediately sign out the session (so the user
// must log in manually). While suppressed, observeAuthState ignores auth events
// so the app never briefly flips to a logged-in state.
let _authSuppressed = false;
export const setAuthSuppressed = (v: boolean) => { _authSuppressed = v; };
export const isAuthSuppressed = () => _authSuppressed;

// --- Token bridge ---
// Older parts of the app read the access token from localStorage['token'].
// Keep it in sync with the Supabase session (login / refresh / logout) so those
// components keep working without changes.
const syncToken = (session: Session | null) => {
    if (session?.access_token) {
        localStorage.setItem('token', session.access_token);
    } else {
        localStorage.removeItem('token');
    }
};

supabase.auth.getSession().then(({ data }) => syncToken(data.session));
supabase.auth.onAuthStateChange((_event, session) => syncToken(session));
