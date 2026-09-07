'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { getAdmin, updateAdmin } from '../../../../lib/api/admins';
import { getRoles, getPermissions } from '../../../../lib/api/roles';
import { Admin } from '../../../../types/admin';
import { Role, Permission } from '../../../../types/role';
import { Loader } from '../../../../components/admin/Loader';
import styles from '../create/page.module.css';

export default function EditAdminPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [admin, setAdmin] = useState<Admin | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    roleId: '',
    status: 'active' as 'active' | 'suspended' | 'inactive',
    twoFactorEnabled: false,
    password: '',
    confirmPassword: '',
    permissions: [] as string[],
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [adminData, rolesData, permsData] = await Promise.all([
          getAdmin(id),
          getRoles(),
          getPermissions(),
        ]);
        setAdmin(adminData);
        setRoles(rolesData);
        setPermissions(permsData);

        const rolePerms = rolesData.find(r => r.id === adminData.roleId)?.permissions || [];
        setForm({
          name: adminData.name || '',
          email: adminData.email || '',
          roleId: adminData.roleId || '',
          status: (adminData.status as any) || 'active',
          twoFactorEnabled: adminData.twoFactorEnabled || false,
          password: '',
          confirmPassword: '',
          permissions: (adminData as any).permissions || rolePerms,
        });
      } catch (err) {
        setError('Failed to load admin data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const selectedRole = roles.find(r => r.id === form.roleId);

  const handleRoleChange = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    setForm(f => ({
      ...f,
      roleId,
      permissions: role?.permissions || [],
    }));
  };

  const togglePermission = (permId: string) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(permId)
        ? f.permissions.filter(p => p !== permId)
        : [...f.permissions, permId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password && form.password !== form.confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    try {
      setSaving(true);
      setError('');
      const updateData: Partial<Admin> = {
        name: form.name,
        email: form.email,
        roleId: form.roleId,
        status: form.status,
        twoFactorEnabled: form.twoFactorEnabled,
        ...(form.permissions.length > 0 && { permissions: form.permissions } as any),
        ...(form.password && { password: form.password }),
      };
      await updateAdmin(id, updateData);
      router.push('/admin/admins');
    } catch (err: any) {
      setError(err.message || 'Failed to update admin');
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
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

  if (!admin) {
    return (
      <div className={styles.container}>
        <div className={styles.errorAlert}>Admin not found.</div>
        <Link href="/admin/admins" className={styles.backBtn}><ArrowLeft size={16} /> Back</Link>
      </div>
    );
  }

  const isFullAccess = selectedRole?.permissions.includes('*');

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin/admins" className={styles.backBtn}>
          <ArrowLeft size={16} /> Back to Admins
        </Link>
        <h1 className={styles.title}>Edit Admin</h1>
        <p className={styles.subtitle}>Update administrator account details.</p>
      </div>

      <div className={styles.content}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.errorAlert}>{error}</div>}

          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Basic Information</h3>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className={styles.input}
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label}>New Password <span style={{ color: '#9ca3af', fontWeight: 400 }}>(leave blank to keep current)</span></label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className={styles.input}
                    placeholder="Enter new password"
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Confirm New Password</label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    className={styles.input}
                    placeholder="Confirm new password"
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Role & Status</h3>
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Role</label>
                <select
                  value={form.roleId}
                  onChange={e => handleRoleChange(e.target.value)}
                  className={styles.input}
                  required
                >
                  <option value="">Select a role...</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}
                  className={styles.input}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className={styles.checkboxField}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={form.twoFactorEnabled}
                    onChange={e => setForm(f => ({ ...f, twoFactorEnabled: e.target.checked }))}
                    className={styles.checkbox}
                  />
                  Require Two-Factor Authentication
                </label>
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Assigned Permissions</h3>
            <p className={styles.sectionDesc}>
              {isFullAccess
                ? 'This role has full access to all permissions.'
                : 'Select individual permissions for this admin. Defaults are inherited from the selected role.'}
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
                            checked={form.permissions.includes(p.id)}
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
            <Link href="/admin/admins" className={styles.cancelBtn}>Cancel</Link>
            <button type="submit" className={styles.submitBtn} disabled={saving}>
              {saving ? <Loader /> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
