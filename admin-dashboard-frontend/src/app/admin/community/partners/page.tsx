'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { Link2, Search } from 'lucide-react';
import styles from '../../users/page.module.css';

interface Partner {
  id: string;
  user1Id: string;
  user2Id: string;
  status: string;
  sharedSpaceActive: boolean;
  createdAt: string;
}

export default function PartnersPage(){
  const [partners,setPartners]=useState<Partner[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');

  useEffect(()=>{
    fetchApi<Partner[]>('/partners').then(setPartners).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const filtered=partners.filter(p=>p.id.toLowerCase().includes(search.toLowerCase()) || p.user1Id.includes(search) || p.user2Id.includes(search));

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Partner & Relationship Management</h1>
        <p className={styles.subtitle}>Monitor connected accounts and shared spaces.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search by ID..." value={search} onChange={e=>setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No partners" description="No partner relationships are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Relationship ID</th>
                <th>User 1</th>
                <th>User 2</th>
                <th>Shared Space</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(p=> (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.user1Id}</td>
                  <td>{p.user2Id}</td>
                  <td>{p.sharedSpaceActive ? 'Active' : 'Inactive'}</td>
                  <td><span className={`${styles.statusBadge} ${p.status==='connected'?styles.active:styles.suspended}`}>{p.status}</span></td>
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
