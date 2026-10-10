import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { CircleCheck, CircleX, PartyPopper } from 'lucide-react';
import { isMobile } from '@hms/shared';
import { addSignupStrings } from '@hms/i18n/signup';
import {
  Banner,
  Button,
  Checkbox,
  CodeInput,
  FormField,
  Input,
  Spinner,
  Stepper,
  formatLongDate,
} from '@hms/ui';
import { apiError } from '../../../app/apiError.js';
import { hospitalHost } from '../../../app/host.js';
import { ApiErrorNotice } from '../../../components/ApiErrorNotice.jsx';
import { useDebounced } from '../../../lib/useDebounced.js';
import { useStrings } from '../../../lib/useStrings.js';
import { PublicLayout } from '../components/PublicLayout.jsx';
import { RESEND_AFTER_SEC, SUBDOMAIN, TERMS_VERSION, suggestSubdomain } from '../signup.js';
import {
  useSignupMutation,
  useSignupOtpMutation,
  useSubdomainQuery,
  useVerifySignupOtpMutation,
} from '../api.js';

function useCountdown(seconds) {
  const [left, setLeft] = useState(0);
  const [round, setRound] = useState(0);
  useEffect(() => {
    if (!round) return undefined;
    const started = Date.now();
    const id = setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((Date.now() - started) / 1000));
      setLeft(remaining);
      if (!remaining) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [round, seconds]);
  return [
    left,
    () => {
      setLeft(seconds);
      setRound((r) => r + 1);
    },
  ];
}

/** Step 1: hospital name, city, beds and its web address, checked as it is typed. */
function HospitalStep({ value, onNext }) {
  const { t } = useTranslation();
  const [v, setV] = useState(value);
  const [edited, setEdited] = useState(Boolean(value.subdomain));
  const [errors, setErrors] = useState({});
  const subdomain = edited ? v.subdomain : suggestSubdomain(v.name);
  const name = useDebounced(subdomain, 400);
  const wellFormed = SUBDOMAIN.test(name);
  const { data: check, isFetching } = useSubdomainQuery(name, { skip: !wellFormed });
  const settled = name === subdomain && !isFetching;
  const available = settled && wellFormed && check?.available === true;

  const next = (e) => {
    e.preventDefault();
    const errs = {};
    if (v.name.trim().length < 3) errs.name = t('signup.hospital.nameError');
    if (v.city.trim().length < 2) errs.city = t('signup.hospital.cityError');
    const beds = Number(v.beds || 0);
    if (!Number.isInteger(beds) || beds < 0 || beds > 5000)
      errs.beds = t('signup.hospital.bedsError');
    if (!SUBDOMAIN.test(subdomain)) errs.subdomain = t('signup.hospital.addressRule');
    else if (!available) errs.subdomain = check?.reason ?? t('signup.hospital.addressWait');
    setErrors(errs);
    if (!Object.keys(errs).length) onNext({ ...v, subdomain, beds });
  };

  let status = null;
  if (subdomain && !SUBDOMAIN.test(subdomain))
    status = { ok: false, text: t('signup.hospital.addressRule') };
  else if (subdomain && (!settled || isFetching))
    status = { busy: true, text: t('signup.hospital.checking') };
  else if (settled && check)
    status = check.available
      ? { ok: true, text: t('signup.hospital.available') }
      : { ok: false, text: check.reason };

  return (
    <form onSubmit={next} noValidate className="flex flex-col gap-4">
      <FormField label={t('signup.hospital.name')} error={errors.name} required>
        <Input
          autoComplete="organization"
          autoFocus
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
        />
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t('signup.hospital.city')} error={errors.city} required>
          <Input
            autoComplete="address-level2"
            value={v.city}
            onChange={(e) => setV({ ...v, city: e.target.value })}
          />
        </FormField>
        <FormField
          label={t('signup.hospital.beds')}
          hint={t('signup.hospital.bedsHint')}
          error={errors.beds}
          optional
        >
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            max={5000}
            value={v.beds}
            onChange={(e) => setV({ ...v, beds: e.target.value })}
          />
        </FormField>
      </div>
      <FormField
        label={t('signup.hospital.address')}
        hint={t('signup.hospital.addressHint', { host: hospitalHost(subdomain) })}
        error={errors.subdomain}
        required
      >
        <Input
          mono
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="off"
          value={subdomain}
          onChange={(e) => {
            setEdited(true);
            setV({
              ...v,
              subdomain: e.target.value
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '')
                .slice(0, 32),
            });
          }}
        />
      </FormField>
      <p aria-live="polite" className="-mt-2 flex min-h-6 items-center gap-1.5 text-sm">
        {status?.busy && <Spinner />}
        {status &&
          !status.busy &&
          (status.ok ? (
            <CircleCheck size={16} aria-hidden="true" className="text-success" />
          ) : (
            <CircleX size={16} aria-hidden="true" className="text-critical" />
          ))}
        {status && (
          <span
            className={status.busy ? 'text-muted' : status.ok ? 'text-success' : 'text-critical'}
          >
            {status.text}
          </span>
        )}
      </p>
      <Button type="submit" size="lg">
        {t('common.continue')}
      </Button>
    </form>
  );
}

/** Step 2: verify the mobile with a 6-digit SMS code; returns the otpToken for signup. */
function MobileStep({ value, onNext, onBack }) {
  const { t } = useTranslation();
  const [mobile, setMobile] = useState(value.mobile ?? '');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [error, setError] = useState(null);
  const [failure, setFailure] = useState(null);
  const [left, restart] = useCountdown(RESEND_AFTER_SEC);
  const [sendOtp, { isLoading: sending }] = useSignupOtpMutation();
  const [verifyOtp, { isLoading: verifying }] = useVerifySignupOtpMutation();

  const send = async (e) => {
    e?.preventDefault();
    setFailure(null);
    if (!isMobile(mobile)) {
      setError(t('signup.mobile.mobileError'));
      return;
    }
    setError(null);
    try {
      await sendOtp({ mobile }).unwrap();
      setSentTo(mobile);
      setCode('');
      restart();
    } catch (err) {
      setFailure(err);
    }
  };

  const verify = async (c = code) => {
    setFailure(null);
    if (!/^\d{6}$/.test(c)) {
      setError(t('signup.mobile.codeError'));
      return;
    }
    setError(null);
    try {
      const res = await verifyOtp({ mobile: sentTo, code: c }).unwrap();
      onNext({ mobile: sentTo, otpToken: res.otpToken });
    } catch (err) {
      const e = apiError(err);
      if (e?.status === 401) setError(t('signup.mobile.wrongCode'));
      else setFailure(err);
    }
  };

  if (!sentTo)
    return (
      <form onSubmit={send} noValidate className="flex flex-col gap-4">
        <p className="text-base text-muted">{t('signup.mobile.why')}</p>
        <ApiErrorNotice error={failure} />
        <FormField
          label={t('signup.mobile.mobile')}
          hint={t('signup.mobile.mobileHint')}
          error={error}
          required
        >
          <Input
            type="tel"
            inputMode="numeric"
            mono
            autoComplete="tel-national"
            autoFocus
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
        </FormField>
        <div className="flex flex-wrap justify-between gap-2">
          <Button variant="secondary" onClick={onBack}>
            {t('common.back')}
          </Button>
          <Button type="submit" loading={sending}>
            {t('signup.mobile.send')}
          </Button>
        </div>
      </form>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        verify();
      }}
      noValidate
      className="flex flex-col gap-4"
    >
      <p className="text-base text-ink">
        {t('signup.mobile.sent', { mobile: `******${sentTo.slice(-4)}` })}
      </p>
      <ApiErrorNotice error={failure} />
      <FormField label={t('signup.mobile.code')} error={error} required>
        <CodeInput
          value={code}
          onChange={setCode}
          onComplete={verify}
          autoFocus
          disabled={verifying}
          label={t('signup.mobile.code')}
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Button size="sm" variant="ghost" disabled={left > 0 || sending} onClick={() => send()}>
          {left > 0 ? t('signup.mobile.resendIn', { count: left }) : t('signup.mobile.resend')}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setSentTo(null)}>
          {t('signup.mobile.change')}
        </Button>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          {t('common.back')}
        </Button>
        <Button type="submit" loading={verifying}>
          {t('signup.mobile.verify')}
        </Button>
      </div>
    </form>
  );
}

/** Step 3: who the first Super Admin is, the terms, and the signup itself. */
function ContactStep({ data, onDone, onBack, onTokenExpired }) {
  const { t } = useTranslation();
  const [name, setName] = useState(data.contactName ?? '');
  const [email, setEmail] = useState(data.email ?? '');
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState(null);
  const [signup, { isLoading }] = useSignupMutation();

  const submit = async (e) => {
    e.preventDefault();
    setFailure(null);
    const errs = {};
    if (name.trim().length < 2) errs.name = t('signup.contact.nameError');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      errs.email = t('signup.contact.emailError');
    if (!terms) errs.terms = t('signup.contact.termsError');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    try {
      const res = await signup({
        contact: {
          name: name.trim(),
          email: email.trim(),
          mobile: data.mobile,
          otpToken: data.otpToken,
        },
        hospital: { name: data.name.trim(), city: data.city.trim(), beds: data.beds ?? 0 },
        subdomain: data.subdomain,
        plan: data.plan,
        acceptTermsVersion: TERMS_VERSION,
      }).unwrap();
      onDone(res);
    } catch (err) {
      const e2 = apiError(err);
      if (e2?.code === 'TOKEN_INVALID') onTokenExpired();
      else setFailure(err);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <ApiErrorNotice error={failure} />
      <FormField
        label={t('signup.contact.name')}
        hint={t('signup.contact.nameHint')}
        error={errors.name}
        required
      >
        <Input
          autoComplete="name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      <FormField label={t('signup.contact.email')} error={errors.email} required>
        <Input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </FormField>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 rounded-control border border-line bg-surface-2 px-3 py-2 text-sm">
        <dt className="text-muted">{t('signup.hospital.name')}</dt>
        <dd className="text-ink">{data.name}</dd>
        <dt className="text-muted">{t('signup.hospital.address')}</dt>
        <dd className="font-mono text-ink">{hospitalHost(data.subdomain)}</dd>
        <dt className="text-muted">{t('signup.mobile.mobile')}</dt>
        <dd className="font-mono text-ink">{data.mobile}</dd>
      </dl>
      <div>
        <Checkbox
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
          label={t('signup.contact.terms')}
          description={t('signup.contact.termsHint', { version: TERMS_VERSION })}
          aria-invalid={errors.terms ? true : undefined}
        />
        {errors.terms && (
          <p role="alert" className="text-sm text-critical">
            {errors.terms}
          </p>
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <Button variant="secondary" onClick={onBack}>
          {t('common.back')}
        </Button>
        <Button type="submit" size="lg" loading={isLoading}>
          {t('signup.contact.submit')}
        </Button>
      </div>
    </form>
  );
}

/**
 * Trial signup (design board "Signup", spec 3.3): hospital and web address (checked live),
 * mobile verified by SMS code, the first Super Admin and the terms. The API answers with a
 * one-time link (/welcome?token=…) on the new hospital's address to set the first password.
 */
export default function SignupPage() {
  useStrings(addSignupStrings);
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'hi' ? 'hi-IN' : 'en-IN';
  const [params] = useSearchParams();
  const plan = ['CLINIC', 'HOSPITAL', 'ENTERPRISE'].includes(params.get('plan'))
    ? params.get('plan')
    : 'HOSPITAL';
  const [step, setStep] = useState(0);
  const [data, setData] = useState({ name: '', city: '', beds: '', subdomain: '', plan });
  const [done, setDone] = useState(null);
  const [expired, setExpired] = useState(false);
  const steps = [t('signup.steps.hospital'), t('signup.steps.mobile'), t('signup.steps.contact')];
  useEffect(() => {
    document.title = `${t('signup.title')} · ${t('app.shortName')}`;
  }, [t]);

  return (
    <PublicLayout>
      <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-ink">{t('signup.title')}</h1>
          <p className="text-base text-muted">{t('signup.lead')}</p>
        </header>
        {done ? (
          <section
            aria-labelledby="signup-done"
            className="flex flex-col gap-4 rounded-dialog border border-line bg-surface px-6 py-7 shadow-card"
          >
            <h2 id="signup-done" className="flex items-center gap-2 text-xl font-semibold text-ink">
              <PartyPopper size={22} aria-hidden="true" className="text-success" />
              {t('signup.done.title')}
            </h2>
            <p className="text-base text-ink">
              {t('signup.done.body', {
                host: hospitalHost(data.subdomain),
                date: done.trialEndsAt ? formatLongDate(done.trialEndsAt, locale) : '',
              })}
            </p>
            <Banner tone="info">{t('signup.done.link')}</Banner>
            <a
              href={done.loginUrl}
              className="inline-flex min-h-tap items-center justify-center rounded-control bg-primary px-5 font-semibold text-on-primary hover:bg-primary-hover"
            >
              {t('signup.done.open')}
            </a>
          </section>
        ) : (
          <section
            aria-label={steps[step]}
            className="flex flex-col gap-5 rounded-dialog border border-line bg-surface px-6 py-6 shadow-card"
          >
            <Stepper steps={steps} current={step} />
            <h2 className="text-lg font-semibold text-ink">{steps[step]}</h2>
            {expired && step === 1 && <Banner tone="warning">{t('signup.mobile.expired')}</Banner>}
            {step === 0 && (
              <HospitalStep
                value={data}
                onNext={(v) => {
                  setData((d) => ({ ...d, ...v }));
                  setStep(1);
                }}
              />
            )}
            {step === 1 && (
              <MobileStep
                value={data}
                onBack={() => setStep(0)}
                onNext={(v) => {
                  setData((d) => ({ ...d, ...v }));
                  setExpired(false);
                  setStep(2);
                }}
              />
            )}
            {step === 2 && (
              <ContactStep
                data={data}
                onBack={() => setStep(1)}
                onDone={setDone}
                onTokenExpired={() => {
                  setExpired(true);
                  setStep(1);
                }}
              />
            )}
          </section>
        )}
        <p className="text-center text-sm text-muted">
          <Link to="/pricing" className="underline underline-offset-2">
            {t('signup.seePricing')}
          </Link>
        </p>
      </div>
    </PublicLayout>
  );
}
