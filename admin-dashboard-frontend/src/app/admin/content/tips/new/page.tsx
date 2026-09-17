'use client';

import { useRouter } from 'next/navigation';
import ContentForm from '../../ContentForm';

export default function CreateTipPage() {
  const router = useRouter();

  return (
    <ContentForm
      resource="tips"
      onSuccess={(doc) => router.push(`/admin/content/tips/${doc.id}/view`)}
    />
  );
}