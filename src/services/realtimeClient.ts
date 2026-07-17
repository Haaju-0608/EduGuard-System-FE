import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { API_BASE_URL } from './apiClient';
import { getAccessToken } from './authStorage';

/** Khớp với EduGuardProject/Hubs/HubRoutes.cs */
export const HubRoute = {
  Notifications: '/hubs/notifications',
  Exams: '/hubs/exams',
  Attendance: '/hubs/attendance',
  Dashboard: '/hubs/dashboard',
} as const;

export type HubRouteValue = (typeof HubRoute)[keyof typeof HubRoute];

const connections = new Map<HubRouteValue, HubConnection>();

function createConnection(route: HubRouteValue): HubConnection {
  return new HubConnectionBuilder()
    .withUrl(`${API_BASE_URL}${route}`, {
      accessTokenFactory: () => getAccessToken() ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
}

/** Lấy (hoặc tạo mới) connection dùng chung cho 1 hub — nhiều component có thể share cùng 1 socket */
function getConnection(route: HubRouteValue): HubConnection {
  let conn = connections.get(route);
  if (!conn) {
    conn = createConnection(route);
    connections.set(route, conn);
  }
  return conn;
}

/** Đảm bảo connection đã start (an toàn khi gọi nhiều lần đồng thời) */
export async function ensureHubStarted(route: HubRouteValue): Promise<HubConnection> {
  const conn = getConnection(route);
  if (conn.state === HubConnectionState.Disconnected) {
    try {
      await conn.start();
    } catch (e) {
      // Không có token hợp lệ hoặc BE không truy cập được — caller tự retry qua effect deps
      console.warn(`[realtime] Failed to start hub ${route}:`, e);
      throw e;
    }
  } else if (conn.state === HubConnectionState.Connecting || conn.state === HubConnectionState.Reconnecting) {
    // Đợi connection hiện tại xử lý xong thay vì start() chồng lên nhau
    await new Promise<void>((resolve) => {
      const check = () => {
        if (conn!.state === HubConnectionState.Connected || conn!.state === HubConnectionState.Disconnected) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }
  return conn;
}

/** Ngắt toàn bộ hub connection — gọi khi logout để tránh giữ socket với token cũ */
export async function stopAllHubConnections(): Promise<void> {
  const all = [...connections.values()];
  connections.clear();
  await Promise.all(all.map((c) => c.stop().catch(() => undefined)));
}

const registeredJoins = new Set<string>();

/**
 * Join 1 group trên hub (vd JoinLecturerDashboard, JoinInstitutionDashboard) ngay khi connect,
 * và tự rejoin sau mỗi lần reconnect — vì server dùng ConnectionId để quản lý group nên
 * group membership bị mất khi SignalR tự reconnect.
 * Dedupe theo (route, method, args) để không đăng ký lặp onreconnected khi nhiều component cùng mount.
 */
export async function joinHubGroup(route: HubRouteValue, method: string, args: unknown[]): Promise<void> {
  const conn = await ensureHubStarted(route);
  const key = `${route}:${method}:${JSON.stringify(args)}`;

  const join = () => { conn.invoke(method, ...args).catch((e) => console.warn(`[realtime] join ${method} failed`, e)); };
  join();

  if (!registeredJoins.has(key)) {
    registeredJoins.add(key);
    conn.onreconnected(join);
  }
}
