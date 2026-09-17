'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../../components/admin/Skeleton';
import { NoData } from '../../../../../components/admin/NoData/NoData';
import { ConfirmModal } from '../../../../../components/admin/ConfirmModal';
import { Search, Plus, Edit2, Trash2, Tag } from 'lucide-react';
import styles from '../../../users/page.module.css';

interface ConfigItem {
  id: string;
  name: string;
  status: string;
  [key: string]: any;
}

interface ConfigManagerProps {
  resourcePath: string;
  title: string;
  itemName: string;
}

export function ConfigManager({ resourcePath, title, itemName }: ConfigManagerProps) {
  const [items, setItems] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({ name: '', status: 'active' });
  const [itemToDelete, setItemToDelete] = useState<ConfigItem | null>(null);

  const fetchData = () => {
    setLoading(true);
    fetchApi<ConfigItem[]>(`/${resourcePath}`)
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [resourcePath]);

  const filtered = items.filter(i =>
    (i.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleOpenForm = (item?: ConfigItem) => {
    if (item) {
      setEditingItem(item);
      setFormData({ name: item.name || '', status: item.status || 'active' });
    } else {
      setEditingItem(null);
      setFormData({ name: '', status: 'active' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      setIsSubmitting(true);
      if (editingItem) {
        await fetchApi(`/${resourcePath}/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData)
        });
      } else {
        await fetchApi(`/${resourcePath}`, {
          method: 'POST',
          body: JSON.stringify(formData)
        });
      }
      setIsModalOpen(false);
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      setIsSubmitting(true);
      await fetchApi(`/${resourcePath}/${itemToDelete.id}`, { method: 'DELETE' });
      setIsDeleteModalOpen(false);
      setItemToDelete(null);
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container} style={{ padding: '0', background: 'transparent' }}>
      <div className={styles.toolbar} style={{ justifyContent: "space-between", marginTop: '0', marginBottom: "15px" }}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <button className={styles.primaryBtn} onClick={() => handleOpenForm()}>
          <Plus size={16} /> Add {itemName}
        </button>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title={`No ${title.toLowerCase()}`} description={`No ${title.toLowerCase()} configured yet.`} />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(item => (
                  <tr key={item.id}>
                    <td><strong>{item.name || 'Unnamed'}</strong></td>
                    <td>
                      <span className={`${styles.statusBadge} ${item.status === 'active' ? styles.active : styles.suspended}`}>
                        {item.status || 'active'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={() => handleOpenForm(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }} title={`Edit ${itemName}`}>
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => { setItemToDelete(item); setIsDeleteModalOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title={`Delete ${itemName}`}>
                          <Trash2 size={16} />
                        </button>
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

      {/* Edit/Create Form Modal - Inline Implementation */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '24px', borderRadius: '8px', width: '400px', maxWidth: '90%' }}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px', fontWeight: 600 }}>
              {editingItem ? `Edit ${itemName}` : `Add New ${itemName}`}
            </h3>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder={`${itemName} name`}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#374151' }}>Status</label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white' }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ padding: '8px 16px', background: 'white', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                disabled={isSubmitting || !formData.name.trim()}
              >
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title={`Delete ${itemName}`}
        message={<p>Are you sure you want to delete <strong>{itemToDelete?.name}</strong>? This action cannot be undone.</p>}
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        confirmText={isSubmitting ? 'Deleting...' : 'Delete'}
        variant="danger"
      />
    </div>
  );
}
