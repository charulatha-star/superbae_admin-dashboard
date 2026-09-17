'use client';

import { useParams, useRouter } from 'next/navigation';
import ContentForm from '../../ContentForm';

export default function EditZodiacPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  return (
    <ContentForm
      resource="zodiac"
      editingId={id}
      onSuccess={(doc) => router.push(`/admin/content/zodiac/${doc.id}/view`)}
      onDeleted={() => router.push('/admin/content/zodiac')}
    />
  );
}