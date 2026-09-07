'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { MapPin, Search } from 'lucide-react';
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

  useEffect(() => { setCurrentPage(1); }, [search]);

  useEffect(() => {
    fetchApi<Trip[]>('/trips').then(setTrips).catch(console.error).finally(() => setLoading(false));
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Trips</h1>
          <p className={styles.subtitle}>Manage and monitor all platform trips.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        {[
          { label: 'Total Trips', value: trips.length, color: '#2563eb' },
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

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search trips..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
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
