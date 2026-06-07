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
    title: 'No Data Available',
    description: 'There is currently no content to display. Try changing the filters or check back later.',
    Illustration: FiInbox,
  },
  error: {
    icon: '⚠️',
    title: 'Failed to Load Data',
    description: 'An error occurred while connecting to the server. Please try again in a few seconds.',
    Illustration: FiAlertCircle,
  },
  'not-found': {
    icon: '🔍',
    title: 'Page Not Found',
    description: 'The page you accessed does not exist or has been moved.',
    Illustration: FiSearch,
  },
  loading: {
    icon: '⏳',
    title: 'Loading...',
    description: 'Please wait a moment.',
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
              Try Again
            </button>
          )}
          <Link to={homePath} className="empty-state-btn">
            <FiHome className="text-sm" />
            Back to Dashboard
          </Link>
        </div>
      )}
    </div>
  );
}
