'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ShieldAlert, Trash2, EyeOff, Eye, AlertTriangle, Ban, MessageCircleWarning } from 'lucide-react';
import { fetchApi } from '../../../../../../lib/api/api';
import { ConfirmModal } from '../../../../../../components/admin/ConfirmModal';
import { Loader } from '../../../../../../components/admin/Loader';
import styles from '../../../../users/page.module.css';
import local from '../../anonymous.module.css';

type Action = 'hide' | 'remove' | 'warn' | 'suspend' | 'ban' | 'restore';
interface Post { id: string; content: string; status: string; reportCount?: number; riskScore?: number; realAuthorId?: string; createdAt: string; updatedAt?: string; }
interface Report { id: string; reporter?: string; reason?: string; description?: string; severity?: string; status?: string; createdAt?: string; }
interface Flag { id: string; content?: string; reason?: string; status?: string; riskScore?: number; createdAt?: string; }
interface Audit { id: string; adminName?: string; action?: string; description?: string; reason?: string; createdAt?: string; }
interface Detail { post: Post; reports: Report[]; aiFlags: Flag[]; authorAbuseSummary: { userId: string; strikeCount: number; status: string } | null; moderationLog: Audit[]; }

const actions: { id: Action; label: string; tone: string; icon: typeof EyeOff }[] = [
  { id: 'hide', label: 'Hide', tone: local.warning, icon: EyeOff },
  { id: 'remove', label: 'Remove', tone: local.danger, icon: Trash2 },
  { id: 'warn', label: 'Warn', tone: local.warning, icon: MessageCircleWarning },
  { id: 'suspend', label: 'Suspend', tone: local.neutral, icon: ShieldAlert },
  { id: 'ban', label: 'Ban', tone: local.danger, icon: Ban },
  { id: 'restore', label: 'Restore', tone: local.success, icon: Eye },
];

export default function AnonymousPostDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Action | null>(null);
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    fetchApi<Detail>(`/anonymousPosts/${postId}`).then(setDetail).catch((e) => setError(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, [postId]);

  const confirmAction = async () => {
    if (!selected) return;
    if (['remove', 'suspend', 'ban'].includes(selected) && !reason.trim()) { setError('A reason is required for this action.'); return; }
    if (['remove', 'ban'].includes(selected) && typed !== selected.toUpperCase()) { setError(`Type ${selected.toUpperCase()} to confirm.`); return; }
    try {
      await fetchApi(`/anonymousPosts/${postId}/action`, { method: 'POST', body: JSON.stringify({ action: selected, reason: reason.trim() || undefined }) });
      setSelected(null); setReason(''); setTyped(''); setError(''); load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); }
  };

  if (loading && !detail) return <div className={styles.container}><Loader /></div>;
  if (!detail) return <div className={styles.container}><div className={styles.errorAlert}>{error || 'Post not found.'}</div></div>;
  const selectedLabel = selected ? actions.find((item) => item.id === selected)?.label : '';
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin/community/anonymous" className={local.back}><ArrowLeft size={16} /> Back to anonymous queue</Link>
        <h1 className={styles.title}>Anonymous Post Review</h1>
        <p className={styles.subtitle}>Review content, safety signals, and moderation history.</p>
      </div>
      <div className={local.summaryCard}>
        <div className={local.summaryContent}>
          <strong>Post {detail.post.id}</strong>
          <p className={local.preview}>{detail.post.content}</p>
          <div className={local.meta}><span>Status: {detail.post.status}</span><span>Reports: {detail.post.reportCount || 0}</span><span>Risk: {detail.post.riskScore ?? '—'}</span><span>{new Date(detail.post.createdAt).toLocaleString()}</span></div>
        </div>
        <div className={local.actions}>{actions.map(({ id, label, tone, icon: Icon }) => <button key={id} type="button" className={`${local.actionBtn} ${tone}`} onClick={() => { setSelected(id); setError(''); }}><Icon size={15} /> {label}</button>)}</div>
      </div>
      {error && <div className={styles.errorAlert}>{error}</div>}
      <div className={local.tabs} role="tablist">{['overview', 'reports', 'aiFlags', 'authorHistory'].map((item) => <button key={item} type="button" className={`${local.tab} ${tab === item ? local.tabActive : ''}`} onClick={() => setTab(item)}>{item === 'aiFlags' ? 'AI Flags' : item === 'authorHistory' ? 'Author History' : item[0].toUpperCase() + item.slice(1)}</button>)}</div>
      {tab === 'overview' && <section className={local.section}><h2 className={styles.sectionTitle}>Full Content</h2><p className={local.content}>{detail.post.content}</p></section>}
      {tab === 'reports' && <section className={local.section}><h2 className={styles.sectionTitle}>Reports ({detail.reports.length})</h2>{detail.reports.length === 0 ? <p className={local.empty}>No reports linked to this post.</p> : <table className={local.table}><thead><tr><th>Reporter</th><th>Reason</th><th>Severity</th><th>Status</th><th>Date</th></tr></thead><tbody>{detail.reports.map((report) => <tr key={report.id}><td>{report.reporter || '—'}</td><td>{report.reason || report.description || '—'}</td><td>{report.severity || '—'}</td><td>{report.status || '—'}</td><td>{report.createdAt ? new Date(report.createdAt).toLocaleString() : '—'}</td></tr>)}</tbody></table>}</section>}
      {tab === 'aiFlags' && <section className={local.section}><h2 className={styles.sectionTitle}>AI Flags ({detail.aiFlags.length})</h2>{detail.aiFlags.length === 0 ? <p className={local.empty}>No AI flags linked to this post.</p> : <table className={local.table}><thead><tr><th>Flag</th><th>Reason</th><th>Risk</th><th>Status</th></tr></thead><tbody>{detail.aiFlags.map((flag) => <tr key={flag.id}><td>{flag.content || '—'}</td><td>{flag.reason || '—'}</td><td>{flag.riskScore ?? '—'}</td><td>{flag.status || '—'}</td></tr>)}</tbody></table>}</section>}
      {tab === 'authorHistory' && <section className={local.section}><h2 className={styles.sectionTitle}>Author History</h2><div className={local.statGrid}><div className={local.stat}><div className={local.statLabel}>Real author ID</div><div className={local.statValue}>{detail.authorAbuseSummary?.userId || detail.post.realAuthorId || 'Unknown'}</div></div><div className={local.stat}><div className={local.statLabel}>Strikes</div><div className={local.statValue}>{detail.authorAbuseSummary?.strikeCount ?? 0}</div></div><div className={local.stat}><div className={local.statLabel}>Account status</div><div className={local.statValue}>{detail.authorAbuseSummary?.status || 'Unknown'}</div></div></div><h3 className={styles.sectionTitle}>Moderation Log</h3>{detail.moderationLog.length === 0 ? <p className={local.empty}>No moderation actions recorded.</p> : <table className={local.table}><thead><tr><th>Action</th><th>Admin</th><th>Reason</th><th>Date</th></tr></thead><tbody>{detail.moderationLog.map((log) => <tr key={log.id}><td>{log.action}</td><td>{log.adminName || '—'}</td><td>{log.reason || log.description || '—'}</td><td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</td></tr>)}</tbody></table>}</section>}
      <ConfirmModal isOpen={!!selected} title={`${selectedLabel} Post`} variant={selected === 'remove' || selected === 'ban' ? 'danger' : 'primary'} message={<div>{selected === 'remove' || selected === 'ban' ? <p className={local.typedHint}>This is a destructive action. Type <strong>{selected?.toUpperCase()}</strong> to continue.</p> : null}<input className={local.typedInput} placeholder={selected === 'remove' || selected === 'ban' ? `Type ${selected?.toUpperCase()}` : 'Confirmation text'} value={typed} onChange={(e) => setTyped(e.target.value)} /> <textarea className={local.reasonInput} placeholder={['remove', 'suspend', 'ban'].includes(selected || '') ? 'Reason (required)' : 'Reason (optional)'} value={reason} onChange={(e) => setReason(e.target.value)} /></div>} confirmText={selectedLabel || 'Confirm'} onConfirm={confirmAction} onCancel={() => { setSelected(null); setReason(''); setTyped(''); }} />
    </div>
  );
}