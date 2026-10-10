import { useCallback } from 'react';
import { useCompleteUploadMutation, useCreateUploadMutation } from './api.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const BY_EXT = {
  csv: 'text/csv',
  xlsx: XLSX,
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/** Upload purposes: accepted types (by extension) and maximum size, as the API enforces them. */
export const PURPOSES = {
  'master-import': { ext: ['xlsx', 'csv'], maxMb: 5 },
  'hospital-logo': { ext: ['png', 'jpg', 'jpeg', 'webp'], maxMb: 2 },
  letterhead: { ext: ['png', 'jpg', 'jpeg', 'webp', 'pdf'], maxMb: 5 },
};

const extOf = (name) => String(name).split('.').pop()?.toLowerCase() ?? '';

/**
 * The type the API expects. Browsers disagree about CSV (Windows says application/vnd.ms-excel),
 * so known extensions decide.
 */
export function mimeOf(file) {
  return BY_EXT[extOf(file.name)] ?? file.type ?? 'application/octet-stream';
}

/** Checks type and size before uploading. Returns { key, values } for a message, or null. */
export function checkFile(file, purpose) {
  const rule = PURPOSES[purpose];
  if (!rule) return null;
  if (!rule.ext.includes(extOf(file.name)))
    return { key: 'upload.wrongType', values: { types: rule.ext.join(', ') } };
  if (file.size > rule.maxMb * 1024 * 1024)
    return { key: 'upload.tooBig', values: { mb: rule.maxMb } };
  if (!file.size) return { key: 'upload.empty', values: {} };
  return null;
}

/**
 * `const upload = useUpload(); const fileId = await upload(file, 'master-import')`.
 * Step 1 asks for an upload URL, step 2 PUTs the bytes there, step 3 confirms. Errors are thrown
 * in the RTK Query error shape so the caller can show them like any other API error.
 */
export function useUpload() {
  const [createUpload] = useCreateUploadMutation();
  const [completeUpload] = useCompleteUploadMutation();
  return useCallback(
    async (file, purpose) => {
      const mime = mimeOf(file);
      const res = await createUpload({ purpose, name: file.name, mime, size: file.size }).unwrap();
      const url = new URL(res.upload.url, globalThis.location?.origin ?? 'http://localhost').href;
      let put;
      try {
        put = await fetch(url, {
          method: res.upload.method ?? 'PUT',
          headers: res.upload.headers ?? { 'Content-Type': mime },
          body: file,
        });
      } catch {
        throw { status: 'FETCH_ERROR' };
      }
      if (!put.ok) {
        const data = await put.json().catch(() => null);
        throw { status: put.status, data };
      }
      await completeUpload(res.fileId).unwrap();
      return res.fileId;
    },
    [createUpload, completeUpload],
  );
}
