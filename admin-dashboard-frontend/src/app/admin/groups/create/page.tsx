'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchApi } from '../../../../lib/api/api';
import { ArrowLeft } from 'lucide-react';
import styles from '../form.module.css';

export default function CreateGroupPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({ name: '', description: '', category: '', status: 'pending' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSaveGroup = async () => {
    try {
      setIsSubmitting(true);
      await fetchApi('/groups', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      router.push('/admin/groups');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'An error occurred');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={() => router.push('/admin/groups')}>
        <ArrowLeft size={16} /> Back to Groups
      </button>
      
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Create Group</h1>
          <p className={styles.subtitle}>Add a new community group to the platform.</p>
        </div>
      </div>

      <div className={styles.formCard}>
        <div className={styles.formGroup}>
          <label>Name</label>
          <input type="text" className={styles.input} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Group name" />
        </div>
        <div className={styles.formGroup}>
          <label>Category</label>
          <input type="text" className={styles.input} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="e.g. Technology" />
        </div>
        <div className={styles.formGroup}>
          <label>Description</label>
          <textarea className={styles.textarea} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description..." />
        </div>
        <div className={styles.formGroup}>
          <label>Status</label>
          <select className={styles.input} value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={() => router.push('/admin/groups')} disabled={isSubmitting}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSaveGroup} disabled={isSubmitting || !formData.name}>
            {isSubmitting ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
