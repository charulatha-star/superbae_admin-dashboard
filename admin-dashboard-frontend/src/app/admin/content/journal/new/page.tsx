'use client';

import { useRouter } from 'next/navigation';
import ContentForm from '../../ContentForm';

export default function CreateJournalPromptPage() {
  const router = useRouter();

  return (
    <ContentForm
      resource="journalPrompts"
      onSuccess={(doc) => router.push(`/admin/content/journal/${doc.id}/view`)}
    />
  );
}