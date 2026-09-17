'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getRole, updateRole, getPermissions } from '../../../../lib/api/roles';
import { Role, Permission } from '../../../../types/role';
import { Loader } from '../../../../components/admin/Loader';
import styles from '../../admins/create/page.module.css';

export default function EditRolePage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    selectedPermissions: [] as string[],
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [roleData, permsData] = await Promise.all([getRole(id), getPermissions()]);
        setRole(roleData);
        setPermissions(permsData);
        setForm({
          name: roleData.name,
          description: roleData.description || '',
          selectedPermissions: roleData.permissions.includes('*') ? [] : roleData.permissions,
        });
      } catch {
        setError('Failed to load role data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const togglePermission = (permId: string) => {
    setForm(f => ({
      ...f,
      selectedPermissions: f.selectedPermissions.includes(permId)
        ? f.selectedPermissions.filter(p => p !== permId)
        : [...f.selectedPermissions, permId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.selectedPermissions.length === 0 && !role?.permissions.includes('*')) {
      setError('Please select at least one permission.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await updateRole(id, {
        name: form.name,
        description: form.description,
        permissions: role?.permissions.includes('*') ? ['*'] : form.selectedPermissions,
      });
      router.push('/admin/roles');
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const groupedPermissions = permissions.reduce((acc, curr) => {
    if (!acc[curr.module]) acc[curr.module] = [];
    acc[curr.module].push(curr);
    return acc;
  }, {} as Record<string, Permission[]>);

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <Loader />
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className={styles.container}>
        <div className={styles.errorAlert}>Role not found.</div>
        <Link href="/admin/roles" className={styles.backBtn}><ArrowLeft size={16} /> Back</Link>
      </div>
    );
  }

  const isFullAccess = role.permissions.includes('*');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin/roles" className={styles.backBtn}>
          <ArrowLeft size={16} /> Back to Roles
        </Link>
        <h1 className={styles.title}>Edit Role</h1>
        <p className={styles.subtitle}>Update role details and permissions.</p>
      </div>

      <div className={styles.content}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorAlert}>{error}</div>}

          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Role Details</h3>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Role Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={styles.input}
                  required
                  disabled={role.system}
                />
              </div>
              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className={styles.input}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Permissions</h3>
            <p className={styles.sectionDesc}>
              {isFullAccess
                ? 'This is a system role with full access — permissions cannot be changed.'
                : 'Select the actions this role is allowed to perform.'}
            </p>

            {isFullAccess ? (
              <div className={styles.permissionsList}>
                <div className={styles.permissionBadgeAll}>* Full Access</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
                {Object.entries(groupedPermissions).map(([moduleName, perms]) => (
                  <div key={moduleName} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ backgroundColor: '#f9fafb', padding: '10px 16px', fontWeight: 600, borderBottom: '1px solid #e5e7eb', fontSize: '0.85rem', letterSpacing: '0.05em', color: '#374151' }}>
                      {moduleName.toUpperCase()}
                    </div>
                    <div style={{ padding: '12px 16px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      {perms.map(p => (
                        <label key={p.id} className={styles.checkboxLabel} style={{ minWidth: '160px' }}>
                          <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={form.selectedPermissions.includes(p.id)}
                            onChange={() => togglePermission(p.id)}
                          />
                          {p.action}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.formActions}>
            <Link href="/admin/roles" className={styles.cancelBtn}>Cancel</Link>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? <Loader /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
