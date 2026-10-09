import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { initReactI18next } from 'react-i18next';
import { createI18n } from '@hms/i18n';
import { createStore } from './app/store.js';
import { createAppRouter } from './app/router.jsx';
import { Providers } from './app/providers.jsx';
import { storedLanguage } from './app/prefs-context.js';
import './styles/app.css';

const i18n = createI18n(storedLanguage(), { plugins: [initReactI18next] });
const store = createStore();
const router = createAppRouter();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Providers store={store} i18n={i18n}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
