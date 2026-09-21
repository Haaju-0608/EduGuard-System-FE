import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { apiGet, apiPut } from '../services/apiClient';
import type { ApiNotification } from '../types/api';
import type { AppNotification, NotificationType } from '../types/feedback';
import { useAuth } from './AuthContext';
import { useHubConnection, useHubEvent } from '../hooks/useHubConnection';
import { HubRoute } from '../services/realtimeClient';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  unreadViolationCount: number;
  loading: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  reload: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

function mapNotificationType(type: string | null): NotificationType {
  const t = (type ?? '').toLowerCase();
  if (t.includes('violation')) return 'violation';
  if (t.includes('attendance')) return 'attendance';
  if (t.includes('biometric') || t.includes('face')) return 'biometric';
  if (t.includes('class')) return 'class';
  return 'system';
}

const TYPE_COLORS: Record<NotificationType, string> = {
  violation: 'bg-red',
  attendance: 'bg-green',
  biometric: 'bg-blue-bright',
  class: 'bg-cyan',
  system: 'bg-gold',
};

type AppUserRole = 'user' | 'admin' | 'schooladmin' | 'lecture';

/** Điều hướng khi bấm vào thông báo — đích phụ thuộc CẢ loại thông báo LẪN role người nhận (cùng 1
 *  loại "ViolationDetected" nhưng giảng viên nhận cảnh báo vi phạm còn sinh viên nhận thông báo bị
 *  loại — trước đây mọi role đều bị đẩy sang /lecture/violations, sinh viên bấm vào là văng khỏi
 *  trang của mình). LƯU Ý: mount path thật của giảng viên là "/lecture/*" (KHÔNG PHẢI "/lecturer") —
 *  xem App.tsx.
 *
 *  Với giảng viên, thông báo vi phạm dùng ExamParticipation làm referenceType (BE commit 1fe0e84) —
 *  `referenceId` CHÍNH LÀ participationId; ViolationReviewPage.tsx đã có sẵn deep-link theo
 *  `?participationId=` nên chỉ cần truyền đúng id đó.
 *
 *  Loại/role nào chưa có trang đích hợp lý thì trả undefined (không phải link, không phải regression). */
function buildActionPath(
  role: AppUserRole | undefined,
  rawType: string | null,
  referenceType: string | null,
  referenceId: string | null,
): string | undefined {
  if (!role) return undefined;
  // Chuẩn hoá "ViolationDetected" / "VIOLATION_DETECTED" / "violation-detected" về cùng 1 dạng.
  const t = (rawType ?? '').toLowerCase().replace(/[^a-z]/g, '');

  if (t.includes('violation')) {
    if (role === 'lecture') {
      return referenceType === 'ExamParticipation' && referenceId
        ? `/lecture/violations?participationId=${referenceId}`
        : '/lecture/violations';
    }
    if (role === 'user') return '/student/exams';
    if (role === 'schooladmin') return '/school/monitoring';
    return undefined;
  }
  if (t.includes('attendance')) {
    if (role === 'user') return '/student/attendance';
    if (role === 'lecture') return '/lecture/attendance';
    return undefined;
  }
  if (t.includes('examreminder')) {
    if (role === 'user') return '/student/exams';
    if (role === 'lecture') return '/lecture/exams';
    if (role === 'schooladmin') return '/school/exams';
    return undefined;
  }
  if (t.includes('lowbalance') || t.includes('suspend')) {
    return role === 'schooladmin' ? '/school/wallet' : undefined;
  }
  if (t.includes('biometric')) {
    if (role === 'user') return '/student/profile';
    if (role === 'schooladmin') return '/school/biometric';
    return undefined;
  }
  return undefined;
}

function mapApiNotification(n: ApiNotification, role: AppUserRole | undefined): AppNotification {
  const type = mapNotificationType(n.type);
  return {
    id: n.id,
    type,
    title: n.title,
    message: n.body,
    time: new Date(n.createdAt).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    read: n.isRead,
    initials: type === 'violation' ? '⚠' : type === 'attendance' ? '✅' : type === 'biometric' ? '🔐' : '🔔',
    accentColor: TYPE_COLORS[type],
    actionPath: buildActionPath(role, n.type, n.referenceType, n.referenceId),
  };
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [serverUnreadCount, setServerUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setServerUnreadCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // pageSize=50 (không chỉ mặc định 10 của BE) — panel này không có phân trang, lấy đủ số gần
      // đây để không hụt thông báo cũ hơn 10 cái. unreadCount lấy thẳng từ BE (đếm trên TOÀN BỘ
      // notification, không chỉ trang đang fetch) — trước đây tự đếm bằng `.filter(!read).length`
      // trên đúng 10 item vừa tải, hụt số thật khi có hơn 10 thông báo chưa đọc.
      const res = await apiGet<{ items: ApiNotification[]; unreadCount: number }>(
        `/api/notifications/user/${user.id}?pageSize=50`,
      );
      setNotifications((res.items ?? []).map((n) => mapApiNotification(n, user.role)));
      setServerUnreadCount(res.unreadCount ?? 0);
    } catch {
      setNotifications([]);
      setServerUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Realtime: server bắn NotificationCreated qua NotificationHub mỗi khi có thông báo mới cho user này
  const notificationHub = useHubConnection(HubRoute.Notifications, isAuthenticated);
  useHubEvent(notificationHub, 'NotificationCreated', () => { reload(); });

  const unreadCount = serverUnreadCount;
  // Số thông báo vi phạm CHƯA ĐỌC (trong các thông báo đã tải) — để chuông đổi sang màu đỏ cảnh báo
  // riêng khi có vi phạm chưa xem, thay vì chỉ hiện 1 con số chung lẫn với thông báo thường.
  const unreadViolationCount = notifications.filter((n) => n.type === 'violation' && !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const target = prev.find((n) => n.id === id);
      if (target && !target.read) setServerUnreadCount((c) => Math.max(0, c - 1));
      return prev.map((n) => (n.id === id ? { ...n, read: true } : n));
    });
    try {
      await apiPut(`/api/notifications/${id}/read`, {});
    } catch {
      // optimistic update — không roll back
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setServerUnreadCount(0);
    try {
      await apiPut('/api/notifications/read-all', {});
    } catch {
      // optimistic update
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, unreadViolationCount, loading, markAsRead, markAllAsRead, reload }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextType {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
