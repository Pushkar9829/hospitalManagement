import { useTranslation } from 'react-i18next';
import { Dialog } from '../primitives/Dialog.jsx';
import { Kbd } from '../primitives/Kbd.jsx';

/**
 * `?` opens this list. `shortcuts`: [{ keys: 'mod+k', description, group: 'global' | 'page' }].
 */
export function ShortcutsDialog({ open, onOpenChange, shortcuts = [] }) {
  const { t } = useTranslation();
  const groups = [
    { id: 'global', title: t('shortcuts.groupGlobal') },
    { id: 'page', title: t('shortcuts.groupPage') },
  ]
    .map((g) => ({ ...g, items: shortcuts.filter((s) => (s.group ?? 'page') === g.id) }))
    .filter((g) => g.items.length);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('shortcuts.title')}
      description={t('shortcuts.description')}
      size="md"
    >
      <div className="flex flex-col gap-5">
        {groups.map((g) => (
          <section key={g.id}>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
              {g.title}
            </h3>
            <dl className="divide-y divide-line rounded-card border border-line">
              {g.items.map((s) => (
                <div key={s.keys} className="flex items-center justify-between gap-4 px-3 py-2">
                  <dt className="text-base text-ink">{s.description}</dt>
                  <dd>
                    <Kbd keys={s.keys} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
