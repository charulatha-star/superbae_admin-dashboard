'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getAdmins, deleteAdmin } from '../../../lib/api/admins';
import { getRoles } from '../../../lib/api/roles';
import { Admin } from '../../../types/admin';
import { Role } from '../../../types/role';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { PermissionGate } from '../../../components/admin/PermissionGate';
import { ConfirmModal } from '../../../components/admin/ConfirmModal';
import { Toast } from '../../../components/admin/Toast';
import { Plus, Edit2, Trash2, MoreVertical } from 'lucide-react';
import styles from './page.module.css';

export default function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [adminsData, rolesData] = await Promise.all([
        getAdmins(),
        getRoles()
      ]);
      setAdmins(adminsData);
      setRoles(rolesData);
    } catch (error) {
      console.error('Error fetching admins', error);
      setToast({ message: 'Failed to load admins', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const getRoleName = (roleId: string) => {
    return roles.find(r => r.id === roleId)?.name || roleId;
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAdmin(deleteId);
      setAdmins(admins.filter(a => a.id !== deleteId));
      setToast({ message: 'Admin deleted successfully', type: 'success' });
    } catch (error) {
      setToast({ message: 'Failed to delete admin', type: 'error' });
    } finally {
      setDeleteId(null);
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(admins.length / itemsPerPage);
  const paginatedData = admins.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

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
        title="Delete Admin"
        message="Are you sure you want to delete this admin? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        variant="danger"
        confirmText="Delete"
      />

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Users</h1>
          <p className={styles.subtitle}>Manage administrator accounts and their roles.</p>
        </div>
        <PermissionGate permission="admins.create">
          <Link href="/admin/admins/create" className={styles.createBtn}>
            <Plus size={16} /> Create Admin
          </Link>
        </PermissionGate>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <div className={styles.loadingWrapper}><AdminTableSkeleton /></div>
        ) : admins.length === 0 ? (
          <NoData
            title="No admins found"
            description="Get started by creating a new admin user."
          />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>2FA</th>
                  <th className={styles.actionsHeader}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(admin => (
                  <tr key={admin.id}>
                    <td className={styles.nameCell}>
                      <div className={styles.avatar} style={{ overflow: 'hidden', flexShrink: 0 }}>
                        {admin.avatar ? (
                          <img
                            src={admin.avatar}
                            alt={admin.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                          />
                        ) : (
                          admin.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      {admin.name}
                    </td>
                    <td>{admin.email}</td>
                    <td>
                      <span className={styles.roleBadge}>
                        {getRoleName(admin.roleId)}
                      </span>
                    </td>
                    <td>
                      <span className={`${styles.statusBadge} ${styles[admin.status]}`}>
                        {admin.status}
                      </span>
                    </td>
                    <td>
                      {admin.twoFactorEnabled ? 
                        <span className={styles.enabledBadge}>Enabled</span> : 
                        <span className={styles.disabledBadge}>Disabled</span>
                      }
                    </td>
                    <td className={styles.actionsCell}>
                      <div className={styles.actionButtons}>
                        <PermissionGate permission="admins.edit">
                          <Link href={`/admin/admins/${admin.id}`} className={styles.iconBtn} title="Edit">
                            <Edit2 size={16} />
                          </Link>
                        </PermissionGate>
                        <PermissionGate permission="admins.delete">
                          <button 
                            className={`${styles.iconBtn} ${styles.danger}`} 
                            onClick={() => setDeleteId(admin.id)}
                            title="Delete"
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
