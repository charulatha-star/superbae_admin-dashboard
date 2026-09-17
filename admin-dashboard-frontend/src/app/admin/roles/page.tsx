'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getRoles, deleteRole } from '../../../lib/api/roles';
import { getAdmins } from '../../../lib/api/admins';
import { Role } from '../../../types/role';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { PermissionGate } from '../../../components/admin/PermissionGate';
import { ConfirmModal } from '../../../components/admin/ConfirmModal';
import { Toast } from '../../../components/admin/Toast';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import styles from '../admins/page.module.css'; // Reuse table styles

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [adminCounts, setAdminCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rolesData, adminsData] = await Promise.all([
        getRoles(),
        getAdmins()
      ]);
      setRoles(rolesData);

      const counts: Record<string, number> = {};
      adminsData.forEach(a => {
        counts[a.roleId] = (counts[a.roleId] || 0) + 1;
      });
      setAdminCounts(counts);
    } catch (error) {
      console.error('Error fetching roles', error);
      setToast({ message: 'Failed to load roles', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    // Check if role is assigned
    // if (adminCounts[deleteId] > 0) {
    //   setToast({ message: 'Cannot delete role with assigned admins', type: 'warning' });
    //   setDeleteId(null);
    //   return;
    // }

    try {
      await deleteRole(deleteId);
      setRoles(roles.filter(r => r.id !== deleteId));
      setToast({ message: 'Role deleted successfully', type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to delete role', type: 'error' });
    } finally {
      setDeleteId(null);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(roles.length / itemsPerPage);
  const paginatedData = roles.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Role"
        message="Are you sure you want to delete this role? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        variant="danger"
        confirmText="Delete"
      />

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Roles & Permissions</h1>
          <p className={styles.subtitle}>Manage access control and define permissions.</p>
        </div>
        <PermissionGate permission="roles.create">
          <Link href="/admin/roles/create" className={styles.createBtn}>
            <Plus size={16} /> Create Role
          </Link>
        </PermissionGate>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loadingWrapper}><AdminTableSkeleton /></div>
        ) : roles.length === 0 ? (
          <NoData
            title="No roles found"
            description="Get started by creating a new role."
          />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>Admins</th>
                  <th>Permissions</th>
                  <th className={styles.actionsHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(role => (
                  <tr key={role.id}>
                    <td className={styles.nameCell}>
                      {role.name}
                      {role.system && <span className={styles.roleBadge} style={{ backgroundColor: '#fef08a', color: '#854d0e', marginLeft: '8px' }}>System</span>}
                    </td>
                    <td>{adminCounts[role.id] || 0} users</td>
                    <td>
                      {role.permissions.includes('*')
                        ? 'Full Access'
                        : `${role.permissions.length} permissions`}
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actionButtons}>
                        <PermissionGate permission="roles.edit">
                          <Link href={`/admin/roles/${role.id}`} className={styles.iconBtn} title="Edit">
                            <Edit2 size={16} />
                          </Link>
                        </PermissionGate>
                        <PermissionGate permission="roles.delete">
                          <button
                            className={`${styles.iconBtn} ${styles.danger}`}
                            onClick={() => setDeleteId(role.id)}
                            title="Delete"
                          // disabled={role.system}
                          // style={{ opacity: role.system ? 0.5 : 1, cursor: role.system ? 'not-allowed' : 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div className={styles.pagination}>
                <button className={styles.paginationBtn} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>← Previous</button>
                <span className={styles.paginationText}>Page {currentPage} of {totalPages}</span>
                <button className={styles.paginationBtn} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
