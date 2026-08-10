import { apiPost } from './apiClient';

export interface ContactRequestPayload {
  schoolName: string;
  contactPersonName: string;
  email: string;
  phoneNumber: string;
  message?: string;
}

/** Landing page "Contact Us" — public endpoint, không cần token. */
export function requestDemo(payload: ContactRequestPayload): Promise<void> {
  return apiPost<void>('/api/Contact/request-demo', payload, { skipAuth: true, raw: true });
}
