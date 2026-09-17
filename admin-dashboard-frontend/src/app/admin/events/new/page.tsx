'use client';

import { useRouter } from 'next/navigation';
import EventForm from '../EventForm';

export default function CreateEventPage() {
  const router = useRouter();

  return (
    <EventForm
      onSuccess={() => router.push('/admin/events')}
    />
  );
}
