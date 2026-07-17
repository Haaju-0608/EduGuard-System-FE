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

function mapApiNotification(n: ApiNotification): AppNotification {
  const type = mapNotificationType(n.type);
  return {
    id: n.id,
    type,
    title: n.title,
    message: n.message,
    time: new Date(n.createdAt).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    read: n.isRead,
    initials: type === 'violation' ? '⚠' : type === 'attendance' ? '✅' : type === 'biometric' ? '🔐' : '🔔',
    accentColor: TYPE_COLORS[type],
  };
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiGet<ApiNotification[] | { items: ApiNotification[] }>(`/api/notifications/user/${user.id}`);
      const list = Array.isArray(res) ? res : (res as { items: ApiNotification[] }).items ?? [];
      setNotifications(list.map(mapApiNotification));
    } catch {
      setNotifications([]);
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await apiPut(`/api/notifications/${id}/read`, {});
    } catch {
      // optimistic update — không roll back
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
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
