'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { ConfirmModal } from '../../../components/admin/ConfirmModal';
import { MapPin, Search, Edit, Trash2, Plus, Edit2 } from 'lucide-react';
import styles from '../users/page.module.css';

interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  organizer: string;
  participants: number;
  status: string;
  price: number;
}

export default function TripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchApi<Trip[]>('/trips')
      .then(setTrips)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = trips.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.destination.toLowerCase().includes(search.toLowerCase())
  );

  const statusClass: Record<string, string> = {
    open: 'active',
    full: 'premium',
    cancelled: 'suspended',
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      setIsDeleting(true);
      await fetchApi(`/trips/${deleteId}`, { method: 'DELETE' });
      setTrips(prev => prev.filter(t => t.id !== deleteId));
      setDeleteId(null);
    } catch (e) {
      console.error(e);
      alert('Failed to delete trip');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Trips</h1>
          <p className={styles.subtitle}>Manage and monitor all platform trips.</p>
        </div>

      </div>

      <div className={styles.statsRow}>
        {[{ label: 'Total Trips', value: trips.length, color: '#2563eb' },
        { label: 'Open', value: trips.filter(t => t.status === 'open').length, color: '#16a34a' },
        { label: 'Full', value: trips.filter(t => t.status === 'full').length, color: '#d97706' },
        { label: 'Cancelled', value: trips.filter(t => t.status === 'cancelled').length, color: '#dc2626' },
        ].map(stat => (
          <div key={stat.label} className={styles.statCard}>
            <MapPin size={20} className={styles.statIcon} style={{ color: stat.color }} />
            <div>
              <div className={styles.statValue} style={{ color: stat.color }}>{stat.value}</div>
              <div className={styles.statLabel}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.toolbar} style={{ justifyContent: "space-between" }}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search trips..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <Link href="/admin/trips/create" className={styles.primaryBtn}>
          <Plus size={16} /> Create Trip
        </Link>
      </div>

      <div className={styles.tableContainer}>
        {loading ? (
          <AdminTableSkeleton />
        ) : paginatedData.length === 0 ? (
          <NoData title="No trips" description="No trips are available to display." />
        ) : (
          <>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Trip</th>
                  <th>Destination</th>
                  <th>Organizer</th>
                  <th>Dates</th>
                  <th>Participants</th>
                  <th>Price (USD)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map(trip => (
                  <tr key={trip.id}>
                    <td><strong>{trip.title}</strong></td>
                    <td>{trip.destination}</td>
                    <td>{trip.organizer}</td>
                    <td>{trip.startDate} → {trip.endDate}</td>
                    <td>{trip.participants}</td>
                    <td>${trip.price.toLocaleString()}</td>
                    <td><span className={`${styles.badge} ${styles[statusClass[trip.status] || 'inactive']}`}>{trip.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <Link href={`/admin/trips/${trip.id}/edit`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }} title="Edit Trip">
                          <Edit2 size={16} />
                        </Link>
                        <button onClick={() => setDeleteId(trip.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }} title="Delete Trip">
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

      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Trip"
        message="Are you sure you want to delete this trip? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
        confirmText={isDeleting ? 'Deleting...' : 'Delete'}
        variant="danger"
      />
    </div>
  );
}
