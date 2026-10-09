import { Provider as ReduxProvider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { HotkeysProvider, ToastProvider, TooltipProvider } from '@hms/ui';
import { PrefsProvider } from './PrefsProvider.jsx';

/** App-wide providers: store, i18n, theme and language, toasts, tooltips, hotkeys. */
export function Providers({ store, i18n, children }) {
  return (
    <ReduxProvider store={store}>
      <I18nextProvider i18n={i18n}>
        <PrefsProvider>
          <ToastProvider>
            <TooltipProvider delayDuration={300}>
              <HotkeysProvider>{children}</HotkeysProvider>
            </TooltipProvider>
          </ToastProvider>
        </PrefsProvider>
      </I18nextProvider>
    </ReduxProvider>
  );
}
