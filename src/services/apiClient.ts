/**
 * HTTP client — tự gắn Bearer token từ localStorage cho GET/POST/PUT/DELETE.
 */
import { clearAuthTokens, getAccessToken } from './authStorage';
import type { PaginatedApiResponse, PaginationMeta } from '../types/api';

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? '';

const DEFAULT_DELAY_MS = 400;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Envelope response chuẩn từ backend EduGuard */
export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data: T;
  errors?: unknown;
}

export class ApiError extends Error {
  status: number;
  errors?: unknown;

  constructor(message: string, status: number, errors?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

export interface ApiRequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: Record<string, string>;
  /** Không gắn Authorization — dùng cho login / API public */
  skipAuth?: boolean;
  /** Trả nguyên body JSON thay vì unwrap `data` */
  raw?: boolean;
}

function buildAuthHeaders(skipAuth: boolean): Record<string, string> {
  const headers: Record<string, string> = { accept: '*/*' };
  if (!skipAuth) {
    const token = getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  return headers;
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function extractErrorMessage(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    // Try common field names
    for (const key of ['message', 'error', 'title', 'detail', 'errorMessage', 'Error']) {
      if (typeof record[key] === 'string' && record[key]) return record[key] as string;
    }
    if (typeof record.errors === 'string') return record.errors;
    if (Array.isArray(record.errors) && record.errors.length > 0) {
      const first = record.errors[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object') {
        const fe = first as Record<string, unknown>;
        return String(fe.message ?? fe.description ?? fe.msg ?? JSON.stringify(first));
      }
    }
    // Last resort: show full body so we can debug
    const str = JSON.stringify(body);
    if (str && str !== '{}') return str;
  }
  if (status === 401) return 'Session expired. Please log in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status >= 500) return 'Server error. Please try again later.';
  return `Request failed (HTTP ${status}).`;
}

function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    'success' in value &&
    'data' in value
  );
}

/**
 * Request cơ bản — tự lấy accessToken từ localStorage và gắn header Authorization.
 */
export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {}, skipAuth = false, raw = false } = options;

  const requestHeaders: Record<string, string> = {
    ...buildAuthHeaders(skipAuth),
    ...headers,
  };

  const hasJsonBody = body !== undefined && !(body instanceof FormData);
  if (hasJsonBody) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  const parsed = await parseJsonSafe(res);

  if (!res.ok) {
    if (res.status === 401 && !skipAuth) {
      clearAuthTokens();
    }
    throw new ApiError(extractErrorMessage(parsed, res.status), res.status, (parsed as ApiEnvelope<unknown>)?.errors);
  }

  if (raw) return parsed as T;

  if (isApiEnvelope(parsed)) {
    if (!parsed.success) {
      throw new ApiError(extractErrorMessage(parsed, res.status), res.status, parsed.errors);
    }
    return parsed.data as T;
  }

  return parsed as T;
}

/** GET có Authorization */
export function apiGet<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
  return apiRequest<T>(path, { ...options, method: 'GET' });
}

/** POST có Authorization */
export function apiPost<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
  return apiRequest<T>(path, { ...options, method: 'POST', body });
}

/** PUT có Authorization */
export function apiPut<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
  return apiRequest<T>(path, { ...options, method: 'PUT', body });
}

/** PATCH có Authorization */
export function apiPatch<T>(path: string, body?: unknown, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
  return apiRequest<T>(path, { ...options, method: 'PATCH', body });
}

/** DELETE có Authorization */
export function apiDelete<T>(path: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
  return apiRequest<T>(path, { ...options, method: 'DELETE' });
}

/** Ghép query string cho GET */
export function buildQueryParams(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

/** GET có pagination — trả cả data và pagination */
export async function apiGetPaginated<T>(
  path: string,
  options?: Omit<ApiRequestOptions, 'method' | 'body' | 'raw'>,
): Promise<{ data: T; pagination: PaginationMeta }> {
  const parsed = await apiRequest<PaginatedApiResponse<T>>(path, {
    ...options,
    method: 'GET',
    raw: true,
  });

  if (!parsed || typeof parsed !== 'object' || !('success' in parsed)) {
    throw new ApiError('Invalid API response.', 500);
  }

  const envelope = parsed as PaginatedApiResponse<T>;
  if (!envelope.success) {
    throw new ApiError(extractErrorMessage(parsed, 400), 400, envelope.errors);
  }

  return {
    data: envelope.data,
    pagination: envelope.pagination,
  };
}

/** Mô phỏng độ trễ gọi API — dùng cho mock */
export async function simulateNetworkDelay(ms = DEFAULT_DELAY_MS): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wrapper trả về dữ liệu sau khi mô phỏng delay — dùng cho mock API */
export async function mockApiResponse<T>(data: T, delayMs = DEFAULT_DELAY_MS): Promise<T> {
  await simulateNetworkDelay(delayMs);
  return data;
}
