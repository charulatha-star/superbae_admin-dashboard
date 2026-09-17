'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { fetchApi } from '../../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../../components/admin/Skeleton';
import { NoData } from '../../../../../components/admin/NoData/NoData';
import styles from '../../../users/page.module.css';
import local from '../anonymous.module.css';

interface Audit { id: string; adminName?: string; action?: string; description?: string; reason?: string; createdAt?: string; }
interface HistoryResponse { data: Audit[]; total: number; page: number; limit: number; pages: number; }

export default function AnonymousModerationHistoryPage() {
  const [response, setResponse] = useState<HistoryResponse>({ data: [], total: 0, page: 1, limit: 25, pages: 1 });
  const [action, setAction] = useState('all');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  useEffect(() => { setLoading(true); fetchApi<HistoryResponse>(`/anonymousModerationHistory?page=${page}&limit=25`, {}, true).then(setResponse).catch(console.error).finally(() => setLoading(false)); }, [page]);
  const filtered = response.data.filter((log) => (action === 'all' || log.action === action) && (!date || (log.createdAt || '').slice(0, 10) === date));
  return <div className={styles.container}><div className={styles.header}><div><Link href="/admin/community/anonymous" className={local.back}><ArrowLeft size={16} /> Back to queue</Link><h1 className={styles.title}>Anonymous Moderation History</h1><p className={styles.subtitle}>Audit trail for actions taken on anonymous posts.</p></div></div><div className={local.historyFilters}><select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}><option value="all">All actions</option>{['hide', 'remove', 'warn', 'suspend', 'ban', 'restore'].map((item) => <option key={item} value={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><div className={styles.tableContainer}>{loading ? <AdminTableSkeleton /> : filtered.length === 0 ? <NoData title="No moderation history" description="No matching anonymous-post actions were found." /> : <table className={styles.table}><thead><tr><th>Action</th><th>Admin</th><th>Description</th><th>Reason</th><th>Timestamp</th></tr></thead><tbody>{filtered.map((log) => <tr key={log.id}><td>{log.action || '—'}</td><td>{log.adminName || '—'}</td><td>{log.description || '—'}</td><td>{log.reason || '—'}</td><td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</td></tr>)}</tbody></table>}{response.pages > 1 && <div className={styles.pagination}><button className={styles.paginationBtn} onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1}>← Previous</button><span className={styles.paginationText}>Page {response.page} of {response.pages}</span><button className={styles.paginationBtn} onClick={() => setPage((value) => Math.min(response.pages, value + 1))} disabled={page === response.pages}>Next →</button></div>}</div></div>;
}