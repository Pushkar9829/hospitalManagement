import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn.js';
import { IconButton } from '../primitives/IconButton.jsx';

/** Server-side paging: "26–50 of 412" with previous and next. Pages are 1-based. */
export function Pagination({ page, limit, total, onPageChange, className }) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil((total ?? 0) / limit));
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(total ?? 0, page * limit);
  return (
    <nav
      aria-label={t('table.pagination')}
      className={cn('flex items-center justify-end gap-3 text-sm text-muted', className)}
    >
      <span className="tabular" aria-live="polite">
        {t('table.showing', { from, to, total: total ?? 0 })}
      </span>
      <span className="sr-only">{t('table.pageOf', { page, pages })}</span>
      <div className="flex gap-1">
        <IconButton
          size="sm"
          variant="secondary"
          label={t('table.previous')}
          icon={<ChevronLeft size={16} aria-hidden="true" />}
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
        />
        <IconButton
          size="sm"
          variant="secondary"
          label={t('table.next')}
          icon={<ChevronRight size={16} aria-hidden="true" />}
          disabled={page >= pages}
          onClick={() => onPageChange?.(page + 1)}
        />
      </div>
    </nav>
  );
}
