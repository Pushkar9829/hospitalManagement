import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Clock, Inbox } from 'lucide-react';
import {
  Button,
  Card,
  ConfirmDialog,
  DiffTable,
  EmptyState,
  ErrorState,
  FormField,
  Loading,
  StatusBadge,
  Textarea,
  formatDateTime,
  useToast,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { selectSession } from '../../../app/session.js';
import { timeLeft } from '../../../lib/dates.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { Status } from '../../../components/Status.jsx';
import {
  useApprovalQuery,
  useDecideApprovalMutation,
  useWithdrawApprovalMutation,
} from '../api.js';
import { ApprovalPath } from './ApprovalPath.jsx';

/** Re-renders every `ms` so countdowns stay current. */
function useNow(ms = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

export function ExpiryBadge({ expiresAt, status }) {
  const { t } = useTranslation();
  const now = useNow();
  if (status !== 'PENDING') return <Status kind="approval" code={status} />;
  const left = timeLeft(expiresAt, now);
  if (!left) return <Status kind="approval" code="EXPIRED" />;
  return (
    <StatusBadge
      tone={left.unit === 'min' || (left.unit === 'h' && left.value < 6) ? 'critical' : 'warning'}
      label={t(`approvals.expiresIn.${left.unit}`, { count: left.value })}
    />
  );
}

/**
 * One request: who raised it, the approval path, what changes (before/after), the maker's
 * reason, and the actions this user may take: approve, reject with a comment, or withdraw
 * their own request.
 */
export function ApprovalDetail({ id, box, onDecided }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const me = useSelector(selectSession).data?.user.id;
  const { data: r, isLoading, isError, error, refetch } = useApprovalQuery(id, { skip: !id });
  const [decide, { isLoading: deciding }] = useDecideApprovalMutation();
  const [withdraw] = useWithdrawApprovalMutation();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState(null);
  const [failure, setFailure] = useState(null);
  const [pending, setPending] = useState(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';

  if (!id)
    return (
      <EmptyState
        icon={Inbox}
        title={t('approvals.selectTitle')}
        description={t('approvals.selectBody')}
        className="bg-surface"
      />
    );
  if (isLoading) return <Loading rows={5} />;
  if (isError) {
    const e = apiError(error);
    return e?.status === 404 ? (
      <EmptyState icon={Inbox} title={t('approvals.notFound')} className="bg-surface" />
    ) : (
      <ErrorState title={t('approvals.loadFailed')} requestId={e?.requestId} onRetry={refetch} />
    );
  }

  const isMaker = r.makerId === me;
  const open = r.status === 'PENDING' && timeLeft(r.expiresAt) !== null;
  const canDecide = open && box === 'inbox' && !isMaker;

  const send = async (decision) => {
    if (decision === 'REJECT' && comment.trim().length < 3) {
      setCommentError(t('approvals.commentRequired'));
      document.getElementById('approval-comment')?.focus();
      return;
    }
    setCommentError(null);
    setFailure(null);
    setPending(decision);
    try {
      await decide({
        id: r.id,
        decision,
        comment: comment.trim() || undefined,
        version: r.version,
      }).unwrap();
      toast({
        title: t(decision === 'APPROVE' ? 'approvals.approvedToast' : 'approvals.rejectedToast', {
          title: r.title,
        }),
        tone: 'success',
      });
      onDecided?.(r.id);
    } catch (err) {
      const e = apiError(err);
      if (e?.code === 'VALIDATION_FAILED' && e.details.some((d) => d.path === 'comment'))
        setCommentError(e.details.find((d) => d.path === 'comment').message);
      else setFailure(e);
      if (e?.code === 'APPROVAL_CLOSED') refetch();
    } finally {
      setPending(null);
    }
  };

  const confirmWithdraw = async () => {
    setFailure(null);
    try {
      await withdraw({ id: r.id, version: r.version }).unwrap();
      toast({ title: t('approvals.withdrawn', { title: r.title }), tone: 'success' });
    } catch (err) {
      setFailure(apiError(err));
    }
  };

  return (
    <Card padding={false} aria-labelledby="approval-title">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 id="approval-title" className="text-md font-semibold text-ink">
            {r.title}
          </h2>
          <p className="text-sm text-muted">
            {t('approvals.raisedBy', {
              name: r.makerName,
              time: formatDateTime(r.createdAt, locale),
            })}
          </p>
        </div>
        <ExpiryBadge expiresAt={r.expiresAt} status={r.status} />
      </div>
      <div className="flex flex-col gap-5 px-4 py-4">
        <ApiErrorNotice
          error={failure}
          onReload={async () => {
            setFailure(null);
            await refetch();
          }}
        />
        <section aria-labelledby="ap-path" className="flex flex-col gap-2">
          <h3 id="ap-path" className="text-sm font-semibold text-ink">
            {t('approvals.path')}
          </h3>
          <ApprovalPath request={r} />
        </section>
        <section aria-labelledby="ap-changes" className="flex flex-col gap-2">
          <h3 id="ap-changes" className="text-sm font-semibold text-ink">
            {t('approvals.changes')}
          </h3>
          <DiffTable
            before={r.before}
            after={r.after}
            beforeLabel={t('approvals.current')}
            afterLabel={t('approvals.proposed')}
            caption={t('approvals.changes')}
          />
        </section>
        <section aria-labelledby="ap-reason" className="flex flex-col gap-2">
          <h3 id="ap-reason" className="text-sm font-semibold text-ink">
            {t('approvals.reason')}
          </h3>
          <p className="rounded-control border border-line bg-surface-2 px-3 py-2 text-base text-ink">
            {r.reason || t('approvals.noReason')}
          </p>
        </section>
        {r.status === 'PENDING' && (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Clock size={14} aria-hidden="true" />
            {t('approvals.expiresAt', { time: formatDateTime(r.expiresAt, locale) })}
          </p>
        )}
        {canDecide && (
          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <FormField
              id="approval-comment"
              label={t('approvals.comment')}
              hint={t('approvals.commentHint')}
              error={commentError}
            >
              <Textarea
                rows={3}
                value={comment}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (commentError && e.target.value.trim().length >= 3) setCommentError(null);
                }}
              />
            </FormField>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={() => send('APPROVE')}
                loading={pending === 'APPROVE'}
                disabled={deciding}
              >
                {t('approvals.approve')}
              </Button>
              <Button
                variant="secondary"
                className="border-critical/40 text-critical"
                onClick={() => send('REJECT')}
                loading={pending === 'REJECT'}
                disabled={deciding}
              >
                {t('approvals.reject')}
              </Button>
              <span className="text-sm text-muted">{t('approvals.ownHint')}</span>
            </div>
          </div>
        )}
        {open && isMaker && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button variant="secondary" onClick={() => setWithdrawing(true)}>
              {t('approvals.withdraw')}
            </Button>
            <span className="text-sm text-muted">{t('approvals.makerHint')}</span>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={withdrawing}
        onOpenChange={setWithdrawing}
        title={t('approvals.withdrawTitle', { title: r.title })}
        description={t('approvals.withdrawBody')}
        confirmLabel={t('approvals.withdraw')}
        requireReason={null}
        onConfirm={confirmWithdraw}
      />
    </Card>
  );
}
