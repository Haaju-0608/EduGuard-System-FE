import React from 'react';
import { FiAlertCircle, FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi';
import { useToast } from '../../contexts/ToastContext';
import type { ToastType } from '../../types/feedback';

const TOAST_CONFIG: Record<ToastType, { icon: React.ElementType; className: string }> = {
  success: { icon: FiCheckCircle, className: 'toast-success' },
  error: { icon: FiAlertCircle, className: 'toast-error' },
  warning: { icon: FiAlertTriangle, className: 'toast-warning' },
  info: { icon: FiInfo, className: 'toast-info' },
};

/** Container toast — góc trên phải, kiểu Instagram/modern app */
export default function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast, i) => {
        const { icon: Icon, className } = TOAST_CONFIG[toast.type];
        return (
          <div
            key={toast.id}
            className={`toast-item ${className} animate-toast-in`}
            style={{ animationDelay: `${i * 0.05}s` }}
            role="alert"
          >
            <div className="toast-icon-wrap">
              <Icon className="text-lg" />
            </div>
            <div className="toast-body min-w-0 flex-1">
              <p className="toast-title">{toast.title}</p>
              {toast.message && <p className="toast-message">{toast.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="toast-close"
              aria-label="Đóng"
            >
              <FiX />
            </button>
            <div className="toast-progress" style={{ animationDuration: `${toast.duration ?? 4000}ms` }} />
          </div>
        );
      })}
    </div>
  );
}
