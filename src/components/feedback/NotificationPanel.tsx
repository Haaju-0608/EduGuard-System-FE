import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  FiAlertTriangle,
  FiBook,
  FiCheck,
  FiShield,
  FiUsers,
  FiZap,
} from 'react-icons/fi';
import { useNotifications } from '../../contexts/NotificationContext';
import type { NotificationType } from '../../types/feedback';

const TYPE_ICONS: Record<NotificationType, React.ElementType> = {
  violation: FiAlertTriangle,
  attendance: FiUsers,
  biometric: FiShield,
  class: FiBook,
  system: FiZap,
};

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

/** Panel thông báo dropdown — phong cách Facebook / Instagram */
export default function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const panelRef = useRef<HTMLDivElement>(null);

  /** Đóng khi click ra ngoài */
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={panelRef} className="notif-panel animate-scale-in">
      <div className="notif-panel-header">
        <div>
          <h3 className="notif-panel-title">Thông báo</h3>
          {unreadCount > 0 && (
            <p className="notif-panel-sub">{unreadCount} chưa đọc</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button type="button" onClick={markAllAsRead} className="notif-mark-all">
            <FiCheck className="text-sm" /> Đọc tất cả
          </button>
        )}
      </div>

      <div className="notif-panel-list custom-scrollbar">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="notif-skeleton" />
          ))
        ) : notifications.length === 0 ? (
          <div className="notif-empty">
            <span className="text-3xl">🔔</span>
            <p>Không có thông báo</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const Icon = TYPE_ICONS[notif.type];
            const content = (
              <div
                className={`notif-item ${notif.read ? 'notif-item-read' : 'notif-item-unread'}`}
                onClick={() => markAsRead(notif.id)}
              >
                <div className="notif-avatar" style={{ background: `${notif.accentColor}22`, borderColor: `${notif.accentColor}44` }}>
                  <span style={{ color: notif.accentColor }}>{notif.initials}</span>
                  <div className="notif-type-badge" style={{ background: notif.accentColor }}>
                    <Icon className="text-[10px] text-white" />
                  </div>
                </div>
                <div className="notif-content min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="notif-item-title">{notif.title}</p>
                    {!notif.read && <span className="notif-unread-dot" />}
                  </div>
                  <p className="notif-item-message">{notif.message}</p>
                  <p className="notif-item-time">{notif.time}</p>
                </div>
              </div>
            );

            return notif.actionPath ? (
              <Link key={notif.id} to={notif.actionPath} className="no-underline" onClick={onClose}>
                {content}
              </Link>
            ) : (
              <div key={notif.id}>{content}</div>
            );
          })
        )}
      </div>

      <div className="notif-panel-footer">
        <button type="button" className="notif-see-all" onClick={onClose}>
          Đóng
        </button>
      </div>
    </div>
  );
}
