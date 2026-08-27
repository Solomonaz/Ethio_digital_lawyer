/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string
    // Note: the Telegram bot username is NOT a frontend env var — it is served at
    // runtime by the backend (GET /auth/telegram/config), so no VITE_ var is needed.
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
