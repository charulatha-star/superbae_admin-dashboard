'use client';

import { ReportedList } from '../../ReportedList';

export default function ReportedPostsPage() {
  return (
    <ReportedList
      resource="reportedPosts"
      title="Reported Posts"
      subtitle="Handle posts reported by community members."
      contentLabel="Reported Post"
    />
  );
}
