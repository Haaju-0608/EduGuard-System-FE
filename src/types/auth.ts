/** Payload gửi lên API đăng nhập */
export interface LoginRequest {
  email: string;
  password: string;
}

/** Dữ liệu user trả về sau khi login thành công */
export interface LoginData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  fullName: string;
  role: string;
  institutionId: string | null;
}

/** Response chuẩn từ POST /api/auth/login */
export interface LoginApiResponse {
  success: boolean;
  message: string;
  data: LoginData | null;
  errors: unknown;
}
