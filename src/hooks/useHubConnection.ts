import { useEffect, useRef, useState } from 'react';
import type { HubConnection } from '@microsoft/signalr';
import { ensureHubStarted, joinHubGroup, type HubRouteValue } from '../services/realtimeClient';

/**
 * Kết nối tới 1 SignalR hub dùng chung (singleton theo route) và trả về connection khi đã sẵn sàng.
 * `enabled=false` (vd: chưa đăng nhập) sẽ không connect.
 */
export function useHubConnection(route: HubRouteValue, enabled: boolean): HubConnection | null {
  const [connection, setConnection] = useState<HubConnection | null>(null);

  useEffect(() => {
    if (!enabled) {
      setConnection(null);
      return;
    }
    let cancelled = false;
    ensureHubStarted(route)
      .then((conn) => { if (!cancelled) setConnection(conn); })
      .catch(() => { if (!cancelled) setConnection(null); });
    return () => { cancelled = true; };
  }, [route, enabled]);

  return connection;
}

/** Đăng ký lắng nghe 1 event trên hub connection, tự cleanup khi unmount hoặc connection đổi */
export function useHubEvent<T = unknown>(
  connection: HubConnection | null,
  eventName: string,
  handler: (payload: T) => void,
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!connection) return;
    const wrapped = (payload: T) => handlerRef.current(payload);
    connection.on(eventName, wrapped);
    return () => { connection.off(eventName, wrapped); };
  }, [connection, eventName]);
}

/**
 * Join 1 group trên hub (vd JoinLecturerDashboard(lecturerId)) khi connection sẵn sàng.
 * `args` là mảng tham số truyền cho hub method — truyền `null` để bỏ qua (vd thiếu id cần thiết).
 */
export function useHubGroup(route: HubRouteValue, method: string, args: unknown[] | null): void {
  const argsKey = args ? JSON.stringify(args) : null;

  useEffect(() => {
    if (!args) return;
    joinHubGroup(route, method, args).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, method, argsKey]);
}
