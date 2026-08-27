/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string
    // Bot @username (without the @) for the Telegram Login Widget. When unset,
    // the "Sign in with Telegram" button is hidden.
    readonly VITE_TELEGRAM_BOT_USERNAME: string
    // more env variables...
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
