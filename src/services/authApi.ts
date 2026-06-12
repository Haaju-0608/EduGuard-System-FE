import { API_BASE_URL } from './apiClient';
import type { LoginApiResponse, LoginData } from '../types/auth';

const AUTH_TOKEN_KEY = 'eduguard_access_token';
const REFRESH_TOKEN_KEY = 'eduguard_refresh_token';

/** Lưu token sau login */
export function saveAuthTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/** Xóa token khi logout */
export function clearAuthTokens(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/** Map role từ API sang role routing trong app */
export function mapApiRoleToAppRole(apiRole: string): 'user' | 'admin' | 'lecture' {
  const role = apiRole.trim().toLowerCase().replace(/\s+/g, '');

  // Map theo role chính xác từ backend
  if (role === 'superadmin' || role.includes('superadmin')) return 'admin';
  if (role === 'schooladmin' || role.includes('schooladmin')) return 'lecture';
  if (role === 'admin') return 'admin';
  if (['lecturer', 'lecture', 'instructor', 'teacher'].some((r) => role.includes(r))) {
    return 'lecture';
  }
  return 'user';
}

/** Lấy initials từ fullName */
export function getInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Decode `sub` từ JWT accessToken */
export function getUserIdFromToken(accessToken: string): string {
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1])) as { sub?: string };
    return payload.sub ?? accessToken.slice(0, 8);
  } catch {
    return accessToken.slice(0, 8);
  }
}

function parseErrorMessage(body: LoginApiResponse | null, status: number): string {
  if (body?.message && !body.success) return body.message;
  if (typeof body?.errors === 'string') return body.errors;
  if (Array.isArray(body?.errors) && body.errors.length > 0) {
    return String(body.errors[0]);
  }
  if (status === 401) return 'Email hoặc mật khẩu không đúng.';
  if (status >= 500) return 'Máy chủ đang gặp sự cố. Vui lòng thử lại sau.';
  return 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
}

/** Gọi API đăng nhập */
export async function loginApi(email: string, password: string): Promise<LoginData> {
  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      accept: '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  let body: LoginApiResponse | null = null;
  try {
    body = (await res.json()) as LoginApiResponse;
  } catch {
    throw new Error(parseErrorMessage(null, res.status));
  }

  if (!res.ok || !body.success || !body.data) {
    throw new Error(parseErrorMessage(body, res.status));
  }

  return body.data;
}
