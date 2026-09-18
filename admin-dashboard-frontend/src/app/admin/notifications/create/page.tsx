'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { fetchApi } from '../../../../lib/api/api';
import { Loader } from '../../../../components/admin/Loader';
import { Toast } from '../../../../components/admin/Toast';
import styles from '../../admins/create/page.module.css';

export default function CreateNotificationPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('push');
  const [targetSegment, setTargetSegment] = useState('all_users');
  const [scheduledFor, setScheduledFor] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await fetchApi('/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          type,
          targetSegment,
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
          status: scheduledFor ? 'scheduled' : 'draft',
        }),
      });
      setToast({ message: 'Notification created successfully', type: 'success' });
      setTimeout(() => router.push('/admin/notifications'), 1500);
    } catch (error) {
      setToast({ message: 'Failed to create notification', type: 'error' });
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/admin/notifications" className={styles.backBtn}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className={styles.title}>Create Notification</h1>
            <p className={styles.subtitle}>Create a new push notification, email, or campaign.</p>
          </div>
        </div>
      </div>

      <div className={styles.content}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Notification Details</h2>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  className={styles.input} 
                  required 
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Type</label>
                <select 
                  value={type} 
                  onChange={(e) => setType(e.target.value)} 
                  className={styles.input}
                >
                  <option value="push">Push Notification</option>
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>

              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Message Body</label>
                <textarea 
                  value={body} 
                  onChange={(e) => setBody(e.target.value)} 
                  className={styles.input} 
                  rows={4}
                  required 
                />
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Targeting & Scheduling</h2>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Target Segment</label>
                <select 
                  value={targetSegment} 
                  onChange={(e) => setTargetSegment(e.target.value)} 
                  className={styles.input}
                >
                  <option value="all_users">All Users</option>
                  <option value="active_users">Active Users (last 7 days)</option>
                  <option value="premium_users">Premium Subscribers</option>
                  <option value="inactive_users">Inactive Users</option>
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Schedule For (Optional)</label>
                <input 
                  type="datetime-local" 
                  value={scheduledFor} 
                  onChange={(e) => setScheduledFor(e.target.value)} 
                  className={styles.input} 
                />
                <span style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
                  Leave blank to save as draft or send immediately later.
                </span>
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <Link href="/admin/notifications" className={styles.cancelBtn}>
              Cancel
            </Link>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? <Loader /> : <><CheckCircle size={16} style={{marginRight: '8px'}} /> Create Notification</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
