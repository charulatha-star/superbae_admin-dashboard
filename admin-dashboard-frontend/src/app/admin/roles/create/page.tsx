'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { createRole, getPermissions } from '../../../../lib/api/roles';
import { Permission } from '../../../../types/role';
import { Loader } from '../../../../components/admin/Loader';
import { ArrowLeft } from 'lucide-react';
import styles from '../../admins/create/page.module.css'; // Reuse form styles

const schema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().min(5, 'Description is required'),
});

type FormData = z.infer<typeof schema>;

export default function CreateRolePage() {
  const router = useRouter();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    getPermissions().then(setPermissions).catch(console.error);
  }, []);

  const togglePermission = (permId: string) => {
    setSelectedPermissions(prev => 
      prev.includes(permId) 
        ? prev.filter(p => p !== permId) 
        : [...prev, permId]
    );
  };

  const onSubmit = async (data: FormData) => {
    if (selectedPermissions.length === 0) {
      setError('Please select at least one permission.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      await createRole({
        ...data,
        permissions: selectedPermissions,
      });
      
      router.push('/admin/roles');
    } catch (err: any) {
      setError(err.message || 'Failed to create role');
    } finally {
      setLoading(false);
    }
  };

  // Group permissions by module
  const groupedPermissions = permissions.reduce((acc, curr) => {
    if (!acc[curr.module]) {
      acc[curr.module] = [];
    }
    acc[curr.module].push(curr);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin/roles" className={styles.backBtn}>
          <ArrowLeft size={16} /> Back to Roles
        </Link>
        <h1 className={styles.title}>Create Role</h1>
        <p className={styles.subtitle}>Define a new role and its permissions.</p>
      </div>

      <div className={styles.content}>
        <form onSubmit={handleSubmit(onSubmit)} className={styles.form}>
          {error && <div className={styles.errorAlert}>{error}</div>}

          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Role Details</h3>
            
            <div className={styles.grid}>
              <div className={styles.field}>
                <label className={styles.label}>Role Name</label>
                <input
                  type="text"
                  {...register('name')}
                  className={`${styles.input} ${errors.name ? styles.inputError : ''}`}
                />
                {errors.name && <span className={styles.errorText}>{errors.name.message}</span>}
              </div>

              <div className={styles.field} style={{ gridColumn: '1 / -1' }}>
                <label className={styles.label}>Description</label>
                <textarea
                  {...register('description')}
                  className={`${styles.input} ${errors.description ? styles.inputError : ''}`}
                  rows={3}
                />
                {errors.description && <span className={styles.errorText}>{errors.description.message}</span>}
              </div>
            </div>
          </div>

          <div className={styles.formSection}>
            <h3 className={styles.sectionTitle}>Permissions</h3>
            <p className={styles.sectionDesc}>Select the actions this role is allowed to perform.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginTop: '16px' }}>
              {Object.entries(groupedPermissions).map(([moduleName, perms]) => (
                <div key={moduleName} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#f9fafb', padding: '12px 16px', fontWeight: 600, borderBottom: '1px solid #e5e7eb' }}>
                    {moduleName.toUpperCase()}
                  </div>
                  <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                    {perms.map(p => (
                      <label key={p.id} className={styles.checkboxLabel} style={{ minWidth: '150px' }}>
                        <input 
                          type="checkbox" 
                          className={styles.checkbox}
                          checked={selectedPermissions.includes(p.id)}
                          onChange={() => togglePermission(p.id)}
                        />
                        {p.action}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.formActions}>
            <Link href="/admin/roles" className={styles.cancelBtn}>
              Cancel
            </Link>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? <Loader /> : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
