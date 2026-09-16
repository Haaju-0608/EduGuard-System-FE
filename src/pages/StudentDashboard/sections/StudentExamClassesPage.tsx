import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBookOpen, FiSearch, FiUser } from 'react-icons/fi';
import { useAuth } from '../../../contexts/AuthContext';
import { useAsyncData } from '../../../hooks/useAsyncData';
import {
  fetchMyExamAttendanceStatus,
  fetchStudentClasses,
  fetchStudentExamRecords,
  fetchStudentExamSlots,
  type StudentAttendanceRecord,
} from '../../../services/schoolAdminApi';
import type { LecturerClass } from '../../../types/lecturer';

interface ClassExamCounts {
  /** Đang trong giờ thi + đã điểm danh Present/Late — bấm Start được ngay. */
  available: number;
  /** Đang trong giờ thi nhưng chưa được điểm danh — chưa vào thi được. */
  noAttendance: number;
}

/** Chọn lớp trước khi vào danh sách bài thi — khớp luồng "Class → Exams" đã dùng ở các trang khác
 *  trong hệ thống, tránh dồn hết mọi bài thi của mọi lớp vào 1 danh sách phẳng khó tìm. */
export default function StudentExamClassesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [search, setSearch] = useState('');

  const { data, loading, error, reload } = useAsyncData(() => fetchStudentClasses(), []);
  const classes = data ?? [];

  // Đếm bài thi đang cần hành động (available / awaiting attendance) theo TỪNG lớp, để student
  // thấy ngay lớp nào đang có bài thi mới mà không phải bấm vào từng lớp một để dò — dùng lại
  // đúng logic thời gian + điểm danh của StudentExamsPage.tsx, nhưng gộp theo classId.
  const { data: examCounts } = useAsyncData(async () => {
    if (!user?.id) return {} as Record<string, ClassExamCounts>;
    const [slots, attendance, recordsResult] = await Promise.all([
      fetchStudentExamSlots(user.id),
      fetchMyExamAttendanceStatus(user.id).catch(() => ({} as Record<string, StudentAttendanceRecord['status']>)),
      fetchStudentExamRecords({ studentId: user.id, pageSize: 200 }).catch(() => ({ items: [] })),
    ]);
    const submittedSlotIds = new Set(recordsResult.items.map((r) => r.examSlotId));

    const counts: Record<string, ClassExamCounts> = {};
    const now = Date.now();
    for (const slot of slots) {
      if (submittedSlotIds.has(slot.id)) continue;
      if (slot.status === 'completed' || slot.status === 'cancelled') continue;
      const start = new Date(slot.startTime).getTime();
      const end = new Date(slot.endTime).getTime();
      const inWindow = slot.status === 'ongoing' || (now >= start && now <= end);
      if (!inWindow) continue;

      const isCheckedIn = attendance[slot.id] === 'present' || attendance[slot.id] === 'late';
      const entry = counts[slot.classId] ?? { available: 0, noAttendance: 0 };
      if (isCheckedIn) entry.available += 1; else entry.noAttendance += 1;
      counts[slot.classId] = entry;
    }
    return counts;
  }, [user?.id]);

  // Lớp có bài thi cần hành động lên đầu (available trước, rồi awaiting attendance) — thay vì để
  // nguyên thứ tự BE trả (không liên quan gì tới việc lớp nào đang có bài mới), giữ ổn định thứ tự
  // gốc GIỮA các lớp cùng nhóm (Array.sort của JS đã stable từ ES2019).
  const rank = (cls: LecturerClass) => {
    const c = examCounts?.[cls.id];
    if (c?.available) return 0;
    if (c?.noAttendance) return 1;
    return 2;
  };
  const filtered = classes
    .filter((cls) => {
      const q = search.toLowerCase();
      return !q || cls.name.toLowerCase().includes(q) || cls.code.toLowerCase().includes(q);
    })
    .sort((a, b) => rank(a) - rank(b));

  const goToExams = (cls: LecturerClass) =>
    navigate(`/student/exams/${cls.id}`, { state: { cls } });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-navy-card border border-border rounded-[20px] p-6">
        <h1 className="font-syne text-2xl font-extrabold text-white-soft">My Exams</h1>
        <p className="text-muted text-sm mt-1">Select a class to view its exams.</p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-navy-card border border-border rounded-xl px-4 py-2.5 focus-within:border-blue-bright/40 transition-colors">
        <FiSearch className="text-muted shrink-0" />
        <input
          type="text"
          placeholder="Search class..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-sm text-white-soft placeholder:text-muted"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-navy-card border border-border rounded-[20px] p-5 animate-pulse h-40" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-navy-card border border-red/30 rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">⚠️</p>
          <p className="text-red text-sm mb-3">{error}</p>
          <button onClick={reload} className="text-xs text-blue-bright underline cursor-pointer bg-transparent border-none">Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-navy-card border border-border rounded-[20px] py-16 text-center">
          <p className="text-3xl mb-3">📚</p>
          <p className="text-muted text-sm">
            {classes.length === 0 ? "You're not enrolled in any class yet." : 'No classes match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((cls) => {
            const counts = examCounts?.[cls.id];
            return (
              <button
                key={cls.id}
                onClick={() => goToExams(cls)}
                className={`relative text-left bg-navy-card border rounded-[20px] p-5 flex flex-col gap-4 cursor-pointer transition-colors ${
                  counts?.available
                    ? 'border-green/40 hover:border-green/60'
                    : counts?.noAttendance
                      ? 'border-gold/40 hover:border-gold/60'
                      : 'border-border hover:border-blue-bright/40'
                }`}
              >
                {/* Badge báo lớp này đang có bài thi cần hành động — để dễ thấy ngay không phải
                    bấm vào từng lớp một để dò lớp nào vừa có bài mới. */}
                {(counts?.available || counts?.noAttendance) ? (
                  <span
                    className={`absolute -top-2 -right-2 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border shadow-lg ${
                      counts.available
                        ? 'text-green bg-navy border-green/40'
                        : 'text-gold bg-navy border-gold/40'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${counts.available ? 'bg-green' : 'bg-gold'}`} />
                    {counts.available
                      ? `${counts.available} exam${counts.available > 1 ? 's' : ''} available`
                      : 'Awaiting attendance'}
                  </span>
                ) : null}

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-muted bg-navy border border-border px-2 py-0.5 rounded-full font-mono">
                      {cls.code}
                    </span>
                    <h3 className="font-syne font-bold text-white-soft text-base mt-2 truncate">{cls.name}</h3>
                  </div>
                  <FiBookOpen className="text-blue-bright text-lg shrink-0" />
                </div>

                <div className="flex items-center gap-2 text-xs text-muted bg-navy/40 rounded-xl px-3 py-2 border border-border/40">
                  <FiUser className="text-cyan shrink-0" />
                  <span className="truncate">{cls.lecturerName}</span>
                </div>

                <span className="mt-auto text-sm font-semibold text-blue-bright">View Exams →</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
