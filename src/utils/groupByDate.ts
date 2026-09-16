export interface DateGroup<T> {
  /** Nửa đêm (giờ local trình duyệt) của ngày này — dùng để format label + sort. */
  date: Date;
  items: T[];
}

/**
 * Nhóm 1 danh sách theo NGÀY (giờ local, không phải UTC — tránh lệch ngày cho người xem ở múi giờ
 * khác) — dùng cho các trang list dài (Attendance exams, Exam slots, Violation Review exam picker)
 * để phân tách các đợt cách xa nhau theo ngày thay vì phân trang phẳng. Trả về mới nhất trước
 * (giảm dần theo ngày); thứ tự items TRONG 1 ngày giữ nguyên như mảng đầu vào — caller tự sort
 * trước nếu cần thứ tự phụ (vd theo giờ).
 */
export function groupByDate<T>(items: T[], getIsoDate: (item: T) => string): DateGroup<T>[] {
  const map = new Map<number, DateGroup<T>>();
  for (const item of items) {
    const d = new Date(getIsoDate(item));
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const existing = map.get(dayStart);
    if (existing) existing.items.push(item);
    else map.set(dayStart, { date: new Date(dayStart), items: [item] });
  }
  return [...map.values()].sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** "Wed, 10 Sep 2026" — label chuẩn cho header 1 nhóm ngày. */
export function formatDateGroupLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}
