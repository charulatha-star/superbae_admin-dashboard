import styles from './Footer.module.css';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <span>© {year} Admin Panel. All rights reserved.</span>
        <span className={styles.version}>Version 1.0.0</span>
      </div>
    </footer>
  );
}
