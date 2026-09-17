'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '../../../../lib/api/api';
import { ArrowLeft } from 'lucide-react';
import styles from '../../groups/form.module.css';

export default function CreateTripPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ 
    title: '', 
    destination: '', 
    startDate: '', 
    endDate: '', 
    organizer: '', 
    participants: 0, 
    price: 0, 
    status: 'open' 
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveTrip = async () => {
    try {
      setIsSubmitting(true);
      await fetchApi('/trips', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          participants: Number(formData.participants),
          price: Number(formData.price)
        }),
      });
      router.push('/admin/trips');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={() => router.push('/admin/trips')}>
        <ArrowLeft size={16} /> Back to Trips
      </button>
      
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Create Trip</h1>
          <p className={styles.subtitle}>Add a new trip to the platform.</p>
        </div>
      </div>

      <div className={styles.formCard}>
        <div className={styles.formGroup}>
          <label>Title</label>
          <input type="text" className={styles.input} value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Trip title" />
        </div>
        <div className={styles.formGroup}>
          <label>Destination</label>
          <input type="text" className={styles.input} value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })} placeholder="Destination" />
        </div>
        <div className={styles.formGroup}>
          <label>Start Date</label>
          <input type="date" className={styles.input} value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
        </div>
        <div className={styles.formGroup}>
          <label>End Date</label>
          <input type="date" className={styles.input} value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
        </div>
        <div className={styles.formGroup}>
          <label>Organizer</label>
          <input type="text" className={styles.input} value={formData.organizer} onChange={e => setFormData({ ...formData, organizer: e.target.value })} placeholder="Organizer name" />
        </div>
        <div className={styles.formGroup}>
          <label>Participants</label>
          <input type="number" className={styles.input} value={formData.participants} onChange={e => setFormData({ ...formData, participants: Number(e.target.value) })} placeholder="Number of participants" />
        </div>
        <div className={styles.formGroup}>
          <label>Price (USD)</label>
          <input type="number" className={styles.input} value={formData.price} onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} placeholder="Price in USD" />
        </div>
        <div className={styles.formGroup}>
          <label>Status</label>
          <select className={styles.input} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
            <option value="open">Open</option>
            <option value="full">Full</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={() => router.push('/admin/trips')} disabled={isSubmitting}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSaveTrip} disabled={isSubmitting || !formData.title || !formData.destination}>
            {isSubmitting ? 'Creating...' : 'Create Trip'}
          </button>
        </div>
      </div>
    </div>
  );
}
