import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from '../Sidebar/Sidebar';
import { Navbar } from '../Navbar/Navbar';
import { Footer } from '../Footer/Footer';
import { useSidebar } from '../../../hooks/useSidebar';
import styles from './AdminLayout.module.css';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { isExpanded, toggleSidebar, isMobileOpen, toggleMobileSidebar, setIsMobileOpen } = useSidebar();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Avoid hydration mismatch
  }

  return (
    <div className={styles.layout}>
      <Sidebar 
        isExpanded={isExpanded} 
        isMobileOpen={isMobileOpen} 
        onCloseMobile={() => setIsMobileOpen(false)} 
      />
      
      <div className={`${styles.mainWrapper} ${isExpanded ? styles.expanded : styles.collapsed}`}>
        <Navbar onToggleSidebar={() => {
          if (window.innerWidth <= 1024) {
            toggleMobileSidebar();
          } else {
            toggleSidebar();
          }
        }} />
        
        <main className={styles.mainContent}>
          <div className={styles.contentContainer}>
            {children}
          </div>
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
