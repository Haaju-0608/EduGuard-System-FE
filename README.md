# EduGuard — Frontend

Nền tảng thi trắc nghiệm online có giám sát chống gian lận (AI proctoring) và điểm danh bằng nhận
diện khuôn mặt, dành cho các trường/trung tâm đào tạo. Repo này là phần **Frontend** — SPA React,
gọi vào Backend ASP.NET Core qua REST API + SignalR.

## Công nghệ chính

- **React 19** + **TypeScript** + **Vite** + **Tailwind CSS v4**
- **SignalR** (`@microsoft/signalr`) — cập nhật realtime (dashboard, điểm danh, phòng thi) không cần F5
- **MediaPipe Tasks Vision** — AI giám sát khuôn mặt/hành vi chạy ngay trong trình duyệt lúc thi (không gửi video lên server)
- **React Router** — điều hướng SPA, tách 4 dashboard theo vai trò (SuperAdmin / SchoolAdmin / Lecturer / Student)

## Bắt đầu

```bash
npm install
npm run dev        # chạy dev server (Vite)
npm run build       # build production
npm run typecheck   # kiểm tra kiểu (tsc --noEmit)
npm run lint         # eslint
```

Cần file `.env.local` (không commit) khai báo:

```
VITE_API_BASE_URL=https://<backend-url>
```

Vài biến khác chỉ dùng khi cần test riêng (không bắt buộc): `VITE_FASTAPI_EVIDENCE_URL`,
`VITE_AI_PARTICIPATION_ID`, `VITE_AI_SESSION_ID`, `VITE_AI_STUDENT_ID`.

## Vai trò & tính năng chính

| Vai trò | Việc chính |
|---|---|
| **SuperAdmin** | Quản lý các trường (institution), gói cước, doanh thu toàn hệ thống |
| **SchoolAdmin** | Quản lý lớp học, giảng viên, sinh viên, duyệt đăng ký sinh trắc học, ví tiền của trường |
| **Lecturer** | Coi thi, điểm danh (thủ công + quét AI qua video), xem báo cáo vi phạm, đình chỉ/khôi phục sinh viên |
| **Student** | Làm bài thi có giám sát AI, được điểm danh, đăng ký sinh trắc học |

Các luồng đáng chú ý: thi trắc nghiệm có giám sát AI realtime, tự động đình chỉ sau 3 lần vi phạm
trình duyệt (đổi tab/mất focus/thoát fullscreen), điểm danh hàng loạt bằng quét khuôn mặt qua video,
ví tiền trả theo lượt sử dụng (nạp qua VNPay), báo cáo xuất Excel/PDF.

## Cấu trúc thư mục

```
src/
  ai/            AI giám sát phòng thi (client-side, MediaPipe)
  components/    Component dùng chung (ui, layout, lecturer...)
  contexts/      React context (Auth, Toast, ExamTermination...)
  hooks/         Custom hook (useAsyncData, useHubConnection...)
  pages/         Trang theo từng dashboard/vai trò
  services/      Gọi API (theo domain: schoolAdminApi, adminApi...) + SignalR client
  types/         Type định nghĩa dữ liệu từ API
  utils/         Hàm tiện ích thuần
```

## Repo liên quan

- Backend (ASP.NET Core): API + SignalR hub, xử lý nghiệp vụ, kết nối Supabase (PostgreSQL + pgvector)
- AI Service (Python/FastAPI): trích vector khuôn mặt cho đăng ký sinh trắc học và điểm danh/xác thực danh tính
