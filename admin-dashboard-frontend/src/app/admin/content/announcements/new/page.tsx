'use client';

import { useRouter } from 'next/navigation';
import ContentForm from '../../ContentForm';

export default function CreateAnnouncementPage() {
  const router = useRouter();

  return (
    <ContentForm
      resource="appAnnouncements"
      onSuccess={(doc) => router.push(`/admin/content/announcements/${doc.id}/view`)}
    />
  );
}
