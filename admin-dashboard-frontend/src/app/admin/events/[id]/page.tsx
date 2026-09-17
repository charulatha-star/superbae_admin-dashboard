'use client';

import { useRouter, useParams } from 'next/navigation';
import EventForm from '../EventForm';

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const eventId = typeof params.id === 'string' ? params.id : (Array.isArray(params.id) ? params.id[0] : '');

  return (
    <EventForm
      editingId={eventId}
      onSuccess={(event) => router.push(`/admin/events/${event.id}/view`)}
    />
  );
}
