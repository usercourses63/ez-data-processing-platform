import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import heTranslations from './locales/he.json';
import enTranslations from './locales/en.json';

const resources = {
  he: {
    translation: heTranslations
  },
  en: {
    translation: enTranslations
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    // English is the most-complete locale and the safe fallback for any missing key.
    // Hebrew remains the default for users whose browser/locale signals Hebrew (see detection.order).
    fallbackLng: 'en',
    // No hardcoded `lng` — that would disable LanguageDetector. The detector picks based on
    // (1) ?lng= query param (shareable links), (2) prior choice in localStorage, (3) browser
    // navigator.language, (4) <html lang="..."> attribute. First hit wins.
    debug: import.meta.env.DEV,

    detection: {
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      lookupQuerystring: 'lng',
      caches: ['localStorage'],
    },

    interpolation: {
      escapeValue: false,
    },

    react: {
      useSuspense: false,
    }
  });

export default i18n;
