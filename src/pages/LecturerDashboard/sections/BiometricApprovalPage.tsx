import React, { useMemo, useState } from 'react';
import { FiCheck, FiClock, FiShield, FiUser, FiX } from 'react-icons/fi';
import {
  CourseCodeBadge,
  EmptyState,
  FilterPills,
  PageHeader,
  PageShell,
  SkeletonCard,
} from '../../../components/lecturer/LecturerUI';
import { useToast } from '../../../contexts/ToastContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchSchoolAdminBiometricRequests } from '../../../services/schoolAdminApi';
import type { BiometricRequest, BiometricStatus } from '../../../types/lecturer';

/** Badge trạng thái duyệt sinh trắc học */
function BiometricStatusBadge({ status }: { status: BiometricStatus }) {
  const config = {
    pending: { label: 'Pending', className: 'text-gold bg-gold/10 border-gold/25' },
    approved: { label: 'Approved', className: 'text-green bg-green/10 border-green/25' },
    rejected: { label: 'Rejected', className: 'text-red bg-red/10 border-red/25' },
  };
  const { label, className } = config[status];
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${className}`}>{label}</span>
  );
}

/** Card duyệt ảnh sinh trắc học */
function BiometricCard({
  request,
  onReview,
  reviewing,
}: {
  request: BiometricRequest;
  onReview: (id: string, status: 'approved' | 'rejected') => void;
  reviewing: string | null;
}) {
  return (
    <div className="bio-id-card">
      <div className="bio-id-photo">
        <div className="bio-face-frame">
          <FiUser className="text-4xl text-blue-bright/50" />
        </div>
        <div className="absolute top-3 right-3">
          <BiometricStatusBadge status={request.status} />
        </div>
        <div className="absolute top-3 left-3 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest bio-id-badge">
          <FiShield className="text-[10px]" /> ID Verify
        </div>
        <div className="absolute bottom-0 inset-x-0 p-4 bio-id-overlay">
          <p className="font-syne font-bold text-white-soft">{request.studentName}</p>
          <p className="text-[11px] text-muted font-mono mt-0.5">Student ID: {request.studentId}</p>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <CourseCodeBadge code={request.classCode} size="sm" />
          <span className="text-[10px] text-muted flex items-center gap-1">
            <FiClock className="text-[10px]" /> {request.submittedAt}
          </span>
        </div>

        {request.note && (
          <p className="text-xs text-muted bg-navy/40 border border-border/50 rounded-xl p-2.5 mb-3 leading-relaxed">
            {request.note}
          </p>
        )}

        {request.status === 'pending' && (
          <div className="flex gap-2">
            <button
              onClick={() => onReview(request.id, 'approved')}
              disabled={reviewing === request.id}
              className="flex-1 flex items-center justify-center gap-1.5 bio-btn-approve text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all disabled:opacity-50"
            >
              <FiCheck /> Approve
            </button>
            <button
              onClick={() => onReview(request.id, 'rejected')}
              disabled={reviewing === request.id}
              className="flex-1 flex items-center justify-center gap-1.5 bio-btn-reject text-xs font-bold py-2.5 rounded-xl cursor-pointer transition-all disabled:opacity-50"
            >
              <FiX /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Trang duyệt sinh trắc học — GET /api/biometric-requests */
export default function BiometricApprovalPage() {
  const [statusFilter, setStatusFilter] = useState<BiometricStatus | 'all'>('all');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const toast = useToast();

  const { data, loading, error, reload } = useAsyncData(async () => {
    const result = await fetchSchoolAdminBiometricRequests({ page: 1, pageSize: 50 });
    return result.items;
  }, []);

  const requests = data ?? [];

  const handleReview = async (requestId: string, status: 'approved' | 'rejected') => {
    setReviewing(requestId);
    try {
      // TODO: tích hợp PUT/PATCH review API khi backend có endpoint
      toast.info(
        'Review API pending',
        `Approve/reject via API is not available yet. Request ID: ${requestId.slice(0, 8)}… (${status})`,
      );
    } finally {
      setReviewing(null);
    }
  };

  const filteredRequests = useMemo(
    () => (statusFilter === 'all' ? requests : requests.filter((r) => r.status === statusFilter)),
    [requests, statusFilter],
  );

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Biometric Verification"
        title="Biometric Verification"
        subtitle="Verify student face photos registered before they join attendance sessions and proctored exams."
        stats={[
          { label: 'Pending', value: String(pendingCount), icon: '⏳' },
          { label: 'Approved', value: String(requests.filter((r) => r.status === 'approved').length), icon: '✅' },
          { label: 'Rejected', value: String(requests.filter((r) => r.status === 'rejected').length), icon: '❌' },
          { label: 'Total', value: String(requests.length), icon: '🔐' },
        ]}
      />

      <FilterPills
        tabs={[
          { key: 'pending', label: 'Pending' },
          { key: 'approved', label: 'Approved' },
          { key: 'rejected', label: 'Rejected' },
          { key: 'all', label: 'All' },
        ]}
        active={statusFilter}
        onChange={setStatusFilter}
        counts={{
          pending: requests.filter((r) => r.status === 'pending').length,
          approved: requests.filter((r) => r.status === 'approved').length,
          rejected: requests.filter((r) => r.status === 'rejected').length,
          all: requests.length,
        }}
      />

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="aspect-[3/4]" />)}
        </div>
      ) : error ? (
        <EmptyState
          variant="error"
          icon="🔐"
          title="Failed to load biometric requests"
          description={error}
          onRetry={reload}
        />
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon="🔐"
          title="No requests"
          description="There are no biometric verification requests in this section."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredRequests.map((req, i) => (
            <div key={req.id} style={{ animationDelay: `${i * 0.06}s` }} className="animate-stagger-in">
              <BiometricCard request={req} onReview={handleReview} reviewing={reviewing} />
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
