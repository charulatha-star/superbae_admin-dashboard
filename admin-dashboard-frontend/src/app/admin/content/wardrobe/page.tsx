'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { Tag, Search } from 'lucide-react';
import styles from '../../users/page.module.css';

interface WardrobeItem {
  id: string;
  category: string;
  style: string;
  color: string;
  status: string;
}

export default function WardrobePage(){
  const [items,setItems]=useState<WardrobeItem[]>([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');

  useEffect(()=>{
    fetchApi<WardrobeItem[]>('/wardrobe').then(setItems).catch(console.error).finally(()=>setLoading(false));
  },[]);

  const filtered=items.filter(i=>i.category.toLowerCase().includes(search.toLowerCase()) || i.style.toLowerCase().includes(search.toLowerCase()));

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return(
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Wardrobe CMS</h1>
        <p className={styles.subtitle}>Manage clothing categories, styles, and color combinations.</p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search categories..." value={search} onChange={e=>setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>

      <div className={styles.tableContainer}>
        {loading ? <AdminTableSkeleton /> : paginatedData.length === 0 ? (
          <NoData title="No wardrobe items" description="No wardrobe items are available to display." />
        ) : (
          <>
            <table className={styles.table}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Style</th>
                <th>Color</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map(i=> (
                <tr key={i.id}>
                  <td>{i.category}</td>
                  <td>{i.style}</td>
                  <td>{i.color}</td>
                  <td><span className={`${styles.statusBadge} ${i.status==='active'?styles.active:styles.suspended}`}>{i.status}</span></td>
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
