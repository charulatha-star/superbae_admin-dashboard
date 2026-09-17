'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { BarChart2, Search } from 'lucide-react';
import styles from '../../users/page.module.css';

interface AIUsage {
  id: string;
  model: string;
  user: string;
  tokens: number;
  cost: number;
  createdAt: string;
}

export default function AIUsagePage(){
  const [data,setData]=useState<AIUsage[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');

  useEffect(()=>{
    fetchApi<AIUsage[]>('/aiUsage').then(setData).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const filtered=data.filter(u=>u.model.toLowerCase().includes(search.toLowerCase()));

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>AI Usage</h1>
        <p className={styles.subtitle}>Track model usage across the platform.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search model..." value={search} onChange={e=>setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : filtered.length === 0 ? (
          <NoData title="No AI usage" description="No AI usage records are available to display." />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Model</th>
                <th>User</th>
                <th>Tokens</th>
                <th>Cost</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item=> (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td>{item.model}</td>
                  <td>{item.user}</td>
                  <td>{item.tokens.toLocaleString()}</td>
                  <td>${item.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
