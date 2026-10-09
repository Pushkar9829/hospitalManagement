import { Banner } from '@hms/ui';

/** Form-level error under the heading. role="alert" so it is announced when it appears. */
export function FormAlert({ error }) {
  if (!error?.message && !error?.title) return null;
  return (
    <Banner tone="critical" role="alert" title={error.title}>
      {error.message}
      {error.detail && <span className="mt-1 block text-sm">{error.detail}</span>}
    </Banner>
  );
}
