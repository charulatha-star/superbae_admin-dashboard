'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { createAdmin } from '../../../../lib/api/admins';
import { getRoles } from '../../../../lib/api/roles';
import { Role } from '../../../../types/role';
import { Loader } from '../../../../components/admin/Loader';
import { ArrowLeft } from 'lucide-react';
import styles from './page.module.css';

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  roleId: z.string().min(1, 'Role is required'),
  status: z.enum(['active', 'suspended', 'inactive']),
  twoFactorEnabled: z.boolean(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof schema>;

export default function CreateAdminPage() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: 'active',
      twoFactorEnabled: false,
    }
  });

  const selectedRoleId = watch('roleId');
  const selectedRole = roles.find(r => r.id === selectedRoleId);

  useEffect(() => {
    getRoles().then(setRoles).catch(console.error);
  }, []);

  const onSubmit = async (data: FormData) => {
    try {
      setLoading(true);
      setError('');
      const { confirmPassword, ...adminData } = data;
      await createAdmin(adminData);
      router.push('/admin/admins');
    } catch (err: any) {
      setError(err.message || 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin/admins" className={styles.backBtn}>
          <ArrowLeft size={16} /> Back to Admins
        </Link>
        <h1 className={styles.title}>Create Admin</h1>
        <p className={styles.subtitle}>Add a new administrator to the system.</p>
      </div>

      <div className={styles.content}>
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          {error && <div className={styles.errorAlert}>{error}</div>}

          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Basic Information</h3>

            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Full Name</label>
                <input
                  type="text"
                  {...register('name')}
                  className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                />
                {errors.name && <span className={styles.errorText}>{errors.name.message}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Email</label>
                <input
                  type="email"
                  {...register('email')}
                  className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                />
                {errors.email && <span className={styles.errorText}>{errors.email.message}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Password</label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('password')}
                    className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <span className={styles.errorText}>{errors.password.message}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Confirm Password</label>
                <div className={styles.passwordWrapper}>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    {...register('confirmPassword')}
                    className={`${styles.input} ${errors.confirmPassword ? styles.inputError : ''}`}
                  />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && <span className={styles.errorText}>{errors.confirmPassword.message}</span>}
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Role & Status</h3>

            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Role</label>
                <select
                  {...register('roleId')}
                  className={`${styles.input} ${errors.roleId ? styles.inputError : ''}`}
                >
                  <option value="">Select a role...</option>
                  {roles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                {errors.roleId && <span className={styles.errorText}>{errors.roleId.message}</span>}
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Status</label>
                <select
                  {...register('status')}
                  className={`${styles.input} ${errors.status ? styles.inputError : ''}`}
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
                {errors.status && <span className={styles.errorText}>{errors.status.message}</span>}
              </div>

              <div className={styles.checkboxField}>
                <label className={styles.checkboxLabel}>
                  <input type="checkbox" {...register('twoFactorEnabled')} className={styles.checkbox} />
                  Require Two-Factor Authentication
                </label>
              </div>
            </div>
          </div>

          {selectedRole && (
            <div className={styles.formSection}>
              <h3 className={styles.sectionTitle}>Assigned Permissions</h3>
              <p className={styles.sectionDesc}>This admin will inherit the following permissions from the <strong>{selectedRole.name}</strong> role.</p>

              <div className={styles.permissionsList}>
                {selectedRole.permissions.includes('*') ? (
                  <div className={styles.permissionBadgeAll}>* Full Access</div>
                ) : (
                  selectedRole.permissions.map(p => (
                    <div key={p} className={styles.permissionBadge}>{p}</div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className={styles.formActions}>
            <Link href="/admin/admins" className={styles.cancelBtn}>
              Cancel
            </Link>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <Loader /> : 'Create Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
