import { APP_NAME, SITE_URL, SUPPORTED_LOCALES } from '../constants';

// ---------------------------------------------------------------------------
// Runtime SEO layer.
//
// The static <head> in index.html gives crawlers a correct baseline before any
// JS runs. This module refines it once the app is live: it localizes the title
// and description to the active language, keeps the canonical / Open Graph URLs
// pointed at the real origin, emits hreflang alternates for each language, and
// — importantly — marks the authenticated app shell `noindex` so search engines
// index the marketing landing page rather than an empty logged-in frame.
// ---------------------------------------------------------------------------

export type SeoView = 'landing' | 'app' | 'recovery';

export interface SeoInput {
    lang: string;          // active i18n language, e.g. 'en' | 'am'
    view: SeoView;         // which surface is showing
    title: string;         // already-localized document title
    description: string;   // already-localized meta description
    keywords?: string;     // already-localized keyword list
    image?: string;        // og/twitter image (absolute URL or root-relative path)
}

const OG_LOCALE: Record<string, string> = { en: 'en_US', am: 'am_ET' };

const origin = (): string => {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return window.location.origin.replace(/\/$/, '');
    }
    return SITE_URL.replace(/\/$/, '');
};

const currentPath = (): string => {
    if (typeof window !== 'undefined' && window.location) return window.location.pathname || '/';
    return '/';
};

const toAbsolute = (pathOrUrl: string): string => {
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return origin() + (pathOrUrl.startsWith('/') ? pathOrUrl : '/' + pathOrUrl);
};

// Upsert a <meta> tag keyed by name= or property=.
const setMeta = (attr: 'name' | 'property', key: string, content: string | undefined) => {
    if (typeof document === 'undefined') return;
    if (content == null || content === '') return;
    let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
};

const setLinkRel = (rel: string, href: string) => {
    if (typeof document === 'undefined') return;
    let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]:not([hreflang])`);
    if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
    }
    el.setAttribute('href', href);
};

// Rebuild the hreflang alternates so each language has a crawlable URL
// (?lng=xx — the language detector reads the querystring), plus x-default.
const setHreflangAlternates = (path: string) => {
    if (typeof document === 'undefined') return;
    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(n => n.remove());
    const base = origin() + path;
    const add = (hreflang: string, href: string) => {
        const link = document.createElement('link');
        link.setAttribute('rel', 'alternate');
        link.setAttribute('hreflang', hreflang);
        link.setAttribute('href', href);
        document.head.appendChild(link);
    };
    SUPPORTED_LOCALES.forEach(loc => add(loc, `${base}?lng=${loc}`));
    add('x-default', base);
};

export function updateDocumentSeo(input: SeoInput): void {
    if (typeof document === 'undefined') return;

    const path = currentPath();
    const canonical = origin() + path;
    const img = toAbsolute(input.image || '/logo.png');
    const indexable = input.view === 'landing';

    document.title = input.title;

    setMeta('name', 'description', input.description);
    if (input.keywords) setMeta('name', 'keywords', input.keywords);

    // Only the public landing page should be indexed; the authenticated app
    // shell and the password-recovery screen are private/empty to a crawler.
    setMeta('name', 'robots', indexable ? 'index, follow, max-image-preview:large' : 'noindex, follow');

    setLinkRel('canonical', canonical);

    // Open Graph
    setMeta('property', 'og:site_name', APP_NAME);
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:title', input.title);
    setMeta('property', 'og:description', input.description);
    setMeta('property', 'og:url', canonical);
    setMeta('property', 'og:image', img);
    setMeta('property', 'og:locale', OG_LOCALE[input.lang] || 'en_US');
    SUPPORTED_LOCALES.filter(l => l !== input.lang).forEach(l => {
        // og:locale:alternate can legitimately repeat; ensure at least one exists.
        setMeta('property', 'og:locale:alternate', OG_LOCALE[l] || l);
    });

    // Twitter
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', input.title);
    setMeta('name', 'twitter:description', input.description);
    setMeta('name', 'twitter:image', img);

    setHreflangAlternates(path);

    if (document.documentElement) {
        document.documentElement.setAttribute('lang', (input.lang || 'en').split('-')[0]);
    }
}
