'use client';

import { ReportedList } from '../../ReportedList';

export default function ReportedCommentsPage() {
  return (
    <ReportedList
      resource="reportedComments"
      title="Reported Comments"
      subtitle="Handle comments reported by community members."
      contentLabel="Reported Comment"
    />
  );
}
