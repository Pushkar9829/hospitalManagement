import { Link } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Banner, PatientBanner } from '@hms/ui';
import { bannerAllergies, patientFlags } from '../flags.js';

/**
 * The patient banner for the profile (mandatory on patient-context screens): full name, age
 * label (47Y, 14M, 12D), sex, UHID, allergies and flags; a merged record says where it went.
 */
export function PatientHeader({ patient: p }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <PatientBanner
        name={p.name.full}
        age={p.age}
        sex={p.gender}
        uhid={p.uhid}
        allergies={bannerAllergies(p)}
        noKnownAllergies={p.noKnownAllergies}
        flags={patientFlags(p, t)}
      />
      {p.status === 'MERGED' && (
        <Banner tone="warning" title={t('patients.profile.mergedTitle')}>
          {t('patients.profile.mergedBody', { uhid: p.mergedIntoUhid ?? '' })}{' '}
          {p.mergedInto && (
            <Link
              to={`/patients/${p.mergedInto}`}
              className="font-semibold underline underline-offset-2"
            >
              {t('patients.profile.openSurvivor')}
            </Link>
          )}
        </Banner>
      )}
    </div>
  );
}
