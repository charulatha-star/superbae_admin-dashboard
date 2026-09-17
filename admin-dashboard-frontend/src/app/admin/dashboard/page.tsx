'use client';

import { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import styles from './page.module.css';
import { DashboardCardSkeleton } from '../../../components/admin/Skeleton';
import { useAuth } from '../../../hooks/useAuth';
import { fetchApi } from '../../../lib/api/api';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const { admin, loading: authLoading } = useAuth();

  const [stats, setStats] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);

  useEffect(() => {
    if (!authLoading && admin) {
      Promise.all([
        fetchApi<Record<string, any[]>>('/dashboardStats'),
        fetchApi<Record<string, any[]>>('/dashboardCharts'),
        fetchApi<Record<string, any[]>>('/dashboardTables')
      ])
        .then(([statsData, chartsData, tablesData]) => {
          const roleStats = statsData[admin.roleId] || [
            { title: 'Welcome', value: admin?.name || 'Admin', icon: 'Users', change: 'Active', positive: true },
            { title: 'Role', value: admin?.roleId?.replace('role_', '').toUpperCase() || 'USER', icon: 'Activity', change: 'Assigned', positive: true },
            { title: 'System Status', value: 'Online', icon: 'Globe', change: 'All systems go', positive: true },
            { title: 'Updates', value: 'None', icon: 'Bell', change: 'Up to date', positive: true },
          ];
          setStats(roleStats);
          setChartData(chartsData[admin.roleId] || []);
          setTableData(tablesData[admin.roleId] || []);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [authLoading, admin]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Dashboard Overview</h1>
        <p className={styles.subtitle}>Welcome back to your admin dashboard.</p>
      </div>

      <div className={styles.statsGrid}>
        {loading ? (
          <>
            <DashboardCardSkeleton />
            <DashboardCardSkeleton />
            <DashboardCardSkeleton />
            <DashboardCardSkeleton />
          </>
        ) : (
          stats.map((stat, i) => {
            const IconComponent = (LucideIcons as any)[stat.icon] || LucideIcons.Activity;
            return (
              <div key={i} className={styles.statCard}>
                <div className={styles.statHeader}>
                  <span className={styles.statTitle}>{stat.title}</span>
                  <div className={styles.iconWrapper}>
                    <IconComponent size={20} />
                  </div>
                </div>
                <div className={styles.statValue}>{stat.value}</div>
                <div className={`${styles.statChange} ${stat.positive ? styles.positive : styles.negative}`}>
                  {stat.change} from last month
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className={styles.chartsSection}>
        {loading ? (
          <DashboardCardSkeleton />
        ) : chartData.length > 0 ? (
          <div className={styles.chartCard}>
            <h3 className={styles.cardTitle}>Activity Overview</h3>
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} activeDot={{ r: 8 }} />
                  <CartesianGrid stroke="#eee" strokeDasharray="5 5" />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={{ stroke: 'var(--border-light)' }} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>

      <div className={styles.recentSection}>
        {loading ? (
          <DashboardCardSkeleton />
        ) : tableData.length > 0 ? (
          <div className={styles.tableCard}>
            <h3 className={styles.cardTitle}>Recent Activity</h3>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {Object.keys(tableData[0]).filter(k => k !== 'id').map(key => (
                      <th key={key} className={styles.th}>{key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.map(row => (
                    <tr key={row.id}>
                      {Object.keys(row).filter(k => k !== 'id').map(key => (
                        <td key={key} className={styles.td}>
                          {key === 'status' ? (
                            <span className={`${styles.badge} ${styles[row[key].toLowerCase().replace(/\s+/g, '_')] || styles.defaultBadge}`}>
                              {row[key]}
                            </span>
                          ) : row[key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className={styles.placeholderCard}>
            <h3 className={styles.cardTitle}>Recent Activity</h3>
            <p className={styles.cardEmpty}>No activity data available.</p>
          </div>
        )}
      </div>
    </div>
  );
}
