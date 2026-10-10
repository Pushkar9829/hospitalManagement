import { usePatientQuery, usePatientTimelineQuery } from './api.js';

/** A patient id from the URL is a 24-hex ObjectId; anything else (a menu `:id`) is not looked up. */
export const isObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id ?? ''));

export function usePatient(id) {
  return usePatientQuery(id, { skip: !isObjectId(id) });
}

export function usePatientTimeline(id) {
  return usePatientTimelineQuery(id, { skip: !isObjectId(id) });
}
