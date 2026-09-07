'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../lib/api/api';
import { AdminTableSkeleton } from '../../../components/admin/Skeleton';
import { NoData } from '../../../components/admin/NoData/NoData';
import { MessageSquare, Search } from 'lucide-react';
import styles from '../users/page.module.css';

interface SupportTicket {
  id: string;
  ticketId: string;
  user: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { setCurrentPage(1); }, [search]);

  useEffect(() => {
    fetchApi<SupportTicket[]>('/support').then(setTickets).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = tickets.filter(t => {
    const matchSearch = t.user.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.ticketId.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || t.status === filter;
    return matchSearch && matchFilter;
  });

  const priorityClass: Record<string, string> = { high: 'suspended', medium: 'premium', low: 'free' };
  const statusClass: Record<string, string> = { open: 'active', 'in-progress': 'premium', resolved: 'inactive' };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Support Tickets</h1>
          <p className={styles.subtitle}>Manage and respond to user support requests.</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        {[
          { label: 'Total Tickets', value: tickets.length, color: '#2563eb' },
          { label: 'Open', value: tickets.filter(t => t.status === 'open').length, color: '#dc2626' },
          { label: 'In Progress', value: tickets.filter(t => t.status === 'in-progress').length, color: '#d97706' },
          { label: 'Resolved', value: tickets.filter(t => t.status === 'resolved').length, color: '#16a34a' },
        ].map(stat => (
          <div key={stat.label} className={styles.statCard}>
            <MessageSquare size={20} className={styles.statIcon} style={{ color: stat.color }} />
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
          <input type="text" placeholder="Search tickets..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className={styles.filterSelect}>
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No support tickets" description="No support tickets are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>User</th>
                <th>Subject</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(ticket => (
                <tr key={ticket.id}>
                  <td><code>{ticket.ticketId}</code></td>
                  <td>{ticket.user}</td>
                  <td>{ticket.subject}</td>
                  <td><span className={`${styles.badge} ${styles[priorityClass[ticket.priority] || 'free']}`}>{ticket.priority}</span></td>
                  <td><span className={`${styles.badge} ${styles[statusClass[ticket.status] || 'inactive']}`}>{ticket.status}</span></td>
                  <td>{new Date(ticket.createdAt).toLocaleDateString()}</td>
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
