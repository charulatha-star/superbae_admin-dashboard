import Link from 'next/link';
import styles from '../error/page.module.css';

export default function ForbiddenPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.titleLarge}>403</h1>
      <h2 className={styles.titleMedium}>Access Denied</h2>
      <p className={styles.description}>You don't have permission to access this page.</p>
      <Link href="/admin/dashboard" className={styles.backButton}>Back to Dashboard</Link>
    </div>
  );
}
