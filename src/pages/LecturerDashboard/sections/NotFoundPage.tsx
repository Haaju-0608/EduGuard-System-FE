import React from 'react';
import { PageShell } from '../../../components/lecturer/LecturerUI';
import EmptyStatePage from '../../../components/feedback/EmptyStatePage';

/** Trang 404 trong portal giảng viên */
export default function LecturerNotFoundPage() {
  return (
    <PageShell>
      <EmptyStatePage
        variant="not-found"
        title="Trang không tồn tại"
        description="Đường dẫn bạn truy cập không có trong hệ thống giảng viên."
        homePath="/lecture"
      />
    </PageShell>
  );
}
