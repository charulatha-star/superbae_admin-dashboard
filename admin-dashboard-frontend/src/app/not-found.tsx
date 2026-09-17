import Link from 'next/link';
import styles from './error/page.module.css';

export default function NotFoundPage() {
  return (
    <div className={styles.container}>
      <h1 className={styles.titleLarge}>404</h1>
      <h2 className={styles.titleMedium}>Page Not Found</h2>
      <p className={styles.description}>The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/admin/dashboard" className={styles.backButton}>Back to Dashboard</Link>
    </div>
  );
}
