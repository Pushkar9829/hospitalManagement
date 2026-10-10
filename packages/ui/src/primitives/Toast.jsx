import { useCallback, useMemo, useState } from 'react';
import * as RadixToast from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';
import { ToastContext } from './toast-context.js';

const tones = {
  default: 'bg-primary text-on-primary',
  success: 'bg-primary text-on-primary',
  critical: 'bg-danger text-on-primary',
};

let seq = 0;

/** Wrap the app once. Toasts appear bottom-right, 5 s each; F8 moves focus to them. */
export function ToastProvider({ duration = 5000, children }) {
  const { t } = useTranslation();
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => setItems((list) => list.filter((x) => x.id !== id)), []);
  const toast = useCallback((opts) => {
    const item = typeof opts === 'string' ? { title: opts } : opts;
    const id = item.id ?? `t${++seq}`;
    setItems((list) => [...list.filter((x) => x.id !== id), { tone: 'default', ...item, id }]);
    return id;
  }, []);
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      <RadixToast.Provider
        duration={duration}
        swipeDirection="right"
        label={t('toast.region', { hotkey: 'F8' })}
      >
        {children}
        {items.map((item) => (
          <RadixToast.Root
            key={item.id}
            type={item.tone === 'critical' ? 'foreground' : 'background'}
            onOpenChange={(open) => !open && dismiss(item.id)}
            className={cn(
              'flex animate-pop-in items-start gap-3 rounded-control px-4 py-3 shadow-pop',
              tones[item.tone] ?? tones.default,
            )}
          >
            <div className="min-w-0 flex-1">
              <RadixToast.Title className="text-base font-medium">{item.title}</RadixToast.Title>
              {item.description && (
                <RadixToast.Description className="mt-0.5 text-sm opacity-90">
                  {item.description}
                </RadixToast.Description>
              )}
            </div>
            <RadixToast.Close
              aria-label={t('common.dismiss')}
              className="-mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-control opacity-80 hover:opacity-100"
            >
              <X size={16} aria-hidden="true" />
            </RadixToast.Close>
          </RadixToast.Root>
        ))}
        <RadixToast.Viewport className="fixed right-4 bottom-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2 outline-none" />
      </RadixToast.Provider>
    </ToastContext.Provider>
  );
}
