import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en/translation.json';
import jaTranslation from './locales/ja/translation.json';

// 利用可能な言語
export const resources = {
  en: {
    translation: enTranslation
  },
  ja: {
    translation: jaTranslation
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // デフォルト言語
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // Reactは既にXSS対策をしているため
    }
  });

export default i18n;
