import React from 'react';
import { PageShell } from '../../../components/lecturer/LecturerUI';
import EmptyStatePage from '../../../components/feedback/EmptyStatePage';

/** Trang 404 trong portal giảng viên */
export default function LecturerNotFoundPage() {
  return (
    <PageShell>
      <EmptyStatePage
        variant="not-found"
        title="Page Not Found"
        description="The page you are looking for does not exist in the lecturer system."
        homePath="/lecture"
      />
    </PageShell>
  );
}
