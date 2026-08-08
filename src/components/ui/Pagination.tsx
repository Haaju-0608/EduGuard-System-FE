import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/** Thanh phân trang dùng chung — chỉ render khi có hơn 1 trang. `className` để caller tự quyết định
 *  style bọc ngoài: `border-t border-border px-5 py-3.5` khi đặt cuối 1 card/table, hoặc để trống khi
 *  đặt độc lập ngay dưới 1 grid card (khớp 2 kiểu đã dùng sẵn trong app — UserManagementPage vs
 *  ViolationReviewPage). */
export default function Pagination({
  page, totalPages, onChange, label, className = '',
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  label?: string;
  className?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <p className="text-xs text-muted">
        Page {page} of {totalPages}{label ? ` — ${label}` : ''}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="w-8 h-8 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-transparent"
        >
          <FiChevronLeft />
        </button>
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
          className="w-8 h-8 rounded-lg border border-border text-muted grid place-items-center cursor-pointer hover:text-white-soft hover:border-blue-bright/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-transparent"
        >
          <FiChevronRight />
        </button>
      </div>
    </div>
  );
}
