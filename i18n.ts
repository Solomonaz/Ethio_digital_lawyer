import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
    .use(Backend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        fallbackLng: 'en',
        debug: true, // Set to false in production

        interpolation: {
            escapeValue: false, // React already safes from xss
        },

        backend: {
            loadPath: '/locales/{{lng}}/{{ns}}.json',
        }
    });

// Keep <html lang> in sync with the active language so screen readers announce
// Amharic vs English content with the correct pronunciation.
const applyHtmlLang = (lng: string) => {
    if (typeof document !== 'undefined') {
        document.documentElement.lang = (lng || 'en').split('-')[0];
    }
};
i18n.on('languageChanged', applyHtmlLang);
applyHtmlLang(i18n.language);

export default i18n;
