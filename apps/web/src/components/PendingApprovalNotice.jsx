import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { ApprovalBanner } from '@hms/ui';

/**
 * 202: the change was saved as a request and waits for a checker. Says who it waits for and
 * links to the request under Approvals → Raised by me.
 */
export function PendingApprovalNotice({ approvalId, approver, children, className }) {
  const { t } = useTranslation();
  return (
    <ApprovalBanner
      status="pending"
      title={t('approvalNotice.title')}
      className={className}
      action={
        approvalId && (
          <Link
            to={`/approvals?box=mine&id=${approvalId}`}
            className="inline-flex min-h-8 items-center gap-1 text-sm font-semibold underline underline-offset-2"
          >
            {t('approvalNotice.view')}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )
      }
    >
      {children ??
        t('approvalNotice.body', { approver: approver ?? t('approvalNotice.superAdmin') })}
    </ApprovalBanner>
  );
}
