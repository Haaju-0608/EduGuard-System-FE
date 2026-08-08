import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBookOpen, FiSearch, FiUser } from 'react-icons/fi';
import { useAsyncData } from '../../../hooks/useAsyncData';
import { fetchStudentClasses } from '../../../services/schoolAdminApi';
import type { LecturerClass } from '../../../types/lecturer';

/** Chọn lớp trước khi vào danh sách bài thi — khớp luồng "Class → Exams" đã dùng ở các trang khác
 *  trong hệ thống, tránh dồn hết mọi bài thi của mọi lớp vào 1 danh sách phẳng khó tìm. */
export default function StudentExamClassesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, loading, error, reload } = useAsyncData(() => fetchStudentClasses(), []);
  const classes = data ?? [];

  const filtered = classes.filter((cls) => {
    const q = search.toLowerCase();
    return !q || cls.name.toLowerCase().includes(q) || cls.code.toLowerCase().includes(q);
  });

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
          {filtered.map((cls) => (
            <button
              key={cls.id}
              onClick={() => goToExams(cls)}
              className="text-left bg-navy-card border border-border rounded-[20px] p-5 flex flex-col gap-4 cursor-pointer hover:border-blue-bright/40 transition-colors"
            >
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
          ))}
        </div>
      )}
    </div>
  );
}
