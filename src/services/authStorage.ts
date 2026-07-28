const AUTH_TOKEN_KEY = 'eduguard_access_token';
const REFRESH_TOKEN_KEY = 'eduguard_refresh_token';

// Dùng sessionStorage (không phải localStorage) — tự động xoá khi đóng tab/trình duyệt,
// nhưng vẫn giữ nguyên khi F5 refresh trong cùng tab (không bắt đăng nhập lại mỗi lần reload).

/** Lưu token sau login */
export function saveAuthTokens(accessToken: string, refreshToken: string): void {
  sessionStorage.setItem(AUTH_TOKEN_KEY, accessToken);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

/** Xóa token khi logout hoặc hết phiên */
export function clearAuthTokens(): void {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return sessionStorage.getItem(REFRESH_TOKEN_KEY);
}
