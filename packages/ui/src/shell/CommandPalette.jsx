import { Command } from 'cmdk';
import { CornerDownLeft, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Kbd } from '../primitives/Kbd.jsx';

const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase';

/**
 * Ctrl+K / Cmd+K: jump to any screen the user can open, or run an action. Fuzzy search (cmdk),
 * arrow keys, Enter, Esc.
 *
 * `groups`: [{ heading, items: [{ id, label, hint?, keywords?, shortcut?, icon?, onSelect }] }]
 */
export function CommandPalette({ open, onOpenChange, groups = [] }) {
  const { t } = useTranslation();
  const run = (item) => {
    onOpenChange(false);
    item.onSelect?.();
  };
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 animate-fade-in bg-overlay" />
        <RadixDialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 w-[min(640px,calc(100vw-32px))] -translate-x-1/2 animate-pop-in overflow-hidden rounded-dialog border border-line bg-surface text-ink shadow-pop"
        >
          <RadixDialog.Title className="sr-only">{t('palette.title')}</RadixDialog.Title>
          <Command label={t('palette.title')} loop className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Search size={18} aria-hidden="true" className="shrink-0 text-muted" />
              <Command.Input
                autoFocus
                placeholder={t('palette.placeholder')}
                className="min-h-12 w-full bg-transparent text-md text-ink outline-none placeholder:text-muted"
              />
              <Kbd>Esc</Kbd>
            </div>
            <Command.List className="max-h-[min(420px,60vh)] overflow-y-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-base text-muted">
                {t('palette.empty')}
              </Command.Empty>
              {groups
                .filter((g) => g.items.length)
                .map((g) => (
                  <Command.Group key={g.heading} heading={g.heading} className={groupClass}>
                    {g.items.map((item) => (
                      <Command.Item
                        key={item.id}
                        value={item.id}
                        keywords={[item.label, item.hint, ...(item.keywords ?? [])].filter(Boolean)}
                        onSelect={() => run(item)}
                        className="group flex min-h-10 cursor-pointer items-center gap-3 rounded-control px-3 text-base text-ink data-[selected=true]:bg-info-bg"
                      >
                        {item.icon && (
                          <span aria-hidden="true" className="inline-flex text-muted">
                            {item.icon}
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate">
                          {item.label}
                          {item.hint && (
                            <span className="ml-2 text-sm text-muted">{item.hint}</span>
                          )}
                        </span>
                        {item.shortcut && <Kbd keys={item.shortcut} />}
                        <CornerDownLeft
                          size={14}
                          aria-hidden="true"
                          className="hidden text-muted group-data-[selected=true]:block"
                        />
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
            </Command.List>
            <p className="border-t border-line bg-surface-2 px-4 py-2 text-sm text-muted">
              {t('palette.hint')}
            </p>
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
