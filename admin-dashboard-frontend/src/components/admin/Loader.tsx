import styles from './Loader.module.css';

export function Loader({ fullScreen = false }: { fullScreen?: boolean }) {
  if (fullScreen) {
    return (
      <div className={styles.fullScreen}>
        <div className={styles.spinner}></div>
      </div>
    );
  }
  return <div className={styles.spinner}></div>;
}
