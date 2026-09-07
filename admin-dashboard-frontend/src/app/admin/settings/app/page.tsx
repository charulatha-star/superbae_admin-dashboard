'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { Smartphone } from 'lucide-react';
import styles from '../../users/page.module.css';

interface AppSettings {
  maintenanceMode: boolean;
  forceUpdateVersion: string;
  apiStatus: string;
  latestReleaseNotes: string;
}

export default function AppSettingsPage(){
  const [settings,setSettings]=useState<AppSettings | null>(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    fetchApi<AppSettings>('/appSettings').then(setSettings).catch(console.error).finally(()=>setLoading(false));
  },[]);

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>App Settings & Configuration</h1>
        <p className={styles.subtitle}>Manage global app configurations and release versions.</p>
      </div>

      <div className={styles.tableContainer} style={{padding: 24}}>
        {loading ? <AdminTableSkeleton /> : settings && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>API Status</h3>
              <p style={{ margin: 0, padding: '8px 12px', background: '#ecfdf5', color: '#047857', borderRadius: 4, display: 'inline-block', fontWeight: 500 }}>
                {settings.apiStatus}
              </p>
            </div>
            
            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>Maintenance Mode</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '0.95rem' }}>Current State:</span>
                <span className={`${styles.statusBadge} ${!settings.maintenanceMode ? styles.active : styles.suspended}`}>
                  {settings.maintenanceMode ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>Minimum App Version (Force Update)</h3>
              <input type="text" value={settings.forceUpdateVersion} readOnly className={styles.searchInput} style={{ width: '100%', maxWidth: 300, cursor: 'not-allowed' }} />
            </div>

            <div>
              <h3 style={{ margin: '0 0 8px 0' }}>Latest Release Notes</h3>
              <textarea value={settings.latestReleaseNotes} readOnly className={styles.searchInput} style={{ width: '100%', minHeight: 100, cursor: 'not-allowed', resize: 'vertical' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
