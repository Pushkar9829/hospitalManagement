import { PREVIEW_ENABLED } from '../app/previewData.js';

/**
 * A slim notice on screens that show preview data because their API is not built yet. Renders
 * nothing when preview data is off (tests, production).
 */
export function PreviewBanner({ module }) {
  if (!PREVIEW_ENABLED) return null;
  return (
    <p
      role="note"
      className="mb-3 rounded-md border border-warning bg-warning-bg px-3 py-1.5 text-xs text-warning"
    >
      Preview data{module ? ` · ${module}` : ''}: this screen shows sample content until its API is
      built. Changes are not saved.
    </p>
  );
}
