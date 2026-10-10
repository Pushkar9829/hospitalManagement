import { useTranslation } from 'react-i18next';
import { formatAbhaNumber } from '@hms/shared';
import { Card, formatDateTime, formatLongDate } from '@hms/ui';

function Rows({ rows }) {
  const { t } = useTranslation();
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-sm font-semibold text-muted">{k}</dt>
          <dd className="min-w-0 text-base break-words text-ink">
            {v === undefined || v === null || v === '' ? (
              <span className="text-muted">{t('patients.details.notRecorded')}</span>
            ) : (
              v
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

const contactText = (c) => (c ? [c.name, c.relation, c.mobile].filter(Boolean).join(' · ') : null);

/** Everything recorded at registration, read-only (Edit opens the form). */
export function DetailsTab({ patient: p }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const addr = p.address
    ? [
        p.address.line1,
        p.address.line2,
        p.address.city,
        p.address.district,
        p.address.state,
        p.address.pin,
      ]
        .filter(Boolean)
        .join(', ')
    : null;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title={t('patients.form.contact')} headingLevel={3}>
        <Rows
          rows={[
            [t('patients.form.mobile'), p.mobile && <span className="font-mono">{p.mobile}</span>],
            [
              t('patients.form.altMobile'),
              p.altMobile && <span className="font-mono">{p.altMobile}</span>,
            ],
            [t('patients.form.email'), p.email],
            [t('patients.form.language'), p.preferredLanguage],
            [t('patients.details.address'), addr],
          ]}
        />
      </Card>
      <Card title={t('patients.form.identity')} headingLevel={3}>
        <Rows
          rows={[
            [
              t('patients.details.regionalName'),
              p.name.regional && <span lang="hi">{p.name.regional}</span>,
            ],
            [
              t('patients.form.dob'),
              p.dob &&
                (p.dobEstimated
                  ? t('patients.details.dobEstimated', { date: formatLongDate(p.dob, locale) })
                  : formatLongDate(p.dob, locale)),
            ],
            [
              t('patients.form.relationType'),
              p.relation && `${t(`patients.relations.${p.relation.type}`)} ${p.relation.name}`,
            ],
            [
              t('patients.form.marital'),
              p.maritalStatus && t(`patients.marital.${p.maritalStatus}`),
            ],
            [t('patients.form.guardian'), contactText(p.guardian)],
            [t('patients.form.emergency'), contactText(p.emergencyContact)],
          ]}
        />
      </Card>
      <Card title={t('patients.form.clinical')} headingLevel={3}>
        <Rows
          rows={[
            [t('patients.form.bloodGroup'), p.bloodGroup],
            [
              t('patients.form.allergies'),
              p.allergies?.length ? (
                <ul className="flex flex-col gap-0.5">
                  {p.allergies.map((a) => (
                    <li key={a.substance}>
                      <strong className="font-semibold">{a.substance}</strong>
                      {a.reaction && ` · ${a.reaction}`} · {t(`patients.severity.${a.severity}`)}
                    </li>
                  ))}
                </ul>
              ) : p.noKnownAllergies ? (
                t('patient.noKnownAllergies')
              ) : null,
            ],
            [t('patients.form.conditions'), p.chronicConditions?.join(', ')],
          ]}
        />
      </Card>
      <Card title={t('patients.form.idsTitle')} headingLevel={3}>
        <Rows
          rows={[
            ...(p.ids ?? []).map((d, i) => [
              `${t(`patients.idTypes.${d.type}`)}${p.ids.length > 1 ? ` (${i + 1})` : ''}`,
              <span className="font-mono">{d.number}</span>,
            ]),
            ...(p.ids?.length ? [] : [[t('patients.form.idsTitle'), null]]),
            [
              t('patients.form.abhaNumber'),
              p.abha?.number && (
                <span className="font-mono">{formatAbhaNumber(p.abha.number)}</span>
              ),
            ],
            [
              t('patients.form.abhaAddress'),
              p.abha?.address && <span className="font-mono">{p.abha.address}</span>,
            ],
          ]}
        />
      </Card>
      <Card title={t('patients.details.registration')} headingLevel={3} className="lg:col-span-2">
        <Rows
          rows={[
            [t('patients.details.type'), t(`patients.types.${p.registrationType}`)],
            [t('patients.details.registeredAt'), formatDateTime(p.registeredAt, locale)],
            [t('patients.form.category'), t(`patients.categories.${p.category}`)],
            [t('patients.form.referredBy'), p.referral?.doctorName],
            [
              t('patients.details.toComplete'),
              p.toComplete?.length
                ? p.toComplete.map((f) => t(`patients.complete.${f}`)).join(', ')
                : t('patients.details.complete'),
            ],
          ]}
        />
      </Card>
    </div>
  );
}
