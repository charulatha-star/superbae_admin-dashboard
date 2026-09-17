'use client';

import { useRouter } from 'next/navigation';
import ContentForm from '../../ContentForm';

export default function CreateFortunePage() {
  const router = useRouter();

  return (
    <ContentForm
      resource="fortuneCookies"
      onSuccess={(doc) => router.push(`/admin/content/fortune/${doc.id}/view`)}
    />
  );
}
