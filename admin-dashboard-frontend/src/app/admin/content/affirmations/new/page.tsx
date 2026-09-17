'use client';

import { useRouter } from 'next/navigation';
import ContentForm from '../../ContentForm';

export default function CreateAffirmationPage() {
  const router = useRouter();

  return (
    <ContentForm
      resource="affirmations"
      onSuccess={(doc) => router.push(`/admin/content/affirmations/${doc.id}/view`)}
    />
  );
}