// src/app/admin/users/[id]/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, X, PauseCircle, Ban, CheckCircle, PlayCircle } from 'lucide-react';
import { fetchApi } from '@/src/lib/api/api';
import { Loader } from '@/src/components/admin/Loader';
import { PermissionGate } from '@/src/components/admin/PermissionGate';
import { Toast } from '@/src/components/admin/Toast';
import { ConfirmModal } from '@/src/components/admin/ConfirmModal';
import styles from '../../admins/create/page.module.css';
import s from './view/viewSections.module.css';

interface User {
  id: string;
  name: string;
  phone: number;
  email: string;
  status: string;
  plan: string;
  blocked?: boolean;
  joinedAt: string;
  lastSeen: string;
  posts: number;
  groups: number;
   // Profile / personal fields (from /profile + /personal endpoints)
  bio?: string;
  location?: string;
  dob?: string;
  gender?: string;
  occupation?: string;
}

type ConfirmAction = 'activate' | 'suspend' | 'block' | 'unblock' | null;

export default function EditUserPage() {
  const router = useRouter();
  const { id: userId = '' } = useParams();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirm, setConfirm] = useState<{ type: Exclude<ConfirmAction, null> } | null>(null);
  const [acting, setActing] = useState(false);

  // Load user data on mount
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchApi<User>(`/users/${userId}`);
        setUser(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load user data.');
      } finally {
        setLoading(false);
      }
    };
    if (userId) load();
  }, [userId]);

  // Merge profile (/profile) and personal (/personal) data into the editable user
  // so the edit form can surface those fields too.
  useEffect(() => {
    if (!userId) return;
    Promise.all([
      fetchApi<Record<string, unknown>>(`/users/${userId}/profile`).catch(() => null) as Promise<Record<string, unknown> | null>,
      fetchApi<Record<string, unknown>>(`/users/${userId}/personal`).catch(() => null) as Promise<Record<string, unknown> | null>,
    ]).then(([profileData, personalData]) => {
      if (!profileData && !personalData) return;
      setUser((prev) => prev ? {
        ...prev,
        ...(profileData && {
          bio: String(profileData.bio || profileData.about || ''),
        }),
        ...(personalData && {
          location: String(personalData.location || personalData.city || personalData.country || ''),
          dob: String(personalData.dob || personalData.birthDate || personalData.dateOfBirth || ''),
          gender: String(personalData.gender || ''),
          occupation: String(personalData.occupation || personalData.profession || ''),
        }),
      } : prev);
    }).catch((err) => console.error('Failed to load profile/personal for edit', err));
  }, [userId]);

const handleChange = (field: keyof User) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
  if (!user) return;

  let value = e.target.value;

  // Restrict phone field to digits only
  if (field === 'phone') {
    value = value.replace(/\D/g, '');
  }

  setUser({ ...user, [field]: value });
};

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      await fetchApi(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify(user),
      });
      setToast({ message: 'User updated successfully', type: 'success' });
      setTimeout(() => router.push('/admin/users'), 1200);
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to update user', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => router.push('/admin/users');

  const handleAccountAction = async (action: Exclude<ConfirmAction, null>) => {
    if (!user) return;
    setActing(true);
    try {
      const patch: Record<string, string | boolean> =
        action === 'block'
          ? { status: 'suspended', blocked: true }
          : { status: 'active', blocked: false }; // activate, suspend, unblock restore to active
      if (action === 'suspend') patch.status = 'suspended';

      const updated = await fetchApi<User>(`/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setUser((prev) => (prev ? { ...prev, ...updated } : prev));
      const text = action === 'block' ? 'Blocked' : action === 'suspend' ? 'Suspended' : 'Activated';
      setToast({ message: `User account ${text}.`, type: 'success' });
    } catch (err) {
      console.error(err);
      setToast({ message: 'Failed to update account status.', type: 'error' });
    } finally {
      setActing(false);
      setConfirm(null);
    }
  };

  const confirmLabel = (action: Exclude<ConfirmAction, null>) => {
    if (action === 'suspend') return 'Suspend';
    if (action === 'block') return 'Block';
    if (action === 'unblock') return 'Unblock';
    return 'Activate';
  };

  // Loading state – reuse the shared admin loader component
  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <Loader />
        </div>
      </div>
    );
  }

  // If the user was not found after loading
  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.errorAlert}>User not found.</div>
        <Link href="/admin/users" className={styles.backBtn}>
          <ArrowLeft size={16} /> Back
        </Link>
      </div>
    );
  }

  return (
    <PermissionGate permission="users.edit">
      <div className={styles.container}>
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
        <div className={styles.header}>
          <Link href="/admin/users" className={styles.backBtn}>
            <ArrowLeft size={16} /> Back to Users
          </Link>
          <h1 className={styles.title}>Edit User</h1>
          <p className={styles.subtitle}>Update user account details.</p>
        </div>
        <div className={styles.content}>
          <form className={styles.form} onSubmit={e => { e.preventDefault(); handleSave(); }}>
            {error && <div className={styles.errorAlert}>{error}</div>}

            {/* Basic Information */}
            <div className={styles.formSection}>
              <h3 className={styles.sectionTitle}>Basic Information</h3>
              <div className={styles.grid}>
                <div className={styles.field}>
                  <label className={styles.label}>Full Name</label>
                  <input
                    type="text"
                    value={user.name}
                    onChange={handleChange('name')}
                    className={styles.input}
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Phone No</label>
                  <input
                    type="text"
                    value={user.phone}
                    maxLength={10}
                    onChange={handleChange('phone')}
                    className={styles.input}
                    required
                  />
                </div>
                {/* <div className={styles.field}>
                  <label className={styles.label}>Email</label>
                  <input
                    type="email"
                    value={user.email}
                    onChange={handleChange('email')}
                    className={styles.input}
                    required
                  />
                </div> */}
              </div>
            </div>

            {/* Account Details */}
            <div className={styles.formSection}>
              <h3 className={styles.sectionTitle}>Account Details</h3>
              <div className={styles.grid}>
                <div className={styles.field}>
                  <label className={styles.label}>Status</label>
                  <select
                    value={user.status}
                    onChange={handleChange('status')}
                    className={styles.input}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Plan</label>
                  <select
                    value={user.plan}
                    onChange={handleChange('plan')}
                    className={styles.input}
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Profile & Personal Info */}
            <div className={styles.formSection}>
              <h3 className={styles.sectionTitle}>Profile &amp; Personal Information</h3>
              <div className={styles.grid}>
                <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                  <label className={styles.label}>Bio</label>
                  <textarea
                    value={user.bio || ''}
                    onChange={handleChange('bio')}
                    className={styles.input}
                    rows={3}
                    placeholder="Short bio or about text"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Location</label>
                  <input
                    type="text"
                    value={user.location || ''}
                    onChange={handleChange('location')}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Date of Birth</label>
                  <input
                    type="text"
                    value={user.dob || ''}
                    onChange={handleChange('dob')}
                    className={styles.input}
                    placeholder="YYYY-MM-DD"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Gender</label>
                  <input
                    type="text"
                    value={user.gender || ''}
                    onChange={handleChange('gender')}
                    className={styles.input}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Occupation</label>
                  <input
                    type="text"
                    value={user.occupation || ''}
                    onChange={handleChange('occupation')}
                    className={styles.input}
                  />
                </div>
              </div>
            </div>

            {/* Account Status & Actions */}
            <div className={styles.formSection}>
              <h3 className={styles.sectionTitle}>Account Status &amp; Actions</h3>
              <p className={styles.sectionDesc}>
                Use the quick actions below to change this user&apos;s account status. These actions require
                confirmation.
              </p>
              <div className={s.accountActions}>
                {user.blocked ? (
                  <button
                    type="button"
                    className={`${s.actionBtn} ${s.activate}`}
                    onClick={() => setConfirm({ type: 'unblock' })}
                    disabled={acting}
                  >
                    <PlayCircle size={16} /> Unblock &amp; Activate
                  </button>
                ) : (
                  <>
                    {user.status === 'suspended' && (
                      <button
                        type="button"
                        className={`${s.actionBtn} ${s.activate}`}
                        onClick={() => setConfirm({ type: 'activate' })}
                        disabled={acting}
                      >
                        <CheckCircle size={16} /> Activate Account
                      </button>
                    )}
                    {user.status === 'active' && (
                      <button
                        type="button"
                        className={`${s.actionBtn} ${s.suspend}`}
                        onClick={() => setConfirm({ type: 'suspend' })}
                        disabled={acting}
                      >
                        <PauseCircle size={16} /> Suspend
                      </button>
                    )}
                    {!user.blocked && (
                      <button
                        type="button"
                        className={`${s.actionBtn} ${s.block}`}
                        onClick={() => setConfirm({ type: 'block' })}
                        disabled={acting}
                      >
                        <Ban size={16} /> Block
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className={styles.formActions}>
              <Link href="/admin/users" className={styles.cancelBtn}>Cancel</Link>
              <button type="submit" className={styles.submitBtn} disabled={saving}>
                {saving ? <Loader /> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          isOpen
          variant="danger"
          title={`${confirmLabel(confirm.type)} Account`}
          message={
            <>
              Are you sure you want to <strong>{confirmLabel(confirm.type).toLowerCase()}</strong>{' '}
              <strong>{user.name}</strong>? This action changes their account status and takes effect immediately.
            </>
          }
          confirmText={confirmLabel(confirm.type)}
          onConfirm={() => handleAccountAction(confirm.type)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </PermissionGate>
  );
}
