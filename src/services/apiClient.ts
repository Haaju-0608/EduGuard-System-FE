/**
 * Client API cơ bản — mock delay + fetch tới backend EduGuard.
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'https://eduguard-api-gdhg.onrender.com';

const DEFAULT_DELAY_MS = 400;

/** Mô phỏng độ trễ gọi API */
export async function simulateNetworkDelay(ms = DEFAULT_DELAY_MS): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Wrapper trả về dữ liệu sau khi mô phỏng delay — dùng cho mock API */
export async function mockApiResponse<T>(data: T, delayMs = DEFAULT_DELAY_MS): Promise<T> {
  await simulateNetworkDelay(delayMs);
  return data;
}

/** Chuẩn hóa response API (dùng khi ráp backend thật) */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
