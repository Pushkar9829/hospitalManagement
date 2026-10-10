import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import { marketingOrigin } from '../../app/host.js';

/** This address is not a hospital on the platform (404 TENANT_NOT_FOUND from the API). */
export function UnknownHospital() {
  const { t } = useTranslation();
  return (
    <main
      id="main"
      className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <Building2 aria-hidden="true" size={36} strokeWidth={1.5} className="text-muted" />
      <h1 className="text-xl font-semibold text-ink">{t('tenant.unknownTitle')}</h1>
      <p className="text-base text-muted">
        {t('tenant.unknownBody', { host: globalThis.location?.host ?? '' })}
      </p>
      <a
        href={`${marketingOrigin()}/pricing`}
        className="mt-2 inline-flex min-h-tap items-center rounded-control border border-primary bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover"
      >
        {t('tenant.toSite')}
      </a>
    </main>
  );
}
