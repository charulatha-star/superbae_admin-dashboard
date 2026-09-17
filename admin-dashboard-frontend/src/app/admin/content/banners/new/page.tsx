'use client';

import { useRouter } from 'next/navigation';
import ContentForm from '../../ContentForm';

export default function CreateBannerPage() {
  const router = useRouter();

  return (
    <ContentForm
      resource="banners"
      onSuccess={(doc) => router.push(`/admin/content/banners/${doc.id}/view`)}
    />
  );
}