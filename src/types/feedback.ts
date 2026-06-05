/** Loại toast hiển thị */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/** Toast thông báo ngắn (validate, action feedback) */
export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

/** Loại thông báo trong panel (kiểu social feed) */
export type NotificationType = 'violation' | 'attendance' | 'biometric' | 'class' | 'system';

/** Thông báo trong dropdown — phong cách Facebook/Instagram */
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  read: boolean;
  initials: string;
  accentColor: string;
  actionPath?: string;
}

/** Variant trang trống / lỗi */
export type EmptyPageVariant = 'empty' | 'error' | 'not-found' | 'loading';
