'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import { fetchApi } from '../../../../lib/api/api';
import { Loader } from '../../../../components/admin/Loader';
import { Toast } from '../../../../components/admin/Toast';
import styles from '../../admins/create/page.module.css';

export default function EditNotificationPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('push');
  const [targetSegment, setTargetSegment] = useState('all_users');
  const [scheduledFor, setScheduledFor] = useState('');
  const [status, setStatus] = useState('draft');

  useEffect(() => {
    const fetchNotification = async () => {
      try {
        const data = await fetchApi<any>(`/notifications/${id}`);
        setTitle(data.title || '');
        setBody(data.body || '');
        setType(data.type || 'push');
        setTargetSegment(data.targetSegment || 'all_users');
        if (data.scheduledFor) {
          // Format for datetime-local input (YYYY-MM-DDThh:mm)
          const date = new Date(data.scheduledFor);
          const formatted = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
          setScheduledFor(formatted);
        }
        setStatus(data.status || 'draft');
      } catch (error) {
        setToast({ message: 'Failed to load notification', type: 'error' });
      } finally {
        setLoading(false);
      }
    };
    fetchNotification();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await fetchApi(`/notifications/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          body,
          type,
          targetSegment,
          scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : null,
          status,
        }),
      });
      setToast({ message: 'Notification updated successfully', type: 'success' });
      setTimeout(() => router.push('/admin/notifications'), 1500);
    } catch (error) {
      setToast({ message: 'Failed to update notification', type: 'error' });
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{display:'flex',justifyContent:'center',padding:48}}><Loader /></div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link href="/admin/notifications" className={styles.backBtn}>
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className={styles.title}>Edit Notification</h1>
            <p className={styles.subtitle}>Update notification or campaign details.</p>
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
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Status</label>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)} 
                  className={styles.input}
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <Link href="/admin/notifications" className={styles.cancelBtn}>
              Cancel
            </Link>
            <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? <Loader /> : <><CheckCircle size={16} style={{marginRight: '8px'}} /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
