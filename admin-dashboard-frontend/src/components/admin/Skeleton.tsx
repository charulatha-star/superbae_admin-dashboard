import styles from './Skeleton.module.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
}

export function Skeleton({ width = '100%', height = '20px', className = '' }: SkeletonProps) {
  return (
    <div 
      className={`${styles.skeleton} ${className}`}
      style={{ width, height }}
    />
  );
}

export function DashboardCardSkeleton() {
  return <Skeleton height="120px" className={styles.cardSkeleton} />;
}

export function AdminTableSkeleton() {
  return (
    <div className={styles.tableSkeleton}>
      <Skeleton height="40px" />
      <Skeleton height="60px" />
      <Skeleton height="60px" />
      <Skeleton height="60px" />
    </div>
  );
}
