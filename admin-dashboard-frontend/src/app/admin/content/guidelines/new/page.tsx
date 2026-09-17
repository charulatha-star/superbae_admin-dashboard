'use client';

import { useRouter } from 'next/navigation';
import ContentForm from '../../ContentForm';

export default function CreateGuidelinePage() {
  const router = useRouter();

  return (
    <ContentForm
      resource="communityGuidelines"
      onSuccess={(doc) => router.push(`/admin/content/guidelines/${doc.id}/view`)}
    />
  );
}
