import React, { useEffect, useState } from 'react';
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
import { fetchBiometricRequests, reviewBiometricRequest } from '../../../services/lecturerApi';
import type { BiometricRequest, BiometricStatus } from '../../../types/lecturer';

/** Badge trạng thái duyệt sinh trắc học */
function BiometricStatusBadge({ status }: { status: BiometricStatus }) {
  const config = {
    pending: { label: 'Chờ duyệt', className: 'text-gold bg-gold/10 border-gold/25' },
    approved: { label: 'Đã duyệt', className: 'text-green bg-green/10 border-green/25' },
    rejected: { label: 'Từ chối', className: 'text-red bg-red/10 border-red/25' },
  };
  const { label, className } = config[status];
  return (
    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${className}`}>{label}</span>
  );
}

/** Card duyệt ảnh sinh trắc học — kiểu thẻ ID sinh viên */
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
        <div className="absolute top-3 left-3 flex items-center gap-1 text-[9px] text-cyan font-bold uppercase tracking-widest bg-black/40 backdrop-blur-sm px-2 py-1 rounded-md border border-cyan/20">
          <FiShield className="text-[10px]" /> ID Verify
        </div>
        <div className="absolute bottom-0 inset-x-0 bg-linear-to-t from-black/90 to-transparent p-4">
          <p className="font-syne font-bold text-white-soft">{request.studentName}</p>
          <p className="text-[11px] text-muted font-mono mt-0.5">MSSV: {request.studentId}</p>
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
          <p className="text-xs text-red/80 bg-red/5 border border-red/20 rounded-xl p-2.5 mb-3 leading-relaxed">
            {request.note}
          </p>
        )}

        {request.status === 'pending' && (
          <div className="flex gap-2">
            <button
              onClick={() => onReview(request.id, 'approved')}
              disabled={reviewing === request.id}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green/10 border border-green/30 text-green text-xs font-bold py-2.5 rounded-xl cursor-pointer hover:bg-green/20 transition-all disabled:opacity-50"
            >
              <FiCheck /> Duyệt
            </button>
            <button
              onClick={() => onReview(request.id, 'rejected')}
              disabled={reviewing === request.id}
              className="flex-1 flex items-center justify-center gap-1.5 bg-red/10 border border-red/30 text-red text-xs font-bold py-2.5 rounded-xl cursor-pointer hover:bg-red/20 transition-all disabled:opacity-50"
            >
              <FiX /> Từ chối
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Trang duyệt sinh trắc học sinh viên */
export default function BiometricApprovalPage() {
  const [requests, setRequests] = useState<BiometricRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<BiometricStatus | 'all'>('pending');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const toast = useToast();

  /** Tải danh sách yêu cầu duyệt */
  const loadRequests = async () => {
    setLoading(true);
    try {
      setRequests(await fetchBiometricRequests());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRequests(); }, []);

  /** Duyệt hoặc từ chối yêu cầu */
  const handleReview = async (requestId: string, status: 'approved' | 'rejected') => {
    setReviewing(requestId);
    try {
      const updated = await reviewBiometricRequest(requestId, status);
      setRequests((prev) => prev.map((r) => (r.id === requestId ? updated : r)));
      toast.success(
        status === 'approved' ? 'Đã duyệt sinh trắc học' : 'Đã từ chối yêu cầu',
        `${updated.studentName} — ${updated.classCode}`,
      );
    } catch {
      toast.error('Không thể cập nhật', 'Vui lòng thử lại sau vài giây.');
    } finally {
      setReviewing(null);
    }
  };

  const filteredRequests = statusFilter === 'all'
    ? requests
    : requests.filter((r) => r.status === statusFilter);

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <PageShell>
      <PageHeader
        eyebrow="Biometric Verification"
        title="Duyệt sinh trắc học"
        subtitle="Xác minh ảnh khuôn mặt sinh viên đăng ký trước khi tham gia điểm danh và giám sát thi."
        stats={[
          { label: 'Chờ duyệt', value: String(pendingCount), icon: '⏳' },
          { label: 'Đã duyệt', value: String(requests.filter((r) => r.status === 'approved').length), icon: '✅' },
          { label: 'Từ chối', value: String(requests.filter((r) => r.status === 'rejected').length), icon: '❌' },
          { label: 'Tổng', value: String(requests.length), icon: '🔐' },
        ]}
      />

      <FilterPills
        tabs={[
          { key: 'pending', label: 'Chờ duyệt' },
          { key: 'approved', label: 'Đã duyệt' },
          { key: 'rejected', label: 'Từ chối' },
          { key: 'all', label: 'Tất cả' },
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
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          icon="🔐"
          title="Không có yêu cầu"
          description="Chưa có yêu cầu duyệt sinh trắc học nào trong mục này."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredRequests.map((req, i) => (
            <div key={req.id} style={{ animationDelay: `${i * 0.06}s` }} className="animate-stagger-in">
            <BiometricCard key={req.id} request={req} onReview={handleReview} reviewing={reviewing}             />
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
