/** BE (AttendanceSessionService.UpdateAsync) chặn EndTime > ExamSlot.EndTime cho session gắn
 *  examSlotId, VÀ chặn EndTime > DateTime.UtcNow (so với đồng hồ của SERVER, không phải client) —
 *  ("End time cannot be in the future."). Nếu đồng hồ máy lecturer nhanh hơn server dù chỉ vài
 *  giây (rất thường gặp — đồng hồ Windows/VM lệch giờ), gửi đúng "now" của client bị BE coi là
 *  "trong tương lai" và từ chối — đúng nguyên nhân lỗi "Failed to close session" ngẫu nhiên.
 *  CLOCK_SKEW_BUFFER_MS trừ lùi vài giây làm khoảng đệm hấp thụ độ lệch đồng hồ, không ảnh hưởng
 *  gì tới độ chính xác thật của EndTime (điểm danh không cần chính xác tới từng giây). */
const CLOCK_SKEW_BUFFER_MS = 10_000;

/** Tính EndTime để đóng 1 attendance session — ưu tiên đúng EndTime của exam slot liên kết nếu bài
 *  thi đã hết giờ từ trước (BE chặn EndTime vượt quá giờ đó), ngược lại dùng thời điểm hiện tại trừ
 *  đi khoảng đệm chống lệch đồng hồ ở trên. */
export function computeAttendanceEndTime(examEndTime: string | null | undefined): string {
  if (examEndTime && new Date(examEndTime).getTime() < Date.now()) return examEndTime;
  return new Date(Date.now() - CLOCK_SKEW_BUFFER_MS).toISOString();
}
