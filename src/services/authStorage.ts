const AUTH_TOKEN_KEY = 'eduguard_access_token';
const REFRESH_TOKEN_KEY = 'eduguard_refresh_token';
/** Cờ nhớ lựa chọn "Remember me" — luôn nằm ở localStorage (phải sống sót qua việc đóng trình
 *  duyệt để lần load sau còn biết nên đọc token từ localStorage hay sessionStorage). */
const REMEMBER_FLAG_KEY = 'eduguard_remember';

/** true = lần đăng nhập gần nhất có tích "Remember me" → token/profile đang nằm ở localStorage
 *  (sống qua cả lúc đóng trình duyệt); false = nằm ở sessionStorage (tự xoá khi đóng tab/trình duyệt,
 *  hành vi mặc định trước đây). */
function isRemembered(): boolean {
  return localStorage.getItem(REMEMBER_FLAG_KEY) === '1';
}

/** Nơi lưu token/profile hiện tại — dùng chung cho AuthContext (cache profile user) để cả 2 luôn
 *  đồng bộ cùng 1 nơi, không lệch giữa lúc "nhớ" và "không nhớ". */
export function getAuthStorage(): Storage {
  return isRemembered() ? localStorage : sessionStorage;
}

/** Lưu token sau login — remember=true dùng localStorage (giữ đăng nhập qua cả lúc tắt trình
 *  duyệt), remember=false dùng sessionStorage như cũ (mất khi đóng tab/trình duyệt). Luôn dọn sạch
 *  storage còn lại để không có bản token cũ/lệch nằm sót ở nơi không dùng tới. */
export function saveAuthTokens(accessToken: string, refreshToken: string, remember: boolean): void {
  const active = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;

  active.setItem(AUTH_TOKEN_KEY, accessToken);
  active.setItem(REFRESH_TOKEN_KEY, refreshToken);
  other.removeItem(AUTH_TOKEN_KEY);
  other.removeItem(REFRESH_TOKEN_KEY);

  if (remember) localStorage.setItem(REMEMBER_FLAG_KEY, '1');
  else localStorage.removeItem(REMEMBER_FLAG_KEY);
}

/** Xóa token khi logout hoặc hết phiên — xoá ở cả 2 nơi để chắc chắn sạch dù đang ở chế độ nào. */
export function clearAuthTokens(): void {
  for (const storage of [localStorage, sessionStorage]) {
    storage.removeItem(AUTH_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
  }
  localStorage.removeItem(REMEMBER_FLAG_KEY);
}

export function getAccessToken(): string | null {
  return getAuthStorage().getItem(AUTH_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return getAuthStorage().getItem(REFRESH_TOKEN_KEY);
}
