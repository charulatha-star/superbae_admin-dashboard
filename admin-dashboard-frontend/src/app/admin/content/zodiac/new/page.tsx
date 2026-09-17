'use client';

import { useRouter } from 'next/navigation';
import ContentForm from '../../ContentForm';

export default function CreateZodiacPage() {
  const router = useRouter();

  return (
    <ContentForm
      resource="zodiac"
      onSuccess={(doc) => router.push(`/admin/content/zodiac/${doc.id}/view`)}
    />
  );
}