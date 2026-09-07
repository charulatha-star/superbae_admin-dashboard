'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users, MessageSquare, Heart, FileText, Flag, Ghost, ShieldAlert, Ban,
} from 'lucide-react';
import { fetchApi } from '../../../lib/api/api';
import styles from './page.module.css';

const sections = [
  { href: '/admin/community/posts', icon: FileText, label: 'All Posts', desc: 'Browse and manage every community post', color: '#e83e8c' },
  { href: '/admin/community/comments', icon: MessageSquare, label: 'Comments', desc: 'Review and moderate post comments', color: '#2563eb' },
  { href: '/admin/community/reported/posts', icon: Flag, label: 'Reported Posts', desc: 'Handle posts reported by users', color: '#dc2626' },
  { href: '/admin/community/reported/comments', icon: Heart, label: 'Reported Comments', desc: 'Handle comments reported by users', color: '#f97316' },
  // { href: '/admin/community/anonymous', icon: Ghost, label: 'Anonymous Posts', desc: 'Moderate the anonymous forum', color: '#7c3aed' },
  // { href: '/admin/groups', icon: Users, label: 'Groups', desc: 'Manage community groups and members', color: '#0ea5e9' },
  { href: '/admin/community/moderation', icon: ShieldAlert, label: 'Moderation Queue', desc: 'Review flagged content awaiting action', color: '#d97706' },
  { href: '/admin/community/blocked', icon: Ban, label: 'Blocked Users', desc: 'Manage users blocked from the community', color: '#64748b' },
];

interface Counters {
  posts: number;
  comments: number;
  reportedPosts: number;
  reportedComments: number;
  anonymous: number;
  groups: number;
  pending: number;
  blocked: number;
}

export default function CommunityPage() {
  const [stats, setStats] = useState<Counters | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const count = <T,>(p: Promise<T[]>, f: (arr: T[]) => number) =>
      p.then(f).catch(() => 0);

    Promise.all([
      count(fetchApi<unknown[]>('/posts'), (a) => a.length),
      count(fetchApi<unknown[]>('/comments'), (a) => a.length),
      count(fetchApi<Record<string, unknown>[]>('/reportedPosts'), (a) => a.filter((r) => r.status === 'pending').length),
      count(fetchApi<Record<string, unknown>[]>('/reportedComments'), (a) => a.filter((r) => r.status === 'pending').length),
      // count(fetchApi<unknown[]>('/anonymousPosts'), (a) => a.length),
      // count(fetchApi<unknown[]>('/groups'), (a) => a.length),
      count(fetchApi<Record<string, unknown>[]>('/safetyModeration'), (a) => a.filter((r) => r.status === 'pending').length),
      count(fetchApi<Record<string, unknown>[]>('/users'), (a) => a.filter((u) => u.blocked === true).length),
    ])
      .then(([posts, comments, reportedPosts, reportedComments, pending, blocked]) =>
        // anonymous and groups are not fetched; set to 0 as placeholders
        setStats({ posts, comments, reportedPosts, reportedComments, anonymous: 0, groups: 0, pending, blocked }))
      .finally(() => setLoading(false));
  }, []);

  const statCards = [
    { label: 'Total Posts', value: stats?.posts ?? '—', color: '#e83e8c' },
    { label: 'Comments', value: stats?.comments ?? '—', color: '#2563eb' },
    { label: 'Pending Reports', value: (stats?.reportedPosts ?? 0) + (stats?.reportedComments ?? 0) || (loading ? '—' : 0), color: '#dc2626' },
    // { label: 'Anonymous Posts', value: stats?.anonymous ?? '—', color: '#7c3aed' },
    // { label: 'Groups', value: stats?.groups ?? '—', color: '#0ea5e9' },
    { label: 'Moderation Queue', value: stats?.pending ?? '—', color: '#d97706' },
    { label: 'Blocked Users', value: stats?.blocked ?? '—', color: '#64748b' },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Community Dashboard</h1>
        <p className={styles.subtitle}>Monitor and manage every part of your community.</p>
      </div>

      <div className={styles.statsGrid}>
        {statCards.map(({ label, value, color }) => (
          <div key={label} className={styles.statCard}>
            <div className={styles.statValue} style={{ color }}>{value}</div>
            <div className={styles.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      <h2 className={styles.sectionTitle}>Community Sections</h2>
      <div className={styles.grid}>
        {sections.map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href} className={styles.card}>
            <div className={styles.iconWrapper} style={{ backgroundColor: `${color}15` }}>
              <Icon size={28} style={{ color }} />
            </div>
            <div className={styles.cardContent}>
              <h3 className={styles.cardTitle}>{label}</h3>
              <p className={styles.cardDesc}>{desc}</p>
            </div>
            <span className={styles.arrow}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}