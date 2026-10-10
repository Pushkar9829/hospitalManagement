import { isMinor, isSeniorCitizen } from '@hms/shared';

/** Flags shown on the banner: VIP, medico-legal, senior citizen 60+, minor, details to complete. */
export function patientFlags(p, t) {
  const flags = [];
  if (p.flags?.mlc) flags.push({ label: t('patients.flags.mlc'), tone: 'warning' });
  if (p.flags?.vip) flags.push({ label: t('patients.flags.vip'), tone: 'info' });
  if (p.dob && isSeniorCitizen(p.dob))
    flags.push({ label: t('patients.flags.senior'), tone: 'info' });
  if (p.dob && isMinor(p.dob)) flags.push({ label: t('patients.flags.minor'), tone: 'info' });
  if (p.bloodGroup && p.bloodGroup !== 'Unknown')
    flags.push({ label: t('patients.flags.blood', { group: p.bloodGroup }), tone: 'neutral' });
  if (p.toComplete?.length)
    flags.push({
      label: t('patients.flags.toComplete', { count: p.toComplete.length }),
      tone: 'warning',
    });
  return flags;
}

/** Allergies for PatientBanner: names, [] for no known allergies, null when not recorded. */
export function bannerAllergies(p) {
  if (!p) return null;
  if (p.allergies?.length) return p.allergies.map((a) => a.substance);
  return p.noKnownAllergies ? [] : null;
}
