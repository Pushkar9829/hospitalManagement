import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { Card, EmptyState, useToast } from '@hms/ui';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useCan } from '../../../lib/useCan.js';
import { FileField } from '../../files/FileField.jsx';
import { usePatientSave } from '../usePatientSave.js';

/**
 * The patient's photo and the scans of their identity documents (files module, private store,
 * 5-minute links, every view logged). Attaching a scan saves the record with its version.
 */
export function DocumentsTab({ patient: p, onReload }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const can = useCan();
  const canEdit = can('patients:patient:update') && p.status === 'ACTIVE';
  const [save] = usePatientSave(p);
  const [failure, setFailure] = useState(null);

  const apply = async (patch, message) => {
    setFailure(null);
    try {
      await save(patch);
      toast({ title: message, tone: 'success' });
    } catch (err) {
      setFailure(err);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t('patients.documents.hint')}</p>
      <ApiErrorNotice
        error={failure}
        onReload={async () => {
          setFailure(null);
          await onReload?.();
        }}
      />
      <Card title={t('patients.documents.photo')} headingLevel={3}>
        {p.photoFileId || canEdit ? (
          <FileField
            label={t('patients.form.photo')}
            purpose="patient-photo"
            value={p.photoFileId}
            disabled={!canEdit}
            onChange={(id) =>
              apply((v) => ({ ...v, photoFileId: id ?? '' }), t('patients.documents.saved'))
            }
          />
        ) : (
          <p className="text-base text-muted">{t('patients.documents.noPhoto')}</p>
        )}
      </Card>
      <Card title={t('patients.form.idsTitle')} headingLevel={3}>
        {p.ids?.length ? (
          <ul className="flex flex-col gap-4">
            {p.ids.map((d, i) => (
              <li
                key={`${d.type}-${i}`}
                className="flex flex-col gap-2 border-b border-line pb-4 last:border-b-0 last:pb-0"
              >
                <p className="text-base text-ink">
                  <strong className="font-semibold">{t(`patients.idTypes.${d.type}`)}</strong>{' '}
                  <span className="font-mono">{d.number}</span>
                </p>
                {d.fileId || canEdit ? (
                  <FileField
                    label={t('patients.form.idScan')}
                    purpose="patient-document"
                    value={d.fileId}
                    disabled={!canEdit}
                    onChange={(id) =>
                      apply(
                        (v) => ({
                          ...v,
                          ids: v.ids.map((x, j) => (j === i ? { ...x, fileId: id ?? '' } : x)),
                        }),
                        t('patients.documents.saved'),
                      )
                    }
                  />
                ) : (
                  <p className="text-sm text-muted">{t('patients.documents.noScan')}</p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={FileText}
            bordered={false}
            title={t('patients.documents.noIds')}
            description={canEdit ? t('patients.documents.noIdsHint') : undefined}
          />
        )}
      </Card>
    </div>
  );
}
