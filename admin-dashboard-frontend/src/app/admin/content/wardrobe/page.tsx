'use client';

import { useState, useEffect } from 'react';
import { fetchApi } from '../../../../lib/api/api';
import { AdminTableSkeleton } from '../../../../components/admin/Skeleton';
import { NoData } from '../../../../components/admin/NoData/NoData';
import { Tag, Search } from 'lucide-react';
import styles from '../../users/page.module.css';
import { Tabs, type TabItem } from '../../../../components/admin/Tabs/Tabs';
import { ConfigManager } from './components/ConfigManager';

interface WardrobeItem {
  id: string;
  category: string;
  style: string;
  color: string;
  status: string;
}

export default function WardrobePage() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchApi<WardrobeItem[]>('/wardrobe').then(setItems).catch(console.error).finally(() => setLoading(false));
  }, []);

  const filtered = items.filter(i => i.category.toLowerCase().includes(search.toLowerCase()) || i.style.toLowerCase().includes(search.toLowerCase()));

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  // Panels for each tab
  const contentPanel = (
    <>
      <div className={styles.toolbar} style={{ marginBottom: "15px" }}>
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input type="text" placeholder="Search categories..." value={search} onChange={e => setSearch(e.target.value)} className={styles.searchInput} />
        </div>
      </div>
      <div className={styles.tableContainer} >
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
                {paginatedData.map(i => (
                  <tr key={i.id}>
                    <td>{i.category}</td>
                    <td>{i.style}</td>
                    <td>{i.color}</td>
                    <td><span className={`${styles.statusBadge} ${i.status === 'active' ? styles.active : styles.suspended}`}>{i.status}</span></td>
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
    </>
  );

  const configPanel = (
    <div style={{ padding: '1rem' }}>
      <ConfigManager resourcePath="clothingCategories" title="Categories" itemName="Category" />
      <ConfigManager resourcePath="clothingAttributes" title="Attributes" itemName="Attribute" />
      <ConfigManager resourcePath="clothingColors" title="Colors" itemName="Color" />
      <ConfigManager resourcePath="clothingStyles" title="Styles" itemName="Style" />
      <ConfigManager resourcePath="clothingOccasions" title="Occasions" itemName="Occasion" />
      <ConfigManager resourcePath="clothingSeasons" title="Seasons" itemName="Season" />
    </div>
  );

  const rulesPanel = (
    <div style={{ padding: '1rem' }}>
      {/* Placeholder for recommendation rules UI */}
      <p>Recommendation rules management will be implemented here.</p>
    </div>
  );

  const reportsPanel = (
    <div style={{ padding: '1rem' }}>
      {/* Placeholder for reports UI */}
      <p>Wardrobe reports will be shown here.</p>
    </div>
  );

  const tabs: TabItem[] = [
    { id: 'content', label: 'Content', panel: contentPanel },
    { id: 'config', label: 'Configuration', panel: configPanel },
    { id: 'rules', label: 'Rules', panel: rulesPanel },
    { id: 'reports', label: 'Reports', panel: reportsPanel },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Wardrobe</h1>
        {/* <p className={styles.subtitle}>Manage clothing categories, styles, and color combinations.</p> */}
      </div>
      <Tabs tabs={tabs} defaultTab="content" ariaLabel="Wardrobe sections" />
    </div>
  );
}
