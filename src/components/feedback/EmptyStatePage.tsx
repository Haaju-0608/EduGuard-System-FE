import React, { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FiAlertCircle, FiHome, FiInbox, FiRefreshCw, FiSearch } from 'react-icons/fi';
import type { EmptyPageVariant } from '../../types/feedback';

interface EmptyStatePageProps {
  variant?: EmptyPageVariant;
  title?: string;
  description?: string;
  icon?: string;
  action?: ReactNode;
  homePath?: string;
  onRetry?: () => void;
}

const VARIANTS: Record<EmptyPageVariant, { icon: string; title: string; description: string; Illustration: React.ElementType }> = {
  empty: {
    icon: '📭',
    title: 'Chưa có dữ liệu',
    description: 'Hiện tại chưa có nội dung để hiển thị. Hãy thử thay đổi bộ lọc hoặc quay lại sau.',
    Illustration: FiInbox,
  },
  error: {
    icon: '⚠️',
    title: 'Không tải được dữ liệu',
    description: 'Đã xảy ra lỗi khi kết nối máy chủ. Vui lòng thử lại sau vài giây.',
    Illustration: FiAlertCircle,
  },
  'not-found': {
    icon: '🔍',
    title: 'Không tìm thấy trang',
    description: 'Trang bạn truy cập không tồn tại hoặc đã bị di chuyển.',
    Illustration: FiSearch,
  },
  loading: {
    icon: '⏳',
    title: 'Đang tải...',
    description: 'Vui lòng đợi trong giây lát.',
    Illustration: FiInbox,
  },
};

/** Trang trống / lỗi / 404 — thay cho empty state đơn giản */
export default function EmptyStatePage({
  variant = 'empty',
  title,
  description,
  icon,
  action,
  homePath = '/lecture',
  onRetry,
}: EmptyStatePageProps) {
  const config = VARIANTS[variant];
  const Illustration = config.Illustration;

  return (
    <div className="empty-state-page animate-stagger-in">
      <div className="empty-state-illustration">
        <div className="empty-state-glow" />
        <Illustration className="empty-state-icon-svg" />
        <span className="empty-state-emoji">{icon ?? config.icon}</span>
      </div>
      <h2 className="empty-state-title">{title ?? config.title}</h2>
      <p className="empty-state-desc">{description ?? config.description}</p>
      {action ?? (
        <div className="empty-state-actions">
          {onRetry && (
            <button type="button" onClick={onRetry} className="empty-state-btn empty-state-btn-secondary">
              <FiRefreshCw className="text-sm" />
              Thử lại
            </button>
          )}
          <Link to={homePath} className="empty-state-btn">
            <FiHome className="text-sm" />
            Về Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
