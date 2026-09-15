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

/** Điều hướng khi bấm vào thông báo — chỉ ExamSlot có route đích rõ ràng hiện tại (vi phạm bài thi,
 *  luôn gửi cho đúng Lecturer phụ trách lớp — xem ViolationlogServices.cs SendToUserAsync), nên các
 *  referenceType khác (AttendanceSession/Institution/Transaction) tạm để trống, giữ hành vi cũ
 *  (không phải link, không phải regression).
 *
 *  Dẫn thẳng tới trang Violation Review (không phải Live Monitoring) — đúng ý "bấm thông báo phải
 *  đến violation của học sinh đó". LƯU Ý: mount path thật là "/lecture/*" (KHÔNG PHẢI "/lecturer") —
 *  xem App.tsx. NotificationResponseDto chỉ có 1 field ReferenceId (đang mang ExamSlotId), không có
 *  chỗ chứa participationId — nên chỉ truyền được `examSlotId`, không có `participationId` như link
 *  "Review" trong banner threshold của LiveMonitoringPage.tsx (dòng ~355, có đủ cả 2 field vì đọc
 *  thẳng từ payload SignalR). ViolationReviewPage.tsx vì vậy chỉ tự chọn ĐÚNG BÀI THI, không tự mở
 *  sẵn đúng học sinh — đã báo BE cân nhắc thêm participationId vào Notification nếu cần chính xác
 *  hơn (vd thêm ReferenceTypeEnum.ExamParticipation hoặc 1 field JSON payload riêng). */
function buildActionPath(referenceType: string | null, referenceId: string | null): string | undefined {
  if (!referenceId) return undefined;
  if (referenceType === 'ExamSlot') return `/lecture/violations?examSlotId=${referenceId}`;
  return undefined;
}

function mapApiNotification(n: ApiNotification): AppNotification {
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
    actionPath: buildActionPath(n.referenceType, n.referenceId),
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
      setNotifications((res.items ?? []).map(mapApiNotification));
      setServerUnreadCount(res.unreadCount ?? 0);
    } catch {
      setNotifications([]);
      setServerUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Realtime: server bắn NotificationCreated qua NotificationHub mỗi khi có thông báo mới cho user này
  const notificationHub = useHubConnection(HubRoute.Notifications, isAuthenticated);
  useHubEvent(notificationHub, 'NotificationCreated', () => { reload(); });

  const unreadCount = serverUnreadCount;

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
      value={{ notifications, unreadCount, loading, markAsRead, markAllAsRead, reload }}
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
