'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { Loader } from '../../../../components/admin/Loader';
import { Bot, Zap, Clock, CheckCircle } from 'lucide-react';
import styles from './page.module.css';

interface AIDashboard {
  totalRequests: number;
  successRate: number;
  avgResponseTime: number;
  activeModels: number;
  tokensUsed: number;
  dailyStats: { date: string; requests: number; tokens: number }[];
}

export default function AIDashboardPage() {
  const [data, setData] = useState<AIDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApi<AIDashboard>('/aiDashboard').then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);


  if (loading) return <div className={styles.container}><div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Loader /></div></div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>AI Dashboard</h1>
        <p className={styles.subtitle}>Monitor AI usage, performance, and system health.</p>
      </div>

      <div className={styles.statsGrid}>
        {[
          { icon: Bot, label: 'Total Requests', value: data?.totalRequests.toLocaleString(), color: '#2563eb' },
          { icon: CheckCircle, label: 'Success Rate', value: `${data?.successRate}%`, color: '#16a34a' },
          { icon: Clock, label: 'Avg Response Time', value: `${data?.avgResponseTime}s`, color: '#d97706' },
          { icon: Zap, label: 'Active Models', value: data?.activeModels, color: '#7c3aed' },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className={styles.statCard}>
            <div className={styles.iconWrap} style={{ background: `${color}15` }}>
              <Icon size={22} style={{ color }} />
            </div>
            <div className={styles.statValue}>{value}</div>
            <div className={styles.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Daily Request Volume (Last 7 Days)</h2>
        <div className={styles.chartArea}>
          {data?.dailyStats.map(day => {
            const max = Math.max(...(data.dailyStats.map(d => d.requests)));
            const pct = (day.requests / max) * 100;
            return (
              <div key={day.date} className={styles.barGroup}>
                <div className={styles.barWrapper}>
                  <div className={styles.bar} style={{ height: `${pct}%` }} title={`${day.requests.toLocaleString()} requests`} />
                </div>
                <div className={styles.barLabel}>{day.date.slice(5)}</div>
                <div className={styles.barValue}>{(day.requests / 1000).toFixed(1)}k</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>Token Usage (Last 7 Days)</h2>
        <table className={styles.table}>
          <thead>
            <tr><th>Date</th><th>Requests</th><th>Tokens Used</th><th>Avg Tokens/Request</th></tr>
          </thead>
          <tbody>
            {data?.dailyStats.map(day => (
              <tr key={day.date}>
                <td>{day.date}</td>
                <td>{day.requests.toLocaleString()}</td>
                <td>{day.tokens.toLocaleString()}</td>
                <td>{Math.round(day.tokens / day.requests)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
