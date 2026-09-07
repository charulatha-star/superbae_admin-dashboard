'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { Settings, Search } from 'lucide-react';
import styles from '../../users/page.module.css';

interface AIConfig {
  id: string;
  name: string;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  status: string;
  updatedAt: string;
}

export default function AIConfigPage(){
  const [configs,setConfigs]=useState<AIConfig[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');

  useEffect(()=>{
    fetchApi<AIConfig[]>('/aiConfig').then(setConfigs).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const filtered=configs.filter(c=>c.name.toLowerCase().includes(search.toLowerCase()));

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>AI Configuration</h1>
        <p className={styles.subtitle}>Adjust AI system parameters and keys.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search config..." value={search} onChange={e=>setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : filtered.length === 0 ? (
          <NoData title="No AI config" description="No AI configurations are available to display." />
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Provider</th>
                <th>Model</th>
                <th>Params</th>
                <th>Status</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c=> (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.provider}</td>
                  <td>{c.model}</td>
                  <td>T:{c.temperature} / Max:{c.maxTokens}</td>
                  <td>{c.status}</td>
                  <td>{new Date(c.updatedAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
