import { useTranslation } from 'react-i18next';
import { Banner } from './Banner.jsx';

const toneFor = { needs: 'warning', pending: 'warning', approved: 'success', rejected: 'critical' };

/**
 * Maker-checker notice: "Needs approval. Discount above 10% goes to Billing Manager".
 * `status`: needs | pending | approved | rejected.
 */
export function ApprovalBanner({ status = 'needs', title, action, className, children }) {
  const { t } = useTranslation();
  return (
    <Banner
      tone={toneFor[status] ?? 'warning'}
      title={title ?? t(`approval.${status}`)}
      action={action}
      role="status"
      className={className}
    >
      {children}
    </Banner>
  );
}
